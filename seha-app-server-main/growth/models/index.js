// ───────────────────────────────────────────────────────────────────────────
// نماذج وحدة النمو وعلاقاتها — نقطة الاستيراد الوحيدة.
//
// العلاقات مع جدول users تُعلَن هنا لا في config/models_associations.js
// الخاص بالمشروع، حتى تبقى الوحدة قابلة للفصل: حذف مجلد growth/ وسطرَي
// التركيب يزيلها بالكامل دون أن يترك أثراً في ملفات المشروع الأصلية.
// ───────────────────────────────────────────────────────────────────────────

const User = require('../../models/user.model');

const GrowthProduct = require('./growthProduct.model');
const GrowthOrder = require('./growthOrder.model');
const GrowthProfile = require('./growthProfile.model');
const CreditTransaction = require('./creditTransaction.model');
const Coupon = require('./coupon.model');
const CouponRedemption = require('./couponRedemption.model');
const ReferralLink = require('./referralLink.model');
const ReferralEvent = require('./referralEvent.model');
const Campaign = require('./campaign.model');
const RewardRule = require('./rewardRule.model');
const RewardGrant = require('./rewardGrant.model');
const GrowthRole = require('./growthRole.model');
const GrowthUserRole = require('./growthUserRole.model');
const GrowthAuditLog = require('./growthAuditLog.model');
const GrowthSetting = require('./growthSetting.model');

// ── المستخدم ↔ الملف التجاري ───────────────────────────────────────────────
User.hasOne(GrowthProfile, { foreignKey: 'user_id', as: 'growthProfile' });
GrowthProfile.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// ── الدفتر ─────────────────────────────────────────────────────────────────
User.hasMany(CreditTransaction, { foreignKey: 'user_id', as: 'creditTransactions' });
CreditTransaction.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
CreditTransaction.belongsTo(User, { foreignKey: 'performed_by', as: 'actor' });

// ── الطلبات ────────────────────────────────────────────────────────────────
User.hasMany(GrowthOrder, { foreignKey: 'user_id', as: 'orders' });
GrowthOrder.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
GrowthOrder.belongsTo(User, { foreignKey: 'approved_by', as: 'approver' });
// للنسب فقط — عرض الطلب يستعمل أعمدة اللقطة لا هذه العلاقة.
GrowthProduct.hasMany(GrowthOrder, { foreignKey: 'product_id', as: 'orders' });
GrowthOrder.belongsTo(GrowthProduct, { foreignKey: 'product_id', as: 'product' });
GrowthOrder.belongsTo(Campaign, { foreignKey: 'campaign_id', as: 'campaign' });
GrowthOrder.belongsTo(ReferralLink, { foreignKey: 'referral_link_id', as: 'referralLink' });
GrowthOrder.belongsTo(Coupon, { foreignKey: 'coupon_id', as: 'coupon' });

// ── الاشتراك الحالي ────────────────────────────────────────────────────────
GrowthProfile.belongsTo(GrowthProduct, { foreignKey: 'current_product_id', as: 'currentProduct' });

// ── الكوبونات ──────────────────────────────────────────────────────────────
Coupon.hasMany(CouponRedemption, { foreignKey: 'coupon_id', as: 'redemptions' });
CouponRedemption.belongsTo(Coupon, { foreignKey: 'coupon_id', as: 'coupon' });
CouponRedemption.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
CouponRedemption.belongsTo(GrowthOrder, { foreignKey: 'order_id', as: 'order' });
Campaign.hasMany(Coupon, { foreignKey: 'campaign_id', as: 'coupons' });
Coupon.belongsTo(Campaign, { foreignKey: 'campaign_id', as: 'campaign' });

// ── الإحالة ────────────────────────────────────────────────────────────────
User.hasMany(ReferralLink, { foreignKey: 'owner_id', as: 'referralLinks' });
ReferralLink.belongsTo(User, { foreignKey: 'owner_id', as: 'owner' });
ReferralLink.hasMany(ReferralEvent, { foreignKey: 'referral_link_id', as: 'events' });
ReferralEvent.belongsTo(ReferralLink, { foreignKey: 'referral_link_id', as: 'link' });
ReferralEvent.belongsTo(User, { foreignKey: 'referrer_id', as: 'referrer' });
ReferralEvent.belongsTo(User, { foreignKey: 'referee_id', as: 'referee' });
Campaign.hasMany(ReferralLink, { foreignKey: 'campaign_id', as: 'referralLinks' });
ReferralLink.belongsTo(Campaign, { foreignKey: 'campaign_id', as: 'campaign' });
GrowthProfile.belongsTo(ReferralLink, { foreignKey: 'referred_by_link_id', as: 'referredByLink' });

// ── المكافآت ───────────────────────────────────────────────────────────────
RewardRule.hasMany(RewardGrant, { foreignKey: 'reward_rule_id', as: 'grants' });
RewardGrant.belongsTo(RewardRule, { foreignKey: 'reward_rule_id', as: 'rule' });
RewardGrant.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
RewardGrant.belongsTo(ReferralEvent, { foreignKey: 'referral_event_id', as: 'referralEvent' });
RewardGrant.belongsTo(ReferralLink, { foreignKey: 'referral_link_id', as: 'referralLink' });
RewardGrant.belongsTo(CreditTransaction, { foreignKey: 'credit_transaction_id', as: 'transaction' });
ReferralEvent.hasMany(RewardGrant, { foreignKey: 'referral_event_id', as: 'grants' });
Campaign.hasMany(RewardRule, { foreignKey: 'campaign_id', as: 'rewardRules' });
RewardRule.belongsTo(Campaign, { foreignKey: 'campaign_id', as: 'campaign' });

// ── الأدوار ────────────────────────────────────────────────────────────────
User.belongsToMany(GrowthRole, {
  through: GrowthUserRole, foreignKey: 'user_id', otherKey: 'role_id', as: 'growthRoles',
});
GrowthRole.belongsToMany(User, {
  through: GrowthUserRole, foreignKey: 'role_id', otherKey: 'user_id', as: 'users',
});
GrowthUserRole.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
GrowthUserRole.belongsTo(GrowthRole, { foreignKey: 'role_id', as: 'role' });

// ── التدقيق ────────────────────────────────────────────────────────────────
GrowthAuditLog.belongsTo(User, { foreignKey: 'actor_id', as: 'actor' });

// ── الحملات ────────────────────────────────────────────────────────────────
Campaign.belongsTo(GrowthProduct, { foreignKey: 'target_product_id', as: 'targetProduct' });

module.exports = {
  User,
  GrowthProduct,
  GrowthOrder,
  GrowthProfile,
  CreditTransaction,
  Coupon,
  CouponRedemption,
  ReferralLink,
  ReferralEvent,
  Campaign,
  RewardRule,
  RewardGrant,
  GrowthRole,
  GrowthUserRole,
  GrowthAuditLog,
  GrowthSetting,
};
