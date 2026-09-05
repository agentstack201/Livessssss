// ───────────────────────────────────────────────────────────────────────────
// تهيئة وحدة النمو عند الإقلاع — قيود وفهارس وبذور.
//
// لماذا DDL يدوي هنا؟ النشر يشغّل `node index.js` فقط ولا يشغّل أي ملف في
// migrations/ إطلاقاً (كما يوثّق config/schemaSync.js). وsync({alter:false})
// ينشئ الجداول المفقودة لكنه لا يُنشئ قيود CHECK ولا الفهارس الجزئية. هذه
// القيود ليست تجميلاً: أحدها هو الحاجز الأخير ضد رصيد سالب لو تسرّبت كتابة
// من خارج credit.service يوماً.
//
// كل جملة idempotent فتُشغَّل عند كل إقلاع بلا ضرر.
// ───────────────────────────────────────────────────────────────────────────

const CONSTRAINTS = [
  {
    why: 'عدم السالبية — الحاجز الأخير لو تسرّبت كتابة خارج الخدمة',
    sql: `DO $$ BEGIN
            ALTER TABLE growth_profiles
              ADD CONSTRAINT growth_profiles_balance_non_negative
              CHECK (credit_balance >= 0);
          EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  },
  {
    why: 'دين المكافآت لا يكون سالباً',
    sql: `DO $$ BEGIN
            ALTER TABLE growth_profiles
              ADD CONSTRAINT growth_profiles_debt_non_negative
              CHECK (reward_debt >= 0);
          EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  },
  {
    why: 'سلسلة الدفتر: balance_after == balance_before + amount',
    sql: `DO $$ BEGIN
            ALTER TABLE credit_transactions
              ADD CONSTRAINT credit_tx_chain_consistent
              CHECK (balance_after = balance_before + amount);
          EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  },
  {
    why: 'رصيد الدفتر لا ينزل تحت الصفر في أي سطر',
    sql: `DO $$ BEGIN
            ALTER TABLE credit_transactions
              ADD CONSTRAINT credit_tx_balance_non_negative
              CHECK (balance_after >= 0);
          EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  },
  {
    why: 'منع الإحالة الذاتية على مستوى قاعدة البيانات — ثابت لا إعداد',
    sql: `DO $$ BEGIN
            ALTER TABLE referral_events
              ADD CONSTRAINT referral_no_self
              CHECK (referee_id IS NULL OR referee_id <> referrer_id);
          EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  },
  {
    why: 'مُحال إليه واحد لكل رابط — فهرس جزئي لأن referee_id يبقى NULL حتى التسجيل',
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS referral_events_unique_referee
            ON referral_events (referral_link_id, referee_id)
          WHERE referee_id IS NOT NULL;`,
  },
  {
    why: 'مستخدم لا يُسنَد لأكثر من إحالة واحدة',
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS referral_events_one_per_referee
            ON referral_events (referee_id)
          WHERE referee_id IS NOT NULL;`,
  },
  {
    why: 'مقارنة رموز الكوبونات بلا حساسية لحالة الأحرف',
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS coupons_code_upper_unique
            ON coupons (UPPER(code)) WHERE "deletedAt" IS NULL;`,
  },
  {
    why: 'سقف الاستخدام لا يتجاوَز على مستوى الصفّ',
    sql: `DO $$ BEGIN
            ALTER TABLE coupons
              ADD CONSTRAINT coupons_usage_within_limit
              CHECK (usage_limit IS NULL OR times_used <= usage_limit);
          EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  },
];

/**
 * يشغّل قيود الوحدة. لا يرمي عند فشل جملة واحدة: قيد يفشل لأن بيانات قديمة
 * تخالفه يجب أن يُطبع لا أن يُسقط إقلاع الخادم.
 */
async function applyConstraints(sequelize) {
  let applied = 0;
  for (const { sql, why } of CONSTRAINTS) {
    try {
      await sequelize.query(sql);
      applied += 1;
    } catch (error) {
      console.warn(`⚠️  [growth] تعذّر تطبيق قيد (${why}): ${error.message}`);
    }
  }
  return applied;
}

/** بذور الأدوار المؤسِّسة. */
async function seed() {
  const roles = require('./services/role.service');
  const count = await roles.seedSystemRoles();
  return { roles: count };
}

/**
 * تهيئة كاملة — تُستدعى من index.js بعد مزامنة النماذج.
 * تُغلَّف كلّها بـ try لأن فشل تهيئة وحدة إضافية يجب ألّا يمنع إقلاع المنصة.
 */
async function initialize(sequelize) {
  try {
    const applied = await applyConstraints(sequelize);
    const seeded = await seed();
    console.log(`✅ [growth] وحدة النمو جاهزة — ${applied} قيداً، ${seeded.roles} أدوار نظامية`);
    return { ok: true, constraints: applied, ...seeded };
  } catch (error) {
    console.error('❌ [growth] فشلت تهيئة وحدة النمو:', error.message);
    return { ok: false, error: error.message };
  }
}

module.exports = { initialize, applyConstraints, seed, CONSTRAINTS };
