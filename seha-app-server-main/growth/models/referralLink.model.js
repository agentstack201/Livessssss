const Sequelize = require('sequelize');
const sequelize = require('../../config/database');

// ───────────────────────────────────────────────────────────────────────────
// رابط الإحالة — يسند مستخدماً جديداً إلى مستخدم قائم، ويدفع لطرف ثالث عبر
// دورة حياة. يختلف جوهرياً عن الكوبون: الكوبون يغيّر سعراً لحامله الآن،
// والرابط يدفع لشخص آخر لاحقاً عند بلوغ مرحلة.
//
// payout_schedule: مصفوفة دفعات موزّعة على المراحل، مثال:
//   [ { milestone: 'verified',       party: 'referee',  amount: 25 },
//     { milestone: 'activated',      party: 'referrer', amount: 20 },
//     { milestone: 'first_purchase', party: 'referrer', amount: 30 } ]
//
// لماذا التقسيم؟ دفعة واحدة عند التسجيل تُغري بالمزارع، ودفعة واحدة عند
// الشراء تُبطئ التحفيز. التقسيم يعطي المُحيل دفعة سريعة تُبقيه يُحيل، ويربط
// معظم التكلفة بإيراد فعلي. المراحل مُقيَّدة بـ invariants.PAYOUT_MILESTONES
// فلا يستطيع الأدمن اختراع مرحلة لا تعرفها آلة الحالة.
// ───────────────────────────────────────────────────────────────────────────

const ReferralLink = sequelize.define(
  'referral_links',
  {
    id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },

    /** صاحب الرابط — من يُدفع له. */
    owner_id: { type: Sequelize.INTEGER, allowNull: false },

    code: { type: Sequelize.STRING(24), allowNull: false, unique: true },

    type: {
      type: Sequelize.ENUM('personal', 'campaign', 'invitation'),
      allowNull: false,
      defaultValue: 'personal',
    },

    campaign_id: { type: Sequelize.INTEGER, allowNull: true },

    label: { type: Sequelize.STRING(150), allowNull: true },

    /** جدول الدفعات. يُتحقّق من كل عنصر عند الحفظ ضد المراحل والسقوف الصلبة. */
    payout_schedule: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },

    max_uses: { type: Sequelize.INTEGER, allowNull: true },
    times_used: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },

    /** إجمالي ما دُفع فعلاً عبر هذا الرابط — لمراقبة التكلفة وسقف الحملة. */
    total_paid_out: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },

    expires_at: { type: Sequelize.DATE, allowNull: true },
    is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },

    created_by: { type: Sequelize.INTEGER, allowNull: true },
  },
  {
    indexes: [
      { unique: true, fields: ['code'] },
      { fields: ['owner_id', 'is_active'] },
      { fields: ['campaign_id'] },
    ],
  }
);

module.exports = ReferralLink;
