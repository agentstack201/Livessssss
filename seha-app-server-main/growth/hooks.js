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
 * التشديد يقرّره الإعداد `credits.enforce_balance` لا ثابت في الكود، فصاحب
 * المنتج يشغّل الاقتصاد من اللوحة بلا نشر. يُترك معطّلاً افتراضياً حتى لا
 * يتغيّر سلوك المنصة القائمة بمجرد تركيب الوحدة. تمرير `enforce` صراحةً
 * يتجاوز الإعداد — للاختبارات ولمسارات تقرّر بنفسها.
 *
 * وهو يعني نقص الرصيد وحده. أي عطل آخر في الوحدة يبقى صامتاً مهما كان
 * التشديد: خلل في المكافآت أو القمع لا يجوز أن يمنع طبيباً من إصدار إجازة.
 */
async function onDocumentCreated({ userId, documentId, enforce = null, req = null }) {
  let enforcing = enforce;
  try {
    const cfg = await settings.forRequest(req);
    if (enforcing === null) enforcing = cfg['credits.enforce_balance'];
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
        // العلامة تميّز فشل الخصم عن أي عطل آخر، فيمرّ وحده عبر الحارس أدناه.
        if (enforcing) { error.blocksIssuance = true; throw error; }
        console.warn(`[growth] تعذّر خصم رصيد المستند ${documentId}: ${error.message}`);
      }
    }

    // عدّادات القمع: التفعيل يُسجَّل مرة واحدة عند أول مستند ناجح.
    //
    // الزيادة ذرّية في القاعدة لا قراءة-فتعديل-فكتابة: مستندان متزامنان
    // يقرآن العدّاد نفسه فيضيع أحدهما، وإعادة تشغيل الخطّاف بعد انقطاع
    // تعدّه مرتين — بينما الخصم نفسه محميّ بمفتاح منع التكرار.
    await profile.increment('documents_created', { by: 1 });
    const patch = { last_active_at: new Date() };
    if (firstEver) patch.activated_at = new Date();
    await profile.update(patch);
    await profile.reload();
    const documentsCreated = profile.documents_created;

    if (firstEver) {
      await referrals.advanceStage({
        userId, stage: 'activated', reference: `document:${documentId}`, req,
      });
    }

    // الفعل الجوهري: دليل عادة لا مجرد تجربة.
    //
    // المقارنة >= لا ===: عدّاد يقفز فوق العتبة (تزامن، أو خفض العتبة من
    // الإعدادات بعد أن تجاوزها المستخدم) كان يُسقط المرحلة إلى الأبد.
    // advanceStage لا تتراجع للخلف فالاستدعاء المتكرّر بلا أثر.
    const threshold = cfg['referral.meaningful_action_count'];
    if (documentsCreated >= threshold) {
      await referrals.advanceStage({
        userId, stage: 'meaningful_action', reference: `document:${documentId}`, req,
      });
    }

    await rewards.evaluate({
      userId, eventType: 'nth_usage',
      data: { documentId, count: documentsCreated }, req,
    });

    return { ok: true, charged: cost, documents: documentsCreated };
  } catch (error) {
    // نقص الرصيد وحده يمنع. غيره يُسجَّل ويُبتلع مهما كان التشديد.
    if (error.blocksIssuance) throw error;
    console.error('[growth] onDocumentCreated:', error.message);
    return { ok: false, error: error.message };
  }
}

/**
 * فحص مسبق: هل يملك المستخدم رصيداً كافياً لإصدار مستند؟
 *
 * يُستدعى قبل إنشاء المستند لا بعده. الخطّاف onDocumentCreated يقع بعد
 * الإنشاء، فرفضه هناك يترك مستنداً موجوداً بلا خصم — المنع يجب أن يسبق.
 *
 * ويحترم `credits.enforce_balance`: وهو معطّل يعود allowed دائماً، فيبقى
 * الرصيد عدّاداً لا بوّابة، ولا يتغيّر سلوك المنصة بمجرد تركيب الوحدة.
 */
async function canCreateDocument({ userId, req = null }) {
  try {
    const cfg = await settings.forRequest(req);
    if (!cfg['credits.enforce_balance']) return { allowed: true, cost: 0, enforced: false };

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
