const Sequelize = require('sequelize');
const sequelize = require('../../config/database');

// ───────────────────────────────────────────────────────────────────────────
// حدث الإحالة — صفّ واحد يمثّل رحلة مُحال إليه كاملة عبر القمع.
//
// المراحل (آلة حالة في الكود، غير قابلة للضبط):
//   clicked → registered → verified → activated → meaningful_action
//           → first_purchase → retained
//
// stage_reached يحفظ أبعد مرحلة بُلغت، وأعمدة _at تحفظ توقيت كل مرحلة —
// وهذا ما يجعل حساب القمع استعلاماً واحداً بدل مسح الدفتر.
//
// fraud_score رقم 0–100، و fraud_reasons مصفوفة أكواد أسباب. الرقم وحده لا
// يكفي: المشغّل يحتاج أن يرى «لماذا» وإلا لن يثق بالتعليق ويتجاهله.
//
// ملاحظة خاصة بهذا المنتج: مستخدموه أطباء وموظفو مستشفيات خلف NAT مشترك،
// فتطابق الـ IP هنا هو القاعدة لا الاستثناء — ولذلك وزنه ضئيل وحده.
// ───────────────────────────────────────────────────────────────────────────

const ReferralEvent = sequelize.define(
  'referral_events',
  {
    id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },

    referral_link_id: { type: Sequelize.INTEGER, allowNull: false },
    referrer_id: { type: Sequelize.INTEGER, allowNull: false },

    /** يبقى null حتى التسجيل. القيد الفريد أدناه جزئي لهذا السبب. */
    referee_id: { type: Sequelize.INTEGER, allowNull: true },

    stage_reached: {
      type: Sequelize.ENUM(
        'clicked', 'registered', 'verified', 'activated',
        'meaningful_action', 'first_purchase', 'retained', 'revoked'
      ),
      allowNull: false,
      defaultValue: 'clicked',
    },

    clicked_at: { type: Sequelize.DATE, allowNull: true },
    registered_at: { type: Sequelize.DATE, allowNull: true },
    verified_at: { type: Sequelize.DATE, allowNull: true },
    activated_at: { type: Sequelize.DATE, allowNull: true },
    meaningful_action_at: { type: Sequelize.DATE, allowNull: true },
    first_purchase_at: { type: Sequelize.DATE, allowNull: true },
    retained_at: { type: Sequelize.DATE, allowNull: true },

    // ── إشارات الاحتيال ───────────────────────────────────────────────────
    ip_address: { type: Sequelize.STRING(45), allowNull: true },
    user_agent: { type: Sequelize.TEXT, allowNull: true },
    fraud_score: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    /** أكواد أسباب مقروءة: ['same_ip_fast','disposable_email',…] */
    fraud_reasons: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },

    risk_band: {
      type: Sequelize.ENUM('low', 'medium', 'high'),
      allowNull: false,
      defaultValue: 'low',
    },

    /** hold = دفعة معلّقة بانتظار مراجعة أو إفراج تلقائي. */
    payout_status: {
      type: Sequelize.ENUM('none', 'partial', 'complete', 'hold', 'revoked'),
      allowNull: false,
      defaultValue: 'none',
    },
    hold_until: { type: Sequelize.DATE, allowNull: true },

    reviewed_by: { type: Sequelize.INTEGER, allowNull: true },
    reviewed_at: { type: Sequelize.DATE, allowNull: true },
    revoke_reason: { type: Sequelize.STRING(500), allowNull: true },

    metadata: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
  },
  {
    indexes: [
      { fields: ['referral_link_id'] },
      { fields: ['referrer_id', 'createdAt'] },
      { fields: ['referee_id'] },
      { fields: ['stage_reached'] },
      { fields: ['risk_band', 'payout_status'] },
      { fields: ['payout_status', 'hold_until'] },
    ],
  }
);

module.exports = ReferralEvent;
