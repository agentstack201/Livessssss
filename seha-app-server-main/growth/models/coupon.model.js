const Sequelize = require('sequelize');
const sequelize = require('../../config/database');

// ───────────────────────────────────────────────────────────────────────────
// الكوبون — كود يُدخله المشتري عند الدفع فيغيّر السعر.
// لا يملك: سلوكاً بعد التسجيل، ولا دفعات لطرف ثالث. تلك للإحالة والمكافآت.
//
// حاجز أمان مفروض في الكود (invariants.COUPON_REQUIRES_AT_LEAST_ONE_BOUND):
// كوبون بلا سقف كلّي ولا سقف لكل مستخدم ولا تاريخ انتهاء = صنبور مال لا
// نهائي، وكل حقل من الثلاثة مشروع منفرداً. لذلك يُرفض إنشاؤه بلا حدّ واحد
// على الأقل — مهما كان دور من ينشئه.
// ───────────────────────────────────────────────────────────────────────────

const Coupon = sequelize.define(
  'coupons',
  {
    id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },

    /** يُخزَّن بحروف كبيرة دائماً؛ المقارنة تُطبّع المُدخَل قبلها. */
    code: { type: Sequelize.STRING(50), allowNull: false, unique: true },
    name: { type: Sequelize.STRING(150), allowNull: true },

    discount_type: {
      type: Sequelize.ENUM('percentage', 'fixed_amount', 'credit_grant'),
      allowNull: false,
      defaultValue: 'percentage',
    },
    discount_value: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },

    /** سقف الخصم بالريال حين يكون النوع نسبة — يمنع خصماً هائلاً على طلب كبير. */
    max_discount_amount: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
    min_purchase_amount: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },

    /** null = بلا سقف. لكن لا يجوز أن تكون الحدود الثلاثة null معاً. */
    usage_limit: { type: Sequelize.INTEGER, allowNull: true },
    per_user_limit: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 1 },

    /** عدّاد مخزَّن؛ يُزاد ذرّياً داخل معاملة الاستخدام لا بقراءة ثم كتابة. */
    times_used: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },

    require_new_user: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },

    /** null = كل المنتجات. مصفوفة معرّفات = هذه المنتجات فقط. */
    applicable_product_ids: { type: Sequelize.JSONB, allowNull: true },

    campaign_id: { type: Sequelize.INTEGER, allowNull: true },

    valid_from: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    valid_until: { type: Sequelize.DATE, allowNull: true },

    is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },

    created_by: { type: Sequelize.INTEGER, allowNull: true },
  },
  {
    paranoid: true,
    indexes: [
      { unique: true, fields: ['code'] },
      { fields: ['is_active', 'valid_from', 'valid_until'] },
      { fields: ['campaign_id'] },
    ],
  }
);

module.exports = Coupon;
