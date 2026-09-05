const Sequelize = require('sequelize');
const sequelize = require('../../config/database');

// ───────────────────────────────────────────────────────────────────────────
// قاعدة المكافأة — تربط حدثاً بمنحة. هذا أخطر جدول على مبدأ «لا نظام قابل
// للضبط بالكامل»، ولذلك مُقيَّد عمداً:
//
//   event_type مُقيَّد بـ invariants.REWARD_EVENT_TYPES — قائمة مغلقة منفّذة
//   في الكود. الأدمن يضبط العتبات والمبالغ، ولا يخترع منطقاً. قاعدة بنوع حدث
//   لا يعرفه المحرّك لن يُطلقها شيء أبداً؛ وهذا «إعداد وهمي» بعينه.
//
//   event_config يحمل العتبة فقط، مثال: { threshold: 10 } لـ nth_usage.
//
// max_grants_per_user هو ما يمنع تكرار المكافأة لنفس المستخدم، ويُفرض عبر
// مفتاح idempotency في reward_grants لا بعدّ متفائل.
// ───────────────────────────────────────────────────────────────────────────

const RewardRule = sequelize.define(
  'reward_rules',
  {
    id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },

    name: { type: Sequelize.STRING(200), allowNull: false },
    description: { type: Sequelize.TEXT, allowNull: true },

    event_type: {
      type: Sequelize.ENUM('first_purchase', 'nth_usage', 'referral_milestone', 'product_upgrade'),
      allowNull: false,
    },

    /** { threshold: N } — المعنى يختلف بحسب نوع الحدث ويُفسَّر في المحرّك. */
    event_config: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },

    reward_type: {
      type: Sequelize.ENUM('credits'),
      allowNull: false,
      defaultValue: 'credits',
    },
    reward_value: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },

    max_grants_per_user: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
    /** null = بلا سقف كلّي. يُفحص ذرّياً قبل كل منحة. */
    max_total_grants: { type: Sequelize.INTEGER, allowNull: true },
    total_granted: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },

    campaign_id: { type: Sequelize.INTEGER, allowNull: true },

    valid_from: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    valid_until: { type: Sequelize.DATE, allowNull: true },

    is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },

    created_by: { type: Sequelize.INTEGER, allowNull: true },
  },
  {
    paranoid: true,
    indexes: [
      { fields: ['event_type', 'is_active'] },
      { fields: ['campaign_id'] },
    ],
  }
);

module.exports = RewardRule;
