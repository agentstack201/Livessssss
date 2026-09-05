// سطح التعمّق في المستخدم — أكبر فجوة كانت في التصميم الأول.
//
// وكيل الدعم يسأل باستمرار: «المستخدم أحمد — كم رصيده؟ ما تاريخه؟ هل أُحيل؟
// ماذا اشترى؟» وبدون هذا المسار كان عليه القفز بين خمس صفحات. هنا كل ذلك في
// نداء واحد.

const { Op } = require('sequelize');
const {
  User, GrowthProfile, CreditTransaction, GrowthOrder,
  ReferralEvent, ReferralLink, RewardGrant, CouponRedemption, GrowthProduct,
} = require('../models');
const credits = require('../services/credit.service');
const { handle, ok } = require('../middlewares/growthAuth');
const { err } = require('../errors');

/** بحث عام — يخدم شريط البحث الحاضر في كل صفحات اللوحة. */
exports.search = handle(async (req, res) => {
  const { q } = req.query;
  if (!q?.trim() || q.trim().length < 2) return ok(res, []);

  const term = q.trim();
  const where = /^\d+$/.test(term)
    ? { id: Number(term) }
    : {
      [Op.or]: [
        { name: { [Op.iLike]: `%${term}%` } },
        { email: { [Op.iLike]: `%${term}%` } },
      ],
    };

  const users = await User.findAll({
    where, attributes: ['id', 'name', 'email', 'role'], limit: 15, order: [['id', 'DESC']],
  });
  if (!users.length) return ok(res, []);

  const profiles = await GrowthProfile.findAll({ where: { user_id: users.map((u) => u.id) } });
  const byUser = Object.fromEntries(profiles.map((p) => [p.user_id, p]));

  return ok(res, users.map((u) => ({
    id: u.id, name: u.name, email: u.email, role: u.role,
    credit_balance: byUser[u.id]?.credit_balance ?? null,
    subscription_status: byUser[u.id]?.subscription_status ?? 'none',
  })));
});

/** الملف الكامل لمستخدم واحد. */
exports.profile = handle(async (req, res) => {
  const userId = req.params.userId;
  const user = await User.findByPk(userId, { attributes: ['id', 'name', 'email', 'role', 'createdAt'] });
  if (!user) throw err.notFound('المستخدم');

  const profile = await credits.ensureProfile(userId);

  const [ledger, orders, referredBy, ownLinks, referralsMade, grants, couponUses, product] =
    await Promise.all([
      CreditTransaction.findAll({
        where: { user_id: userId }, order: [['id', 'DESC']], limit: 50,
        include: [{ model: User, as: 'actor', attributes: ['id', 'name'] }],
      }),
      GrowthOrder.findAll({ where: { user_id: userId }, order: [['id', 'DESC']], limit: 25 }),
      ReferralEvent.findOne({
        where: { referee_id: userId },
        include: [
          { model: User, as: 'referrer', attributes: ['id', 'name', 'email'] },
          { model: ReferralLink, as: 'link', attributes: ['id', 'code'] },
        ],
      }),
      ReferralLink.findAll({ where: { owner_id: userId }, attributes: ['id', 'code', 'times_used', 'total_paid_out', 'is_active'] }),
      ReferralEvent.count({ where: { referrer_id: userId, activated_at: { [Op.ne]: null } } }),
      RewardGrant.findAll({
        where: { user_id: userId }, order: [['id', 'DESC']], limit: 25,
      }),
      CouponRedemption.findAll({ where: { user_id: userId }, order: [['id', 'DESC']], limit: 25 }),
      profile.current_product_id ? GrowthProduct.findByPk(profile.current_product_id) : null,
    ]);

  return ok(res, {
    user,
    profile,
    current_product: product,
    credit: {
      balance: profile.credit_balance,
      reward_debt: profile.reward_debt,
      earned: profile.lifetime_credits_earned,
      spent: profile.lifetime_credits_spent,
    },
    funnel: {
      registered_at: user.createdAt,
      verified_at: profile.verified_at,
      activated_at: profile.activated_at,
      first_paid_at: profile.first_paid_at,
      last_active_at: profile.last_active_at,
      documents_created: profile.documents_created,
    },
    ledger,
    orders,
    referral: {
      referred_by: referredBy,
      own_links: ownLinks,
      activated_referrals: referralsMade,
    },
    reward_grants: grants,
    coupon_redemptions: couponUses,
  });
});

/** ملفي — لواجهة العميل. */
exports.me = handle(async (req, res) => {
  const profile = await credits.ensureProfile(req.user.id);
  const product = profile.current_product_id
    ? await GrowthProduct.findByPk(profile.current_product_id, {
      attributes: ['id', 'name', 'kind', 'features', 'billing_cycle'],
    })
    : null;

  return ok(res, {
    credit_balance: profile.credit_balance,
    subscription_status: profile.subscription_status,
    subscription_expires_at: profile.subscription_expires_at,
    current_product: product,
    referral_code: profile.personal_referral_code,
    is_verified: profile.is_verified,
  });
});
