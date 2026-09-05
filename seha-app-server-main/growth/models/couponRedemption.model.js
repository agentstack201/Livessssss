const Sequelize = require('sequelize');
const sequelize = require('../../config/database');

// ───────────────────────────────────────────────────────────────────────────
// استخدام كوبون — سجل ثابت لكل عملية استعمال.
// وجوده ضروري لسببين: فرض per_user_limit بعدّ الصفوف داخل المعاملة، وحساب
// «أثر الكوبون على الإيراد» لاحقاً. القيم منسوخة وقت الاستخدام فلا يغيّرها
// تعديل الكوبون لاحقاً.
// ───────────────────────────────────────────────────────────────────────────

const CouponRedemption = sequelize.define(
  'coupon_redemptions',
  {
    id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },

    coupon_id: { type: Sequelize.INTEGER, allowNull: false },
    user_id: { type: Sequelize.INTEGER, allowNull: false },

    /** نسخة من الكود وقت الاستخدام — يبقى مقروءاً لو حُذف الكوبون. */
    code_snapshot: { type: Sequelize.STRING(50), allowNull: false },
    discount_type_snapshot: { type: Sequelize.STRING(20), allowNull: false },
    discount_value_snapshot: { type: Sequelize.DECIMAL(10, 2), allowNull: false },

    original_amount: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    discount_applied: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },

    /** الأرصدة الممنوحة حين يكون النوع credit_grant. */
    credits_granted: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },

    order_id: { type: Sequelize.INTEGER, allowNull: true },
    context_type: { type: Sequelize.STRING(40), allowNull: false, defaultValue: 'order' },
  },
  {
    updatedAt: false,
    indexes: [
      { fields: ['coupon_id', 'user_id'] }, // فرض per_user_limit
      { fields: ['user_id', 'createdAt'] },
      { fields: ['order_id'] },
    ],
  }
);

module.exports = CouponRedemption;
