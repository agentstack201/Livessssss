const Sequelize = require('sequelize');
const sequelize = require('../../config/database');

// ───────────────────────────────────────────────────────────────────────────
// الملف التجاري — امتداد للمستخدم بدل تعديل جدول users.
//
// لماذا جدول منفصل؟ الوحدة يجب أن تُركَّب وتُفكَّك دون أن تمسّ نموذج المستخدم
// الذي تعتمد عليه كل ميزات المنصة القائمة. وهذا الجدول أيضاً هو صفّ القفل:
// كل عملية رصيد تقفل صفّه بـ SELECT … FOR UPDATE قبل أن تحسب أي شيء.
//
// credit_balance مخزَّن مؤقّت (cache) وليس مصدر الحقيقة — الدفتر هو المصدر.
// الثابت I1 يفرض: credit_balance == SUM(credit_transactions.amount)
// ويُحفظ لأن الطرفين يُكتبان داخل معاملة ذرّية واحدة في credit.service.
// ───────────────────────────────────────────────────────────────────────────

const GrowthProfile = sequelize.define(
  'growth_profiles',
  {
    id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },

    user_id: { type: Sequelize.INTEGER, allowNull: false, unique: true },

    /** نسخة مخزَّنة من مجموع الدفتر. لا تُكتب إلا داخل معاملة الدفتر نفسها. */
    credit_balance: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },

    /**
     * دين مكافآت: حين يُسترجَع مبلغ أنفقه المستخدم فعلاً. لا نسمح برصيد سالب
     * (الثابت I2)، فيُسجَّل العجز هنا وتُخصم منه المنح المستقبلية تلقائياً.
     * هذا يمنع تسريب المال دون كسر عدم السالبية.
     */
    reward_debt: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },

    personal_referral_code: { type: Sequelize.STRING(16), allowNull: false, unique: true },

    /** من أحال هذا المستخدم — يُملأ مرة واحدة عند التسجيل ولا يتغيّر. */
    referred_by_link_id: { type: Sequelize.INTEGER, allowNull: true },
    referred_by_user_id: { type: Sequelize.INTEGER, allowNull: true },

    // ── حالة الاشتراك الحالية (التاريخ الكامل في growth_orders) ───────────
    current_product_id: { type: Sequelize.INTEGER, allowNull: true },
    subscription_status: {
      type: Sequelize.ENUM('none', 'trialing', 'active', 'past_due', 'cancelled', 'expired'),
      allowNull: false,
      defaultValue: 'none',
    },
    subscription_started_at: { type: Sequelize.DATE, allowNull: true },
    subscription_expires_at: { type: Sequelize.DATE, allowNull: true },

    // ── عدّادات القمع — تُحدَّث مع الأحداث، وتغني عن مسح الدفتر كاملاً ─────
    lifetime_credits_earned: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    lifetime_credits_spent: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    documents_created: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },

    /** لحظة التفعيل = أول خصم استخدام ناجح. أساس مقياس Activation Rate. */
    activated_at: { type: Sequelize.DATE, allowNull: true },
    first_paid_at: { type: Sequelize.DATE, allowNull: true },
    last_active_at: { type: Sequelize.DATE, allowNull: true },

    /** إثبات قناة اتصال — حاجز الإحالة الأرخص ضد الحسابات الآلية. */
    is_verified: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
    verified_at: { type: Sequelize.DATE, allowNull: true },

    metadata: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
  },
  {
    indexes: [
      { unique: true, fields: ['user_id'] },
      { unique: true, fields: ['personal_referral_code'] },
      { fields: ['subscription_status', 'subscription_expires_at'] },
      { fields: ['referred_by_user_id'] },
      { fields: ['last_active_at'] },
    ],
  }
);

module.exports = GrowthProfile;
