// ───────────────────────────────────────────────────────────────────────────
// تسجيل مخاطر الإحالة — إشارات متعدّدة موزونة، لا دليل واحد قاطع.
//
// ملاحظة خاصة بهذا المنتج غيّرت أوزان النموذج كلّها:
// مستخدمو المنصة أطباء وموظفو مستشفيات يجلسون خلف NAT مشترك. تطابق الـ IP
// هنا هو القاعدة لا الاستثناء. لذلك وزنه وحده +5 (ضوضاء تقريباً)، ولا يصبح
// ذا معنى إلا مقروناً بتوقيت مريب (+25). معاقبة عيادة كاملة لأن موظفيها
// يتشاركون الشبكة هي أسرع طريق لتدمير الثقة بالنظام.
//
// الإجراء الوحيد المسموح في هذه المرحلة هو تعليق دفعة — لا حظر حسابات.
// التعليق قابل للاسترجاع، والحظر بناءً على استدلال ليس كذلك.
//
// الأوزان في الكود (منطق)، والعتبات في الإعدادات (بارامتر تجاري).
// ───────────────────────────────────────────────────────────────────────────

const { Op } = require('sequelize');
const { ReferralEvent, GrowthProfile, User } = require('../models');
const settings = require('./settings.service');

/** أوزان الإشارات. تعديلها تغيير كود يمرّ بمراجعة — وهذا مقصود. */
const WEIGHTS = {
  same_ip_fast: 25,        // نفس الشبكة + الحسابان أُنشئا خلال دقائق
  same_ip: 5,              // نفس الشبكة وحدها — ضوضاء في بيئة مستشفى
  disposable_email: 30,    // نطاق بريد مؤقّت
  plus_addressing: 30,     // بريد المُحيل نفسه بلاحقة +
  unverified_at_payout: 20,
  velocity_exceeded: 20,   // إحالات المُحيل تجاوزت السقف خلال 24 ساعة
  instant_activation: 25,  // تفعيل خلال أقل من دقيقة من التسجيل
  minimum_then_dormant: 20,
  prior_revocations: 30,   // للمُحيل إلغاءات سابقة
  young_referrer_account: 15,
};

const REASON_LABELS = {
  same_ip_fast: 'نفس الشبكة وفارق زمني قصير جداً بين الحسابين',
  same_ip: 'نفس عنوان الشبكة',
  disposable_email: 'نطاق بريد مؤقّت',
  plus_addressing: 'بريد مشتقّ من بريد المُحيل',
  unverified_at_payout: 'الحساب غير موثَّق عند وقت الدفع',
  velocity_exceeded: 'عدد إحالات مرتفع خلال 24 ساعة',
  instant_activation: 'تفعيل فوري غير طبيعي بعد التسجيل',
  minimum_then_dormant: 'نشاط بالحد الأدنى ثم خمول',
  prior_revocations: 'للمُحيل مكافآت أُلغيت سابقاً',
  young_referrer_account: 'حساب المُحيل حديث جداً',
};

const DISPOSABLE_DOMAINS = [
  'mailinator.com', 'guerrillamail.com', '10minutemail.com', 'tempmail.com',
  'yopmail.com', 'trashmail.com', 'sharklasers.com', 'getnada.com',
  'temp-mail.org', 'throwawaymail.com', 'fakeinbox.com', 'maildrop.cc',
];

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/** يكشف plus-addressing: ahmad+ref1@x.com مشتقّ من ahmad@x.com */
function isPlusDerived(refereeEmail, referrerEmail) {
  const a = normalizeEmail(refereeEmail);
  const b = normalizeEmail(referrerEmail);
  if (!a || !b || !a.includes('+')) return false;
  const [aLocal, aDomain] = a.split('@');
  const [bLocal, bDomain] = b.split('@');
  return aDomain === bDomain && aLocal.split('+')[0] === bLocal;
}

/**
 * يحسب نقاط المخاطرة لحدث إحالة عند لحظة الدفع.
 * @returns {{ score:number, band:'low'|'medium'|'high', reasons:string[], labels:string[] }}
 */
async function scoreEvent(event, { req = null } = {}) {
  const cfg = await settings.forRequest(req);
  const reasons = [];
  let score = 0;

  const add = (key) => {
    if (reasons.includes(key)) return;
    reasons.push(key);
    score += WEIGHTS[key] || 0;
  };

  const [referrer, referee] = await Promise.all([
    User.findByPk(event.referrer_id, { attributes: ['id', 'email', 'createdAt'] }),
    event.referee_id
      ? User.findByPk(event.referee_id, { attributes: ['id', 'email', 'createdAt'] })
      : null,
  ]);

  // ── الشبكة والتوقيت ─────────────────────────────────────────────────────
  //
  // الإشارة كانت تبحث عن حدث يكون فيه المُحيل نفسه «مُحالاً إليه» — وهو حدث
  // لا وجود له إطلاقاً لمن سجّل عضوياً، أي لأغلب المُحيلين. فكانت ميتة عملياً
  // حيث يُفترض أن تعمل.
  //
  // البديل يقيس ما نريد قياسه فعلاً: هل جاء هذا المُحال إليه من الشبكة نفسها
  // التي جاء منها مُحالون آخرون للمُحيل ذاته؟ تكرار عنوان واحد عبر عدّة
  // حسابات جلبها شخص واحد هو نمط المزرعة، ويعمل سواء أكان المُحيل عضوياً أم
  // مُحالاً. ويُستبعد الحدث الحالي من العدّ حتى لا يطابق نفسه.
  if (referee && event.ip_address) {
    const [sameNetwork, referrerOwnEvent] = await Promise.all([
      ReferralEvent.count({
        where: {
          referrer_id: event.referrer_id,
          ip_address: event.ip_address,
          referee_id: { [Op.ne]: null },
          id: { [Op.ne]: event.id },
        },
      }),
      // إن كان المُحيل نفسه قد وصل عبر إحالة، فعنوانه المسجَّل مقارنة مباشرة.
      ReferralEvent.findOne({
        where: { referee_id: event.referrer_id },
        attributes: ['ip_address'],
        order: [['id', 'DESC']],
      }),
    ]);

    const sharedWithReferrer = referrerOwnEvent?.ip_address
      && referrerOwnEvent.ip_address === event.ip_address;

    if (sameNetwork > 0 || sharedWithReferrer) {
      const gapMs = Math.abs(new Date(referee.createdAt) - new Date(referrer.createdAt));
      // المشاركة وحدها ضوضاء في بيئة مستشفى؛ التوقيت القصير هو ما يجعلها مريبة.
      if (gapMs < 10 * 60 * 1000) add('same_ip_fast');
      else add('same_ip');
    }
  }

  // ── البريد ──────────────────────────────────────────────────────────────
  if (referee?.email) {
    const domain = normalizeEmail(referee.email).split('@')[1] || '';
    if (DISPOSABLE_DOMAINS.includes(domain)) add('disposable_email');
    if (referrer?.email && isPlusDerived(referee.email, referrer.email)) add('plus_addressing');
  }

  // ── حالة الملف عند الدفع ────────────────────────────────────────────────
  if (event.referee_id) {
    const profile = await GrowthProfile.findOne({ where: { user_id: event.referee_id } });
    if (profile && !profile.is_verified) add('unverified_at_payout');

    // تفعيل فوري = سلوك آلي لا بشري.
    if (event.registered_at && event.activated_at) {
      const ms = new Date(event.activated_at) - new Date(event.registered_at);
      if (ms >= 0 && ms < 60 * 1000) add('instant_activation');
    }

    // نشاط بالحد الأدنى ثم خمول أسبوعاً — نمط مزرعة كلاسيكي.
    if (profile && event.activated_at) {
      const minCount = cfg['referral.meaningful_action_count'];
      const dormantMs = Date.now() - new Date(profile.last_active_at || event.activated_at).getTime();
      if (profile.documents_created > 0 && profile.documents_created < minCount
          && dormantMs > 7 * 24 * 60 * 60 * 1000) {
        add('minimum_then_dormant');
      }
    }
  }

  // ── سلوك المُحيل ────────────────────────────────────────────────────────
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentCount = await ReferralEvent.count({
    where: {
      referrer_id: event.referrer_id,
      registered_at: { [Op.gte]: dayAgo },
    },
  });
  if (recentCount > cfg['fraud.referral_velocity_per_day']) add('velocity_exceeded');

  const revoked = await ReferralEvent.count({
    where: { referrer_id: event.referrer_id, payout_status: 'revoked' },
  });
  if (revoked >= 3) add('prior_revocations');

  const minAgeDays = cfg['referral.min_referrer_account_age_days'];
  if (minAgeDays > 0 && referrer) {
    const ageDays = (Date.now() - new Date(referrer.createdAt).getTime()) / (24 * 60 * 60 * 1000);
    if (ageDays < minAgeDays) add('young_referrer_account');
  }

  score = Math.min(100, score);
  const band = score >= cfg['fraud.high_threshold'] ? 'high'
    : score >= cfg['fraud.medium_threshold'] ? 'medium'
      : 'low';

  return { score, band, reasons, labels: reasons.map((r) => REASON_LABELS[r] || r) };
}

/**
 * يترجم النطاق إلى قرار دفع لكل طرف.
 *
 * المتوسط يدفع للمُحال إليه ويعلّق المُحيل عمداً: مكافأة المُحال إليه رخيصة
 * وتُبقي المستخدم الشرعي راضياً، والتكلفة الكبرى هي دفعة المُحيل وهي الجديرة
 * بالمراجعة. تعليق الطرفين على شكّ متوسط يعاقب الغالبية البريئة.
 */
function decide(band) {
  switch (band) {
    case 'high':
      return { referee: 'hold', referrer: 'hold', requiresReview: true };
    case 'medium':
      return { referee: 'pay', referrer: 'hold', requiresReview: true };
    default:
      return { referee: 'pay', referrer: 'pay', requiresReview: false };
  }
}

module.exports = { scoreEvent, decide, WEIGHTS, REASON_LABELS };
