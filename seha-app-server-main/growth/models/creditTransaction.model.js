const Sequelize = require('sequelize');
const sequelize = require('../../config/database');

// ───────────────────────────────────────────────────────────────────────────
// دفتر الأرصدة — سجل إلحاقي ثابت. هذا الجدول هو النظام كلّه.
//
// الثوابت التي يحرسها (لا يجوز لأي إعداد في اللوحة تعطيلها):
//   I1  credit_balance == SUM(amount) لكل مستخدم
//   I3  balance_after == balance_before + amount، وسطور المستخدم تكوّن سلسلة
//       متّصلة: balance_before للسطر n == balance_after للسطر n−1.
//       انكسار السلسلة = دليل عبث، وتُحدِّد المطابقةُ السطرَ الدقيق.
//   I4  idempotency_key فريد ⇒ أثر at-most-once. إعادة المحاولة بعد انقطاع
//       شبكة تُرجع الحركة الأصلية كنجاح، ولا تنشئ ثانية.
//   I5  لا UPDATE ولا DELETE. التصحيح بحركة تعويضية جديدة فقط.
//
// لا يوجد updatedAt عمداً: وجوده يوحي بأن السطر قابل للتعديل.
// ───────────────────────────────────────────────────────────────────────────

const CreditTransaction = sequelize.define(
  'credit_transactions',
  {
    id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },

    user_id: { type: Sequelize.INTEGER, allowNull: false },

    type: {
      type: Sequelize.ENUM('grant', 'debit', 'refund', 'adjustment', 'expiry', 'reversal'),
      allowNull: false,
    },

    /** موجب للمنح، سالب للخصم. الإشارة جزء من القيمة لا حقل منفصل. */
    amount: { type: Sequelize.INTEGER, allowNull: false },

    balance_before: { type: Sequelize.INTEGER, allowNull: false },
    balance_after: { type: Sequelize.INTEGER, allowNull: false },

    source_type: {
      type: Sequelize.ENUM(
        'order',              // اعتماد طلب
        'coupon',             // كوبون يمنح رصيداً
        'referral_reward',    // دفعة إحالة
        'referral_clawback',  // استرجاع دفعة إحالة
        'reward_rule',        // محرك المكافآت
        'admin_adjustment',   // تعديل إداري يدوي
        'service_usage',      // استهلاك عند إصدار مستند
        'signup_bonus',       // منحة ترحيبية
        'refund',             // استرداد طلب
        'expiry'              // انتهاء صلاحية
      ),
      allowNull: false,
    },
    /** مرجع متعدّد الأشكال إلى الكيان المصدر (رقم الطلب، معرّف المنحة…). */
    source_id: { type: Sequelize.STRING(100), allowNull: true },

    description: { type: Sequelize.STRING(500), allowNull: true },

    /** سبب إلزامي في التعديل الإداري — تفرضه الخدمة لا قاعدة البيانات. */
    reason: { type: Sequelize.TEXT, allowNull: true },

    /** من نفّذ العملية إن كانت إدارية. null للعمليات الآلية. */
    performed_by: { type: Sequelize.INTEGER, allowNull: true },

    idempotency_key: { type: Sequelize.STRING(200), allowNull: false, unique: true },

    metadata: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
  },
  {
    updatedAt: false, // الدفتر لا يُعدَّل
    indexes: [
      { unique: true, fields: ['idempotency_key'] },
      { fields: ['user_id', 'createdAt'] },
      { fields: ['source_type', 'source_id'] },
      { fields: ['type', 'createdAt'] },
      { fields: ['createdAt'] },
    ],
  }
);

module.exports = CreditTransaction;
