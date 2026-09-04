// ───────────────────────────────────────────────────────────────────────────
// خدمة الأرصدة — الكاتب الوحيد لأي تغيير رصيد في النظام كلّه.
//
// كل مسار (طلب، كوبون، إحالة، مكافأة، تعديل إداري، استهلاك) يمرّ من هنا.
// لا يكتب أي ملف آخر في credit_transactions ولا في credit_balance مباشرة —
// وهذا هو ما يضمن الثوابت معمارياً لا بالاتفاق:
//
//   I1  credit_balance == SUM(credit_transactions.amount)
//       مضمون لأن طرفَي المعادلة يُكتبان في معاملة ذرّية واحدة أدناه.
//   I2  credit_balance >= 0
//       مضمون لأن الفحص يقع بعد قفل الصفّ لا قبله.
//   I3  balance_after == balance_before + amount، وسطور المستخدم سلسلة متّصلة.
//   I4  idempotency_key فريد ⇒ أثر at-most-once.
//   I5  لا تعديل ولا حذف — التصحيح بحركة تعويضية جديدة.
//
// القفل: SELECT … FOR UPDATE على صفّ growth_profiles. طلبان متزامنان يقرآن
// رصيد 100 ويخصم كلٌّ منهما 80 ⇒ لولا القفل لانتهى الرصيد إلى −60. مع القفل
// ينتظر الثاني حتى يُثبَّت الأول، فيقرأ 20 ويُرفَض. هذا هو الفرق بين نظام
// مالي وبين عدّاد.
// ───────────────────────────────────────────────────────────────────────────

const { UniqueConstraintError } = require('sequelize');
const sequelize = require('../../config/database');
const { CreditTransaction, GrowthProfile } = require('../models');
const INV = require('../config/invariants');
const audit = require('./audit.service');
const { err } = require('../errors');

/** أنواع تُعتبر منحاً (موجبة) — تحدّد إشارة المبلغ وحدود السقف. */
const CREDIT_TYPES = new Set(['grant', 'refund', 'adjustment']);

/** يولّد رمزاً فريداً للإحالة/الملف. */
function randomCode(len = 8) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // بلا O/0 و I/1 لتفادي اللبس
  let out = '';
  for (let i = 0; i < len; i += 1) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

/**
 * يضمن وجود ملف تجاري للمستخدم. يُنشئه عند أول حاجة.
 * يُستدعى ضمن معاملة حين يكون جزءاً من عملية أكبر.
 */
async function ensureProfile(userId, { transaction = null } = {}) {
  const existing = await GrowthProfile.findOne({ where: { user_id: userId }, transaction });
  if (existing) return existing;

  // محاولات متعدّدة لتفادي تصادم نادر في الرمز الشخصي.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await GrowthProfile.create(
        { user_id: userId, personal_referral_code: randomCode(8) },
        { transaction }
      );
    } catch (e) {
      if (e instanceof UniqueConstraintError) {
        // إمّا الرمز تصادم (نعيد المحاولة) أو الملف أُنشئ بالتوازي (نجلبه).
        const raced = await GrowthProfile.findOne({ where: { user_id: userId }, transaction });
        if (raced) return raced;
        continue;
      }
      throw e;
    }
  }
  throw err.conflict('تعذّر إنشاء الملف التجاري للمستخدم');
}

/**
 * جوهر النظام: يطبّق حركة رصيد واحدة تحت قفل صفّي.
 *
 * @param {number} p.userId
 * @param {string} p.type            grant|debit|refund|adjustment|expiry|reversal
 * @param {number} p.amount          موجب دائماً؛ الإشارة تُشتق من النوع
 * @param {string} p.sourceType
 * @param {string} p.sourceId
 * @param {string} p.description
 * @param {string} p.reason          إلزامي في admin_adjustment
 * @param {number} p.performedBy
 * @param {string} p.idempotencyKey  فريد لكل عملية منطقية
 * @param {object} p.metadata
 * @param {object} p.transaction     معاملة خارجية إن كانت العملية جزءاً من أكبر
 * @param {object} p.req             لتسجيل الـ IP في التدقيق
 * @param {object} p.actor           req.user — للتدقيق
 */
async function apply(params) {
  const {
    userId, type, amount, sourceType, sourceId = null,
    description = null, reason = null, performedBy = null,
    idempotencyKey, metadata = {}, transaction: externalTx = null,
    req = null, actor = null,
  } = params;

  if (!userId) throw err.validation('المستخدم مطلوب');
  if (!idempotencyKey) throw err.validation('مفتاح منع التكرار مطلوب');
  if (!Number.isInteger(amount) || amount <= 0) {
    throw err.validation('المبلغ يجب أن يكون عدداً صحيحاً موجباً');
  }
  if (sourceType === 'admin_adjustment' && !reason?.trim()) {
    throw err.reasonRequired();
  }

  const isCredit = CREDIT_TYPES.has(type);

  // سقوف صلبة: تُقصّ فوق أي قيمة مهما جاءت من إعداد أو من مُدخَل إداري.
  const capped = isCredit
    ? INV.clamp(amount, INV.HARD_MAX_SINGLE_GRANT)
    : INV.clamp(amount, INV.HARD_MAX_SINGLE_DEBIT);

  const run = async (t) => {
    // 1) قفل صفّ الملف. كل ما يلي يُحسب من القيمة المقفولة لا من قراءة سابقة.
    const profile = await ensureProfile(userId, { transaction: t });
    const locked = await GrowthProfile.findOne({
      where: { id: profile.id },
      lock: t.LOCK.UPDATE,
      transaction: t,
    });

    const balanceBefore = locked.credit_balance;

    // 2) مقاصّة دين المكافآت: منحة تُخصم أولاً من دين سابق نشأ عن استرجاع
    //    لم يجد رصيداً كافياً. هذا يمنع تسريب المال دون كسر عدم السالبية.
    let effective = capped;
    const meta = { ...metadata };
    if (isCredit && locked.reward_debt > 0) {
      const settled = Math.min(locked.reward_debt, capped);
      effective = capped - settled;
      meta.debt_offset = settled;
      meta.gross_grant = capped;
      await locked.update({ reward_debt: locked.reward_debt - settled }, { transaction: t });
    }

    const delta = isCredit ? effective : -capped;

    // 3) عدم السالبية — الفحص بعد القفل، وهذا موضعه الصحيح الوحيد.
    if (!isCredit && balanceBefore + delta < 0) {
      throw err.insufficientCredits(capped, balanceBefore);
    }

    const balanceAfter = balanceBefore + delta;

    // 4) سطر الدفتر. القيد الفريد على المفتاح هو ما يمنع التكرار فعلياً.
    const tx = await CreditTransaction.create(
      {
        user_id: userId,
        type,
        amount: delta,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        source_type: sourceType,
        source_id: sourceId === null ? null : String(sourceId),
        description,
        reason,
        performed_by: performedBy,
        idempotency_key: idempotencyKey,
        metadata: meta,
      },
      { transaction: t }
    );

    // 5) الرصيد المخزَّن + العدّادات — في نفس المعاملة، وهذا ما يحفظ I1.
    const counters = { credit_balance: balanceAfter };
    if (delta > 0) counters.lifetime_credits_earned = locked.lifetime_credits_earned + delta;
    if (delta < 0) counters.lifetime_credits_spent = locked.lifetime_credits_spent + Math.abs(delta);
    await locked.update(counters, { transaction: t });

    // 6) التدقيق للعمليات الإدارية — داخل المعاملة أيضاً.
    if (sourceType === 'admin_adjustment') {
      await audit.log({
        actor, action: 'credit.adjust', resourceType: 'credit_transaction',
        resourceId: tx.id,
        before: { credit_balance: balanceBefore },
        after: { credit_balance: balanceAfter, amount: delta },
        reason, req, severity: 'critical', transaction: t,
      });
    }

    return { transaction: tx, profile: locked, idempotent: false };
  };

  // مسار سريع: عملية مطبَّقة سلفاً تُعاد كما هي. إعادة المحاولة بعد انقطاع
  // شبكة يجب أن تنجح لا أن تُنشئ حركة ثانية.
  const already = await CreditTransaction.findOne({
    where: { idempotency_key: idempotencyKey },
    transaction: externalTx,
  });
  if (already) return { transaction: already, idempotent: true };

  // معاملة خارجية: نعمل داخلها ونترك أي تعارض يُفشل العملية الأكبر — وهو
  // السلوك الصحيح (اعتماد طلب مرتين مثلاً يجب أن يفشل كاملاً).
  if (externalTx) return run(externalTx);

  try {
    return await sequelize.transaction(run);
  } catch (e) {
    if (e instanceof UniqueConstraintError) {
      // سباق: نسخة أخرى سبقتنا بنفس المفتاح. نُعيد حركتها.
      const raced = await CreditTransaction.findOne({ where: { idempotency_key: idempotencyKey } });
      if (raced) return { transaction: raced, idempotent: true };
    }
    throw e;
  }
}

// ── واجهات مختصرة فوق apply ────────────────────────────────────────────────

const grant = (p) => apply({ ...p, type: 'grant' });
const debit = (p) => apply({ ...p, type: 'debit' });
const refund = (p) => apply({ ...p, type: 'refund' });
const expire = (p) => apply({ ...p, type: 'expiry' });

/**
 * تعديل إداري — يفرض السبب ويسجّل المنفّذ.
 *
 * clientKey: معرّف تُولّده الواجهة عند فتح النموذج ويبقى ثابتاً عبر إعادات
 * الإرسال. بدونه تُنشئ إعادةُ محاولةٍ بعد انقطاع شبكة تعديلاً ثانياً — وهو
 * بالضبط ما يجب ألّا يحدث في عملية مالية يدوية.
 */
function adjust({ userId, amount, direction, reason, performedBy, clientKey, req, actor, transaction }) {
  if (!reason?.trim()) throw err.reasonRequired();
  const key = clientKey
    ? `admin_adjustment:${userId}:${clientKey}`
    : `admin_adjustment:${userId}:${performedBy}:${Date.now()}:${randomCode(6)}`;

  return apply({
    userId,
    type: direction === 'debit' ? 'debit' : 'adjustment',
    amount: Math.abs(amount),
    sourceType: 'admin_adjustment',
    sourceId: String(performedBy),
    description: direction === 'debit' ? 'خصم إداري' : 'إضافة إدارية',
    reason,
    performedBy,
    idempotencyKey: key,
    transaction, req, actor,
  });
}

/**
 * حركة تعويضية تعكس منحة سابقة.
 * لا تُعدَّل الحركة الأصلية ولا تُحذف (I5) — يُنشأ سطر مقابل يشير إليها.
 * إن لم يكفِ الرصيد، يُسترجَع ما أمكن ويُسجَّل الباقي ديناً على الملف بدل
 * السماح برصيد سالب (I2).
 */
async function reverse({
  userId, originalTransactionId, amount, sourceType, description,
  reason, performedBy = null, req = null, actor = null, transaction: externalTx = null,
}) {
  const idempotencyKey = `reversal:${originalTransactionId}`;

  const run = async (t) => {
    const profile = await ensureProfile(userId, { transaction: t });
    const locked = await GrowthProfile.findOne({
      where: { id: profile.id }, lock: t.LOCK.UPDATE, transaction: t,
    });

    const balanceBefore = locked.credit_balance;
    const recoverable = Math.min(Math.abs(amount), balanceBefore);
    const shortfall = Math.abs(amount) - recoverable;
    const balanceAfter = balanceBefore - recoverable;

    const tx = await CreditTransaction.create(
      {
        user_id: userId,
        type: 'reversal',
        amount: -recoverable,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        source_type: sourceType,
        source_id: String(originalTransactionId),
        description,
        reason,
        performed_by: performedBy,
        idempotency_key: idempotencyKey,
        metadata: { original_transaction_id: originalTransactionId, requested: Math.abs(amount), shortfall },
      },
      { transaction: t }
    );

    await locked.update(
      {
        credit_balance: balanceAfter,
        // الباقي يصير ديناً تُخصم منه المنح القادمة تلقائياً.
        reward_debt: locked.reward_debt + shortfall,
      },
      { transaction: t }
    );

    await audit.log({
      actor, action: 'credit.reverse', resourceType: 'credit_transaction',
      resourceId: tx.id,
      before: { credit_balance: balanceBefore },
      after: { credit_balance: balanceAfter, recovered: recoverable, debt_added: shortfall },
      reason, req, severity: 'critical', transaction: t,
    });

    return { transaction: tx, recovered: recoverable, shortfall, idempotent: false };
  };

  const already = await CreditTransaction.findOne({
    where: { idempotency_key: idempotencyKey }, transaction: externalTx,
  });
  if (already) return { transaction: already, idempotent: true, recovered: Math.abs(already.amount), shortfall: 0 };

  if (externalTx) return run(externalTx);
  return sequelize.transaction(run);
}

/**
 * المطابقة: تقارن الرصيد المخزَّن بمجموع الدفتر.
 *
 * لا تكتب شيئاً عمداً. التصحيح الصامت يخفي الخلل الذي سبّب التباين، وهو
 * أخطر من التباين نفسه. تُبلّغ فقط، ويقرّر الأدمن التصحيح صراحةً فيُسجَّل
 * كعملية حسّاسة كأي تعديل يدوي.
 */
async function reconcile({ userId = null, limit = 500 } = {}) {
  const where = userId ? 'WHERE p.user_id = :userId' : '';
  const rows = await sequelize.query(
    `SELECT p.user_id,
            p.credit_balance                       AS cached,
            COALESCE(SUM(t.amount), 0)::int        AS ledger,
            p.credit_balance - COALESCE(SUM(t.amount), 0)::int AS drift
       FROM growth_profiles p
       LEFT JOIN credit_transactions t ON t.user_id = p.user_id
       ${where}
      GROUP BY p.user_id, p.credit_balance
     HAVING p.credit_balance <> COALESCE(SUM(t.amount), 0)::int
      LIMIT :limit`,
    { replacements: { userId, limit }, type: sequelize.QueryTypes.SELECT }
  );

  return { healthy: rows.length === 0, discrepancies: rows, checkedAt: new Date().toISOString() };
}

/**
 * مسح انتهاء صلاحية أرصدة الاشتراك.
 *
 * القاعدة: حين ينقضي اشتراك المستخدم ويمرّ عليه أيام السماح، تُنهى الأرصدة
 * التي منحتها طلبات الاشتراك ولم تُستهلك بعد. أرصدة حزم الشراء لا تنتهي —
 * العميل دفع ثمنها مرة واحدة ولم يستأجرها.
 *
 * قاعدة الإسناد: **الاستهلاك يُخصم من أرصدة الاشتراك أولاً.** هذا يصبّ في
 * مصلحة العميل — أرصدته الدائمة (الحزم والمكافآت) تبقى أطول ما يمكن، ولا
 * يُنهى إلا ما بقي فعلاً من منح الاشتراك.
 *
 *   المنتهي = max(0, منح الاشتراك − كل الاستهلاك − ما سبق إنهاؤه)
 *   ثم يُقصّ عند الرصيد الحالي حفظاً للثابت I2.
 *
 * مثال: مُنح 300 باشتراك و50 بحزمة، أنفق 100، فرصيده 250 ⇒ يُنهى 200 ويبقى 50.
 *
 * dryRun يحسب ولا يكتب — الأدمن يرى الأثر قبل تنفيذه.
 */
async function expireStale({ dryRun = false, limit = 500, req = null, actor = null } = {}) {
  const settings = require('./settings.service');
  const cfg = await settings.forRequest(req);

  if (!cfg['credits.expire_plan_credits']) {
    return { enabled: false, candidates: [], expired: 0, message: 'إنهاء أرصدة الاشتراك معطّل في الإعدادات' };
  }

  const graceDays = cfg['credits.expiry_grace_days'];

  // المرشّحون: اشتراك منقضٍ تجاوز أيام السماح، ولديهم رصيد قابل للإنهاء.
  const rows = await sequelize.query(
    `WITH sub_grants AS (
       SELECT t.user_id, COALESCE(SUM(t.amount), 0)::int AS granted
         FROM credit_transactions t
         JOIN growth_orders o
           ON o.id::text = t.source_id
          AND o.product_kind_snapshot = 'subscription'
        WHERE t.source_type = 'order' AND t.amount > 0
        GROUP BY t.user_id
     ),
     consumed AS (
       -- كل خصم عدا الانتهاء نفسه: استهلاك خدمة، عكس، استرداد.
       SELECT user_id, COALESCE(SUM(ABS(amount)), 0)::int AS spent
         FROM credit_transactions
        WHERE amount < 0 AND type <> 'expiry'
        GROUP BY user_id
     ),
     already_expired AS (
       SELECT user_id, COALESCE(SUM(ABS(amount)), 0)::int AS expired
         FROM credit_transactions
        WHERE type = 'expiry'
        GROUP BY user_id
     )
     SELECT p.user_id,
            p.credit_balance,
            p.subscription_expires_at,
            g.granted,
            COALESCE(c.spent, 0)   AS spent,
            COALESCE(e.expired, 0) AS expired,
            LEAST(
              p.credit_balance,
              GREATEST(g.granted - COALESCE(c.spent, 0) - COALESCE(e.expired, 0), 0)
            )::int AS expirable
       FROM growth_profiles p
       JOIN sub_grants g ON g.user_id = p.user_id
       LEFT JOIN consumed c ON c.user_id = p.user_id
       LEFT JOIN already_expired e ON e.user_id = p.user_id
      WHERE p.subscription_status IN ('expired', 'cancelled')
        AND p.subscription_expires_at IS NOT NULL
        AND p.subscription_expires_at < NOW() - INTERVAL '1 day' * :graceDays
        AND p.credit_balance > 0
        AND (g.granted - COALESCE(c.spent, 0) - COALESCE(e.expired, 0)) > 0
      LIMIT :limit`,
    { replacements: { graceDays, limit }, type: sequelize.QueryTypes.SELECT }
  );

  const candidates = rows.filter((r) => r.expirable > 0);
  if (dryRun) {
    return {
      enabled: true, dryRun: true, candidates,
      total: candidates.reduce((s, c) => s + c.expirable, 0),
    };
  }

  let expired = 0;
  const failures = [];
  for (const c of candidates) {
    try {
      // المفتاح يحمل تاريخ انقضاء الاشتراك، فإعادة تشغيل المسح في نفس اليوم
      // لا تُنهي مرتين، وانقضاء لاحق ينتج مفتاحاً جديداً.
      const stamp = new Date(c.subscription_expires_at).toISOString().slice(0, 10);
      const { idempotent } = await apply({
        userId: c.user_id,
        type: 'expiry',
        amount: c.expirable,
        sourceType: 'expiry',
        sourceId: stamp,
        description: `انتهاء أرصدة اشتراك منقضٍ منذ ${stamp}`,
        idempotencyKey: `expiry:${c.user_id}:${stamp}`,
        metadata: { granted: c.granted, previously_expired: c.expired },
        req, actor,
      });
      if (!idempotent) expired += 1;
    } catch (e) {
      failures.push({ user_id: c.user_id, error: e.message });
    }
  }

  return { enabled: true, dryRun: false, candidates, expired, failures };
}

/** رصيد مستخدم مع ملفه. */
async function getBalance(userId) {
  const profile = await ensureProfile(userId);
  return {
    user_id: userId,
    credit_balance: profile.credit_balance,
    reward_debt: profile.reward_debt,
    lifetime_credits_earned: profile.lifetime_credits_earned,
    lifetime_credits_spent: profile.lifetime_credits_spent,
  };
}

module.exports = {
  apply, grant, debit, refund, expire, adjust, reverse,
  reconcile, expireStale, getBalance, ensureProfile, randomCode,
};
