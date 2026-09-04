// ───────────────────────────────────────────────────────────────────────────
// خدمة الإحالة — آلة حالة القمع ومحرّك الدفعات الموزّعة.
//
// القمع (المراحل في الكود، غير قابلة للضبط):
//   clicked → registered → verified → activated → meaningful_action
//           → first_purchase → retained
//
// الدفعات موزّعة على المراحل عبر payout_schedule المضبوط من اللوحة. التصميم
// الموصى به افتراضياً:
//   • المُحال إليه: منحة صغيرة عند verified — حافز اكتساب يجب أن يصل مبكراً
//     كفاية ليغيّر السلوك، والتحقّق يقطع أرخص أشكال المزرعة.
//   • المُحيل: جزء عند activated (دفعة سريعة تُبقيه يُحيل) + الباقي عند
//     first_purchase (معظم التكلفة مربوطة بإيراد فعلي).
//
// كل دفعة تمرّ عبر reward_grants لا عبر مسار خاص — فتصير لكل مكافأة في
// النظام دورة حياة واحدة ومفتاح idempotency واحد ومسار إلغاء واحد.
// ───────────────────────────────────────────────────────────────────────────

const { Op } = require('sequelize');
const sequelize = require('../../config/database');
const {
  ReferralLink, ReferralEvent, RewardGrant, GrowthProfile, GrowthOrder, User,
} = require('../models');
const INV = require('../config/invariants');
const credits = require('./credit.service');
const fraud = require('./fraud.service');
const settings = require('./settings.service');
const audit = require('./audit.service');
const { err } = require('../errors');

/** ترتيب المراحل — يمنع التراجع للخلف عند تحديث الحالة. */
const STAGE_ORDER = INV.REFERRAL_STAGES;
const stageIndex = (s) => STAGE_ORDER.indexOf(s);

/** يتحقّق من جدول الدفعات ضد المراحل المسموحة والسقوف الصلبة. */
function validatePayoutSchedule(schedule) {
  if (!Array.isArray(schedule)) throw err.validation('جدول الدفعات يجب أن يكون مصفوفة');
  return schedule.map((entry, i) => {
    const { milestone, party, amount } = entry || {};
    if (!INV.PAYOUT_MILESTONES.includes(milestone)) {
      throw err.validation(
        `الدفعة ${i + 1}: مرحلة غير معروفة «${milestone}». المسموح: ${INV.PAYOUT_MILESTONES.join(', ')}`
      );
    }
    if (!['referrer', 'referee'].includes(party)) {
      throw err.validation(`الدفعة ${i + 1}: الطرف يجب أن يكون referrer أو referee`);
    }
    const n = parseInt(amount, 10);
    if (!Number.isFinite(n) || n < 0) throw err.validation(`الدفعة ${i + 1}: المبلغ غير صالح`);
    // السقف الصلب يقصّ فوق أي قيمة يكتبها الأدمن.
    return { milestone, party, amount: INV.clamp(n, INV.HARD_MAX_REFERRAL_REWARD) };
  });
}

/** يسجّل نقرة. لا يُنشئ حساباً ولا يمنح شيئاً — مجرد بداية القمع. */
async function trackClick(code, { req = null } = {}) {
  const cfg = await settings.forRequest(req);
  if (!cfg['referral.enabled']) return { tracked: false, reason: 'نظام الإحالة معطّل' };

  const link = await ReferralLink.findOne({ where: { code: String(code || '').trim() } });
  if (!link || !link.is_active) return { tracked: false, reason: 'رابط غير صالح' };
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return { tracked: false, reason: 'انتهت صلاحية الرابط' };
  }
  if (link.max_uses !== null && link.times_used >= link.max_uses) {
    return { tracked: false, reason: 'بلغ الرابط سقف الاستخدام' };
  }

  const event = await ReferralEvent.create({
    referral_link_id: link.id,
    referrer_id: link.owner_id,
    stage_reached: 'clicked',
    clicked_at: new Date(),
    ip_address: audit.clientIp(req),
    user_agent: req?.get ? (req.get('user-agent') || null) : null,
  });

  return { tracked: true, eventId: event.id, linkId: link.id, code: link.code };
}

/**
 * يربط تسجيلاً جديداً بنقرة سابقة.
 * الإسناد يقع مرة واحدة فقط: مستخدم مُسنَد لا يُعاد إسناده أبداً — وهذا ما
 * يمنع الإسناد المزدوج.
 */
async function attributeRegistration({ userId, code, req = null }) {
  const cfg = await settings.forRequest(req);
  if (!cfg['referral.enabled'] || !code) return { attributed: false };

  const link = await ReferralLink.findOne({ where: { code: String(code).trim() } });
  if (!link || !link.is_active) return { attributed: false, reason: 'رابط غير صالح' };

  // منع الإحالة الذاتية — ثابت نظام لا إعداد.
  if (link.owner_id === userId) {
    return { attributed: false, reason: 'لا يمكن إحالة النفس' };
  }

  return sequelize.transaction(async (t) => {
    const profile = await credits.ensureProfile(userId, { transaction: t });
    if (profile.referred_by_link_id) {
      return { attributed: false, reason: 'المستخدم مُسنَد لإحالة سابقة' };
    }

    // نبحث عن نقرة حديثة غير مربوطة داخل نافذة الإسناد.
    const windowStart = new Date(
      Date.now() - cfg['referral.attribution_window_days'] * 24 * 60 * 60 * 1000
    );
    let event = await ReferralEvent.findOne({
      where: {
        referral_link_id: link.id,
        referee_id: null,
        stage_reached: 'clicked',
        clicked_at: { [Op.gte]: windowStart },
      },
      order: [['id', 'DESC']],
      transaction: t,
    });

    // لا نقرة مسجّلة (دخل الرمز يدوياً) ⇒ ننشئ الحدث عند التسجيل مباشرة.
    if (!event) {
      event = await ReferralEvent.create(
        {
          referral_link_id: link.id,
          referrer_id: link.owner_id,
          ip_address: audit.clientIp(req),
          user_agent: req?.get ? (req.get('user-agent') || null) : null,
        },
        { transaction: t }
      );
    }

    await event.update(
      { referee_id: userId, stage_reached: 'registered', registered_at: new Date() },
      { transaction: t }
    );

    await profile.update(
      { referred_by_link_id: link.id, referred_by_user_id: link.owner_id },
      { transaction: t }
    );

    await link.increment('times_used', { transaction: t });

    return { attributed: true, eventId: event.id, referrerId: link.owner_id };
  });
}

/**
 * يرقّي مرحلة القمع ويطلق دفعات المرحلة إن وُجدت.
 * لا يتراجع للخلف، ولا يعيد الدفع لمرحلة دُفعت سلفاً (يمنعه idempotency).
 */
async function advanceStage({ userId, stage, reference = null, req = null }) {
  if (!STAGE_ORDER.includes(stage)) throw err.validation(`مرحلة غير معروفة: ${stage}`);

  const event = await ReferralEvent.findOne({
    where: { referee_id: userId, stage_reached: { [Op.ne]: 'revoked' } },
    order: [['id', 'DESC']],
  });
  if (!event) return { advanced: false, reason: 'لا توجد إحالة لهذا المستخدم' };

  // لا تراجع: مرحلة أدنى مما بُلغ تُتجاهَل بصمت.
  if (stageIndex(stage) <= stageIndex(event.stage_reached)) {
    return { advanced: false, reason: 'المرحلة مبلوغة سلفاً' };
  }

  const stampField = `${stage}_at`;
  const patch = { stage_reached: stage };
  if (Object.hasOwn(event.dataValues, stampField)) patch[stampField] = new Date();
  await event.update(patch);

  const payouts = await processMilestonePayouts({ event, milestone: stage, reference, req });
  return { advanced: true, stage, eventId: event.id, payouts };
}

/**
 * يدفع مستحقّات مرحلة واحدة لكل طرف مُعرَّف في جدول الرابط.
 * يقيّم المخاطر مرة واحدة عند أول دفعة ويخزّن النتيجة على الحدث.
 */
async function processMilestonePayouts({ event, milestone, reference = null, req = null }) {
  const cfg = await settings.forRequest(req);
  if (!cfg['referral.enabled']) return [];

  const link = await ReferralLink.findByPk(event.referral_link_id);
  if (!link || !link.is_active) return [];

  const schedule = Array.isArray(link.payout_schedule) ? link.payout_schedule : [];
  const due = schedule.filter((p) => p.milestone === milestone && Number(p.amount) > 0);
  if (!due.length) return [];

  // شرط إضافي لمرحلة الشراء: قيمة الطلب تتجاوز الحد المضبوط.
  if (milestone === 'first_purchase' && cfg['referral.min_purchase_for_payout'] > 0) {
    const paid = await GrowthOrder.findOne({
      where: { user_id: event.referee_id, status: 'paid' },
      order: [['id', 'ASC']],
    });
    if (!paid || Number(paid.net_amount) < Number(cfg['referral.min_purchase_for_payout'])) {
      return [{ skipped: true, reason: 'قيمة الشراء دون الحد المطلوب للدفع' }];
    }
  }

  // تقييم المخاطر — مرة واحدة، وتُحفظ نتيجته على الحدث ليراها المشغّل.
  const risk = await fraud.scoreEvent(event, { req });
  const decision = fraud.decide(risk.band);
  await event.update({
    fraud_score: risk.score,
    fraud_reasons: risk.labels,
    risk_band: risk.band,
    ...(decision.requiresReview
      ? { hold_until: new Date(Date.now() + cfg['fraud.auto_release_days'] * 24 * 60 * 60 * 1000) }
      : {}),
  });

  const results = [];
  for (const entry of due) {
    const recipientId = entry.party === 'referrer' ? event.referrer_id : event.referee_id;
    if (!recipientId) continue;

    const action = decision[entry.party];
    const amount = INV.clamp(parseInt(entry.amount, 10) || 0, INV.HARD_MAX_REFERRAL_REWARD);
    if (amount <= 0) continue;

    const idempotencyKey = `referral:${event.id}:${milestone}:${entry.party}`;

    // منحة معلّقة: تُسجَّل بحالة held بلا حركة رصيد، فتظهر في طابور المراجعة
    // ويستطيع المشغّل الإفراج عنها لاحقاً بضغطة واحدة.
    if (action === 'hold') {
      const [grant] = await RewardGrant.findOrCreate({
        where: { idempotency_key: idempotencyKey },
        defaults: {
          user_id: recipientId,
          source_kind: 'referral_link',
          referral_link_id: link.id,
          referral_event_id: event.id,
          milestone,
          party: entry.party,
          event_reference: reference,
          value_snapshot: amount,
          status: 'held',
          idempotency_key: idempotencyKey,
          metadata: { risk_score: risk.score, risk_reasons: risk.labels },
        },
      });
      results.push({ party: entry.party, amount, status: 'held', grantId: grant.id });
      continue;
    }

    const paid = await grantReferralPayout({
      event, link, milestone, party: entry.party,
      recipientId, amount, idempotencyKey, reference, req,
    });
    results.push(paid);
  }

  await refreshPayoutStatus(event.id);
  return results;
}

/** يمنح دفعة واحدة: سطر منحة + حركة رصيد، في معاملة واحدة. */
async function grantReferralPayout({
  event, link, milestone, party, recipientId, amount, idempotencyKey, reference = null, req = null,
}) {
  return sequelize.transaction(async (t) => {
    const [grant, created] = await RewardGrant.findOrCreate({
      where: { idempotency_key: idempotencyKey },
      defaults: {
        user_id: recipientId,
        source_kind: 'referral_link',
        referral_link_id: link.id,
        referral_event_id: event.id,
        milestone,
        party,
        event_reference: reference,
        value_snapshot: amount,
        status: 'pending',
        idempotency_key: idempotencyKey,
      },
      transaction: t,
    });

    if (!created && grant.status === 'granted') {
      return { party, amount: grant.value_snapshot, status: 'granted', grantId: grant.id, idempotent: true };
    }

    const { transaction: tx } = await credits.apply({
      userId: recipientId,
      type: 'grant',
      amount: grant.value_snapshot,
      sourceType: 'referral_reward',
      sourceId: String(grant.id),
      description: `مكافأة إحالة — ${party === 'referrer' ? 'مُحيل' : 'مُحال إليه'} عند ${milestone}`,
      idempotencyKey: `credit:${idempotencyKey}`,
      metadata: { referral_event_id: event.id, milestone, party },
      transaction: t,
      req,
    });

    await grant.update({ status: 'granted', credit_transaction_id: tx.id }, { transaction: t });
    await link.increment('total_paid_out', { by: grant.value_snapshot, transaction: t });

    return { party, amount: grant.value_snapshot, status: 'granted', grantId: grant.id, transactionId: tx.id };
  });
}

/** يعيد حساب حالة دفعات الحدث من منحه الفعلية. */
async function refreshPayoutStatus(eventId) {
  const grants = await RewardGrant.findAll({ where: { referral_event_id: eventId } });
  if (!grants.length) return;

  const has = (s) => grants.some((g) => g.status === s);
  const all = (s) => grants.every((g) => g.status === s);

  const status = all('revoked') ? 'revoked'
    : has('held') ? 'hold'
      : all('granted') ? 'complete'
        : has('granted') ? 'partial'
          : 'none';

  await ReferralEvent.update({ payout_status: status }, { where: { id: eventId } });
}

/** إفراج إداري عن دفعة معلّقة. */
async function releaseHeldGrant({ grantId, actor, req }) {
  const grant = await RewardGrant.findByPk(grantId);
  if (!grant) throw err.notFound('المنحة');
  if (grant.status !== 'held') throw err.conflict('المنحة ليست معلّقة');

  const event = await ReferralEvent.findByPk(grant.referral_event_id);
  const link = await ReferralLink.findByPk(grant.referral_link_id);

  const result = await grantReferralPayout({
    event, link,
    milestone: grant.milestone,
    party: grant.party,
    recipientId: grant.user_id,
    amount: grant.value_snapshot,
    idempotencyKey: grant.idempotency_key,
    req,
  });

  await event.update({ reviewed_by: actor?.id || null, reviewed_at: new Date() });
  await audit.log({
    actor, action: 'referral.release', resourceType: 'reward_grant', resourceId: grant.id,
    before: { status: 'held' }, after: { status: 'granted', amount: grant.value_snapshot },
    req, severity: 'notice',
  });
  await refreshPayoutStatus(event.id);
  return result;
}

/**
 * إلغاء مكافأة — بحركة تعويضية لا بحذف.
 * إن لم يكفِ رصيد المستفيد، يُسترجَع ما أمكن ويُسجَّل الباقي ديناً على ملفه.
 */
async function revokeGrant({ grantId, reason, actor, req }) {
  if (!reason?.trim()) throw err.reasonRequired();

  const grant = await RewardGrant.findByPk(grantId);
  if (!grant) throw err.notFound('المنحة');
  if (grant.status === 'revoked') throw err.conflict('المنحة مُلغاة سلفاً');

  // معلّقة ولم تُدفع بعد ⇒ إلغاء بلا حركة رصيد.
  if (grant.status === 'held' || grant.status === 'pending') {
    await grant.update({
      status: 'revoked', revoked_by: actor?.id || null,
      revoked_at: new Date(), revoke_reason: reason,
    });
    await audit.log({
      actor, action: 'referral.revoke', resourceType: 'reward_grant', resourceId: grant.id,
      before: { status: grant.status }, after: { status: 'revoked' },
      reason, req, severity: 'critical',
    });
    if (grant.referral_event_id) await refreshPayoutStatus(grant.referral_event_id);
    return { revoked: true, recovered: 0, shortfall: 0 };
  }

  const rev = await credits.reverse({
    userId: grant.user_id,
    originalTransactionId: grant.credit_transaction_id,
    amount: grant.value_snapshot,
    sourceType: 'referral_clawback',
    description: `استرجاع مكافأة إحالة #${grant.id}`,
    reason,
    performedBy: actor?.id || null,
    req, actor,
  });

  await grant.update({
    status: 'revoked',
    reversal_transaction_id: rev.transaction.id,
    revoked_by: actor?.id || null,
    revoked_at: new Date(),
    revoke_reason: reason,
  });

  if (grant.referral_event_id) {
    await ReferralEvent.update(
      { revoke_reason: reason, reviewed_by: actor?.id || null, reviewed_at: new Date() },
      { where: { id: grant.referral_event_id } }
    );
    await refreshPayoutStatus(grant.referral_event_id);
  }

  return { revoked: true, recovered: rev.recovered, shortfall: rev.shortfall };
}

/**
 * استرجاع تلقائي عند استرداد طلب داخل نافذة الاسترجاع.
 * يُستدعى من خدمة الطلبات عند تنفيذ استرداد.
 */
async function clawbackForOrder({ order, actor, req }) {
  const cfg = await settings.forRequest(req);
  const windowDays = cfg['referral.clawback_window_days'];
  if (!windowDays) return { clawedBack: 0 };

  const event = await ReferralEvent.findOne({ where: { referee_id: order.user_id } });
  if (!event) return { clawedBack: 0 };

  const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const grants = await RewardGrant.findAll({
    where: {
      referral_event_id: event.id,
      status: { [Op.in]: ['granted', 'held'] },
      createdAt: { [Op.gte]: cutoff },
    },
  });

  let count = 0;
  for (const g of grants) {
    await revokeGrant({
      grantId: g.id,
      reason: `استرداد الطلب ${order.reference}`,
      actor, req,
    });
    count += 1;
  }
  return { clawedBack: count };
}

/** يُفرج تلقائياً عن الدفعات المتوسطة التي انقضت مدّة تعليقها بلا إشارة جديدة. */
async function autoReleaseExpiredHolds({ req = null } = {}) {
  const events = await ReferralEvent.findAll({
    where: {
      payout_status: 'hold',
      risk_band: 'medium',
      hold_until: { [Op.lte]: new Date() },
    },
    limit: 200,
  });

  let released = 0;
  for (const event of events) {
    const held = await RewardGrant.findAll({ where: { referral_event_id: event.id, status: 'held' } });
    for (const g of held) {
      await releaseHeldGrant({ grantId: g.id, actor: { id: null, name: 'النظام' }, req });
      released += 1;
    }
  }
  return { released };
}

/** قمع الإحالة مجمَّعاً — لصفحة الإحالات. */
async function funnel({ linkId = null, from = null, to = null } = {}) {
  const where = {};
  if (linkId) where.referral_link_id = linkId;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt[Op.gte] = new Date(from);
    if (to) where.createdAt[Op.lte] = new Date(to);
  }

  const rows = await ReferralEvent.findAll({
    where,
    attributes: [
      [sequelize.fn('COUNT', sequelize.col('id')), 'total'],
      [sequelize.fn('COUNT', sequelize.col('registered_at')), 'registered'],
      [sequelize.fn('COUNT', sequelize.col('verified_at')), 'verified'],
      [sequelize.fn('COUNT', sequelize.col('activated_at')), 'activated'],
      [sequelize.fn('COUNT', sequelize.col('meaningful_action_at')), 'meaningful_action'],
      [sequelize.fn('COUNT', sequelize.col('first_purchase_at')), 'first_purchase'],
      [sequelize.fn('COUNT', sequelize.col('retained_at')), 'retained'],
    ],
    raw: true,
  });

  const r = rows[0] || {};
  const n = (v) => parseInt(v, 10) || 0;
  return {
    clicked: n(r.total),
    registered: n(r.registered),
    verified: n(r.verified),
    activated: n(r.activated),
    meaningful_action: n(r.meaningful_action),
    first_purchase: n(r.first_purchase),
    retained: n(r.retained),
  };
}

module.exports = {
  validatePayoutSchedule, trackClick, attributeRegistration, advanceStage,
  processMilestonePayouts, releaseHeldGrant, revokeGrant, clawbackForOrder,
  autoReleaseExpiredHolds, funnel, refreshPayoutStatus,
};
