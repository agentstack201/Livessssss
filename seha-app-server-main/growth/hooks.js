// ───────────────────────────────────────────────────────────────────────────
// خطّافات الاندماج — الجسر بين المنصة القائمة ووحدة النمو.
//
// هذه هي النقطة التي تجعل الوحدة حيّة بدل أن تكون لوحة معزولة: حين ينشئ
// مستخدم مستنداً، تُستهلك أرصدة، ويتقدّم قمع الإحالة، وتُقيَّم المكافآت.
//
// كل دالة هنا تفشل بصمت (تُسجّل ولا ترمي) عمداً: عطل في وحدة النمو يجب ألّا
// يمنع طبيباً من إصدار إجازة مرضية. النمو ميزة، وإصدار المستند هو المنتج.
// ───────────────────────────────────────────────────────────────────────────

const { GrowthProfile } = require('./models');
const credits = require('./services/credit.service');
const referrals = require('./services/referral.service');
const rewards = require('./services/reward.service');
const settings = require('./services/settings.service');

/**
 * عند تسجيل مستخدم جديد: ينشئ ملفاً تجارياً، ويمنح رصيداً ترحيبياً إن ضُبط،
 * ويُسند الإحالة إن حمل رمزاً.
 */
async function onUserRegistered({ userId, referralCode = null, req = null }) {
  try {
    const cfg = await settings.forRequest(req);
    await credits.ensureProfile(userId);

    const bonus = cfg['credits.signup_bonus'];
    if (bonus > 0) {
      await credits.grant({
        userId, amount: bonus,
        sourceType: 'signup_bonus', sourceId: String(userId),
        description: 'رصيد ترحيبي',
        idempotencyKey: `signup_bonus:${userId}`,
        req,
      });
    }

    if (referralCode) {
      await referrals.attributeRegistration({ userId, code: referralCode, req });
    }
    return { ok: true };
  } catch (error) {
    console.error('[growth] onUserRegistered:', error.message);
    return { ok: false, error: error.message };
  }
}

/** عند توثيق قناة الاتصال — يفتح بوابة أول دفعة إحالة. */
async function onUserVerified({ userId, req = null }) {
  try {
    const profile = await credits.ensureProfile(userId);
    if (!profile.is_verified) {
      await profile.update({ is_verified: true, verified_at: new Date() });
    }
    await referrals.advanceStage({ userId, stage: 'verified', req });
    return { ok: true };
  } catch (error) {
    console.error('[growth] onUserVerified:', error.message);
    return { ok: false, error: error.message };
  }
}

/**
 * عند إصدار مستند بنجاح — قلب اقتصاد الوحدة.
 *
 * الترتيب مقصود: يُخصم الرصيد أولاً، وإن فشل الخصم لا يقع شيء بعده. أما
 * تقدّم القمع وتقييم المكافآت فبعد نجاح الخصم، لأنهما يعتمدان عليه.
 *
 * `enforce` تحدّد ما إذا كان نقص الرصيد يمنع الإصدار. تُترك false افتراضياً
 * حتى لا يتغيّر سلوك المنصة القائمة بمجرد تركيب الوحدة؛ تُفعَّل حين يقرّر
 * صاحب المنتج تشغيل الاقتصاد فعلياً.
 */
async function onDocumentCreated({ userId, documentId, enforce = false, req = null }) {
  try {
    const cfg = await settings.forRequest(req);
    const cost = cfg['credits.cost_per_document'];

    const profile = await credits.ensureProfile(userId);
    const firstEver = !profile.activated_at;

    if (cost > 0) {
      try {
        await credits.debit({
          userId, amount: cost,
          sourceType: 'service_usage', sourceId: String(documentId),
          description: `إصدار مستند #${documentId}`,
          idempotencyKey: `usage:${documentId}`,
          req,
        });
      } catch (error) {
        if (enforce) throw error;
        console.warn(`[growth] تعذّر خصم رصيد المستند ${documentId}: ${error.message}`);
      }
    }

    // عدّادات القمع: التفعيل يُسجَّل مرة واحدة عند أول مستند ناجح.
    const patch = {
      documents_created: profile.documents_created + 1,
      last_active_at: new Date(),
    };
    if (firstEver) patch.activated_at = new Date();
    await profile.update(patch);

    if (firstEver) {
      await referrals.advanceStage({
        userId, stage: 'activated', reference: `document:${documentId}`, req,
      });
    }

    // الفعل الجوهري: دليل عادة لا مجرد تجربة.
    const threshold = cfg['referral.meaningful_action_count'];
    if (patch.documents_created === threshold) {
      await referrals.advanceStage({
        userId, stage: 'meaningful_action', reference: `document:${documentId}`, req,
      });
    }

    await rewards.evaluate({
      userId, eventType: 'nth_usage',
      data: { documentId, count: patch.documents_created }, req,
    });

    return { ok: true, charged: cost, documents: patch.documents_created };
  } catch (error) {
    if (enforce) throw error;
    console.error('[growth] onDocumentCreated:', error.message);
    return { ok: false, error: error.message };
  }
}

/** فحص مسبق: هل يملك المستخدم رصيداً كافياً لإصدار مستند؟ */
async function canCreateDocument({ userId, req = null }) {
  try {
    const cfg = await settings.forRequest(req);
    const cost = cfg['credits.cost_per_document'];
    if (cost <= 0) return { allowed: true, cost: 0 };

    const profile = await credits.ensureProfile(userId);
    return {
      allowed: profile.credit_balance >= cost,
      cost,
      balance: profile.credit_balance,
      shortfall: Math.max(0, cost - profile.credit_balance),
    };
  } catch (error) {
    // عند تعذّر الفحص نسمح: النمو لا يعطّل المنتج.
    console.error('[growth] canCreateDocument:', error.message);
    return { allowed: true, cost: 0, error: error.message };
  }
}

module.exports = { onUserRegistered, onUserVerified, onDocumentCreated, canCreateDocument };
