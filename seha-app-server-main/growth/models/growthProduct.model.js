const Sequelize = require('sequelize');
const sequelize = require('../../config/database');

// ───────────────────────────────────────────────────────────────────────────
// المنتج — اشتراك أو حزمة رصيد. جدول واحد لأن المفهومين متطابقان بنسبة ~80%:
// كلاهما «شيء تشتريه فيمنحك رصيداً». فصلهما كان ينتج جدولين وشاشتَي إدارة
// ومسارَي شراء ومنطقَي تحقّق لنفس الشيء. العمود `kind` هو المميِّز، والحقول
// الخاصة بالاشتراك (الدورة، أيام التجربة) تبقى فارغة في حزم الرصيد.
//
// كل قيمة هنا يعدّلها الأدمن من اللوحة وتسري على الطلبات اللاحقة فوراً.
// الطلبات السابقة لا تتأثر: growth_orders يحتفظ بنسخة من القيم وقت الشراء.
// ───────────────────────────────────────────────────────────────────────────

const GrowthProduct = sequelize.define(
  'growth_products',
  {
    id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },

    name: { type: Sequelize.STRING(150), allowNull: false },
    slug: { type: Sequelize.STRING(150), allowNull: false, unique: true },
    description: { type: Sequelize.TEXT, allowNull: true },

    /** subscription = متكرر بدورة فوترة · credit_pack = شراء لمرة واحدة */
    kind: {
      type: Sequelize.ENUM('subscription', 'credit_pack'),
      allowNull: false,
      defaultValue: 'credit_pack',
    },

    /** للاشتراكات فقط. يبقى null في حزم الرصيد. */
    billing_cycle: {
      type: Sequelize.ENUM('monthly', 'quarterly', 'annual', 'lifetime'),
      allowNull: true,
    },

    price: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    currency: { type: Sequelize.STRING(3), allowNull: false, defaultValue: 'SAR' },

    /** الأرصدة الممنوحة — لكل دورة في الاشتراك، ومرة واحدة في حزمة الرصيد. */
    credits_granted: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },

    /** مزايا مفعّلة: { whatsapp: true, batch: false, ... } — يقرأها التطبيق عند الحاجة. */
    features: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },

    trial_days: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },

    /** is_active = قابل للشراء · is_visible = يظهر في واجهة العميل */
    is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
    is_visible: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },

    sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },

    metadata: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },

    created_by: { type: Sequelize.INTEGER, allowNull: true },
  },
  {
    paranoid: true, // حذف ناعم: المنتج المحذوف تبقى طلباته السابقة سليمة
    indexes: [
      { unique: true, fields: ['slug'] },
      { fields: ['kind', 'is_active'] },
      { fields: ['is_visible', 'sort_order'] },
    ],
  }
);

module.exports = GrowthProduct;
