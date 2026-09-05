const Sequelize = require('sequelize');
const sequelize = require('../../config/database');

// ───────────────────────────────────────────────────────────────────────────
// الطلب — السجل التجاري الثابت. هذا الجدول هو مصدر حقيقة الإيراد.
//
// لماذا يخزّن نسخة من قيم المنتج بدل الاكتفاء بمفتاح أجنبي؟
// لأن الأدمن يغيّر السعر والأرصدة من اللوحة في أي لحظة. لو عرضنا الطلب
// بالانضمام إلى growth_products لتغيّر تاريخ الشراء بأثر رجعي: طلب اشتُري
// بـ 100 ريال/200 رصيد سيظهر فجأة 150 ريال/350 رصيد لمجرد أن الأدمن حدّث
// المنتج اليوم. الأعمدة المنتهية بـ _snapshot تُكتب مرة واحدة عند الإنشاء
// ولا تُمسّ بعدها أبداً؛ والمفتاح الأجنبي يبقى للنسب فقط لا للعرض.
//
// دورة الحالة: pending ← awaiting_payment ← paid ← (refunded | cancelled)
// الاعتماد يدوي في هذه المرحلة (لا بوابة دفع)، ولذلك يُسجَّل معتمِده ووقته.
// ───────────────────────────────────────────────────────────────────────────

const GrowthOrder = sequelize.define(
  'growth_orders',
  {
    id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },

    /** رقم عرض للعميل — أسهل من id في المراسلات. */
    reference: { type: Sequelize.STRING(24), allowNull: false, unique: true },

    user_id: { type: Sequelize.INTEGER, allowNull: false },

    /** للنسب فقط. لا يُستعمل أبداً لعرض قيم الطلب. */
    product_id: { type: Sequelize.INTEGER, allowNull: true },

    // ── نسخة ثابتة من المنتج وقت الشراء ───────────────────────────────────
    product_name_snapshot: { type: Sequelize.STRING(150), allowNull: false },
    product_kind_snapshot: { type: Sequelize.STRING(20), allowNull: false },
    billing_cycle_snapshot: { type: Sequelize.STRING(20), allowNull: true },
    unit_price_snapshot: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
    credits_snapshot: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    features_snapshot: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
    currency: { type: Sequelize.STRING(3), allowNull: false, defaultValue: 'SAR' },

    // ── الحساب ────────────────────────────────────────────────────────────
    gross_amount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
    discount_amount: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    net_amount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },

    coupon_id: { type: Sequelize.INTEGER, allowNull: true },
    coupon_code_snapshot: { type: Sequelize.STRING(50), allowNull: true },

    /** إسناد تجاري: أي حملة/رابط إحالة جلب هذا الطلب. أساس حساب الـ ROI. */
    campaign_id: { type: Sequelize.INTEGER, allowNull: true },
    referral_link_id: { type: Sequelize.INTEGER, allowNull: true },

    status: {
      type: Sequelize.ENUM('pending', 'awaiting_payment', 'paid', 'refunded', 'cancelled'),
      allowNull: false,
      defaultValue: 'awaiting_payment',
    },

    /** فترة الاشتراك المغطّاة — تجعل هذا الجدول تاريخ الاشتراك أيضاً. */
    period_start: { type: Sequelize.DATE, allowNull: true },
    period_end: { type: Sequelize.DATE, allowNull: true },

    /** ما أثبت به العميل الدفع (رقم حوالة أو رابط إيصال). */
    payment_reference: { type: Sequelize.STRING(191), allowNull: true },
    payment_note: { type: Sequelize.TEXT, allowNull: true },

    approved_by: { type: Sequelize.INTEGER, allowNull: true },
    approved_at: { type: Sequelize.DATE, allowNull: true },

    refunded_by: { type: Sequelize.INTEGER, allowNull: true },
    refunded_at: { type: Sequelize.DATE, allowNull: true },
    refund_reason: { type: Sequelize.STRING(500), allowNull: true },

    /** الحركة التي منحت الأرصدة عند الاعتماد — للتتبّع العكسي. */
    credit_transaction_id: { type: Sequelize.INTEGER, allowNull: true },

    metadata: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
  },
  {
    indexes: [
      { unique: true, fields: ['reference'] },
      { fields: ['user_id', 'createdAt'] },
      { fields: ['status', 'createdAt'] },
      { fields: ['campaign_id'] },
      { fields: ['referral_link_id'] },
      { fields: ['product_id'] },
    ],
  }
);

module.exports = GrowthOrder;
