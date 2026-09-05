const Sequelize = require('sequelize');
const sequelize = require('../../config/database');

// ───────────────────────────────────────────────────────────────────────────
// منحة المكافأة — دفتر الـ idempotency الموحَّد لكل مكافآت النظام.
//
// قرار معماري مهم: دفعات الإحالة تمرّ من هنا أيضاً، لا عبر مسار خاص بها.
// النتيجة أن لكل مكافأة في النظام — إحالة كانت أو قاعدة سلوك — دورة حياة
// واحدة، ومفتاح idempotency واحد، ومسار تدقيق واحد، ومسار إلغاء واحد.
// لذلك source_kind يميّز المصدر، و reward_rule_id قابل لأن يكون null.
//
// value_snapshot يحفظ المبلغ وقت المنح: الأدمن قد يغيّر قيمة القاعدة أو
// جدول دفعات الرابط غداً، وذلك يجب ألّا يعيد كتابة ما مُنح أمس.
// ───────────────────────────────────────────────────────────────────────────

const RewardGrant = sequelize.define(
  'reward_grants',
  {
    id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },

    user_id: { type: Sequelize.INTEGER, allowNull: false },

    source_kind: {
      type: Sequelize.ENUM('reward_rule', 'referral_link'),
      allowNull: false,
    },
    reward_rule_id: { type: Sequelize.INTEGER, allowNull: true },
    referral_link_id: { type: Sequelize.INTEGER, allowNull: true },
    referral_event_id: { type: Sequelize.INTEGER, allowNull: true },

    /** المرحلة التي أطلقت الدفعة — للإحالات. */
    milestone: { type: Sequelize.STRING(40), allowNull: true },
    /** الطرف المستفيد — referrer أو referee. */
    party: { type: Sequelize.STRING(20), allowNull: true },

    /** ما أطلق المنحة: رقم طلب، عدّاد استخدام، معرّف حدث… */
    event_reference: { type: Sequelize.STRING(200), allowNull: true },

    /** نسخة ثابتة من المبلغ وقت المنح. */
    value_snapshot: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },

    status: {
      type: Sequelize.ENUM('pending', 'granted', 'held', 'revoked'),
      allowNull: false,
      defaultValue: 'pending',
    },

    credit_transaction_id: { type: Sequelize.INTEGER, allowNull: true },
    /** حركة الاسترجاع التعويضية إن أُلغيت المنحة. */
    reversal_transaction_id: { type: Sequelize.INTEGER, allowNull: true },

    idempotency_key: { type: Sequelize.STRING(200), allowNull: false, unique: true },

    revoked_by: { type: Sequelize.INTEGER, allowNull: true },
    revoked_at: { type: Sequelize.DATE, allowNull: true },
    revoke_reason: { type: Sequelize.STRING(500), allowNull: true },

    metadata: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
  },
  {
    indexes: [
      { unique: true, fields: ['idempotency_key'] },
      { fields: ['user_id', 'createdAt'] },
      { fields: ['reward_rule_id', 'user_id'] },
      { fields: ['referral_event_id'] },
      { fields: ['status'] },
    ],
  }
);

module.exports = RewardGrant;
