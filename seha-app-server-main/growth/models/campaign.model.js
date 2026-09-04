const Sequelize = require('sequelize');
const sequelize = require('../../config/database');

// ───────────────────────────────────────────────────────────────────────────
// الحملة — «مجلّد له ميزانية وساعة».
//
// تملك: نافذة زمنية، غلاف ميزانية، وتجميعاً لإسناد الـ ROI.
// لا تملك: أي آلية خاصة بها — لا منطق خصم ولا منطق دفع. الكوبونات والروابط
// والقواعد هي الأدوات التي تُوضع داخلها، وكلها قابلة للاستعمال بلا حملة
// (campaign_id قابل لأن يكون null في كل مكان).
//
// لولا هذا الجدول لاستحال الجواب عن «هل حملة رمضان كانت مربحة؟» لأن الإنفاق
// موزّع على عدة كوبونات وروابط. هذا سبب وجوده الوحيد، ولذلك يبقى نحيفاً.
// ───────────────────────────────────────────────────────────────────────────

const Campaign = sequelize.define(
  'campaigns',
  {
    id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },

    name: { type: Sequelize.STRING(200), allowNull: false },
    slug: { type: Sequelize.STRING(120), allowNull: false, unique: true },
    description: { type: Sequelize.TEXT, allowNull: true },

    type: {
      type: Sequelize.ENUM('acquisition', 'retention', 'upsell', 'seasonal', 'custom'),
      allowNull: false,
      defaultValue: 'acquisition',
    },

    /** الحالة الفعّالة تُحسب من التواريخ أيضاً — scheduled يصبح active تلقائياً. */
    status: {
      type: Sequelize.ENUM('draft', 'scheduled', 'active', 'paused', 'ended'),
      allowNull: false,
      defaultValue: 'draft',
    },

    start_date: { type: Sequelize.DATE, allowNull: true },
    end_date: { type: Sequelize.DATE, allowNull: true },

    /** null = بلا سقف. يُفحص ويُزاد ذرّياً عند كل إنفاق. */
    budget: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
    budget_used: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    currency: { type: Sequelize.STRING(3), allowNull: false, defaultValue: 'SAR' },

    target_audience: {
      type: Sequelize.ENUM('all', 'new_users', 'existing_users', 'churned'),
      allowNull: false,
      defaultValue: 'all',
    },

    /** استهداف وإسناد فقط — ليس آلية. */
    target_product_id: { type: Sequelize.INTEGER, allowNull: true },

    created_by: { type: Sequelize.INTEGER, allowNull: true },
  },
  {
    paranoid: true,
    indexes: [
      { unique: true, fields: ['slug'] },
      { fields: ['status', 'start_date', 'end_date'] },
    ],
  }
);

module.exports = Campaign;
