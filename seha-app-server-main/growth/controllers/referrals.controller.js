// الإحالات — الروابط والقمع وطابور المراجعة.
// التتبّع العام (track) بلا مصادقة: النقرة تسبق وجود الحساب.

const { Op } = require('sequelize');
const {
  ReferralLink, ReferralEvent, RewardGrant, User, Campaign, GrowthProfile,
} = require('../models');
const referrals = require('../services/referral.service');
const analytics = require('../services/analytics.service');
const credits = require('../services/credit.service');
const audit = require('../services/audit.service');
const { handle, ok } = require('../middlewares/growthAuth');
const { err } = require('../errors');

const EDITABLE = [
  'label', 'type', 'campaign_id', 'payout_schedule',
  'max_uses', 'expires_at', 'is_active',
];

exports.listLinks = handle(async (req, res) => {
  const { q, active, campaign_id: campaignId } = req.query;
  const where = {};
  if (active === 'true') where.is_active = true;
  if (active === 'false') where.is_active = false;
  if (campaignId) where.campaign_id = campaignId;
  if (q) where.code = { [Op.iLike]: `%${q}%` };

  const links = await ReferralLink.findAll({
    where,
    include: [
      { model: User, as: 'owner', attributes: ['id', 'name', 'email'] },
      { model: Campaign, as: 'campaign', attributes: ['id', 'name'] },
    ],
    order: [['id', 'DESC']],
  });

  // قمع مختصر لكل رابط — الرابط بلا أرقام لا يخبر المشغّل بشيء.
  const stats = await ReferralEvent.findAll({
    attributes: [
      'referral_link_id',
      [ReferralEvent.sequelize.fn('COUNT', ReferralEvent.sequelize.col('id')), 'clicks'],
      [ReferralEvent.sequelize.fn('COUNT', ReferralEvent.sequelize.col('registered_at')), 'registered'],
      [ReferralEvent.sequelize.fn('COUNT', ReferralEvent.sequelize.col('activated_at')), 'activated'],
      [ReferralEvent.sequelize.fn('COUNT', ReferralEvent.sequelize.col('first_purchase_at')), 'purchased'],
    ],
    group: ['referral_link_id'],
    raw: true,
  });
  const byLink = Object.fromEntries(stats.map((s) => [s.referral_link_id, s]));

  return ok(res, links.map((l) => ({
    ...l.get({ plain: true }),
    stats: byLink[l.id] || { clicks: 0, registered: 0, activated: 0, purchased: 0 },
  })));
});

exports.createLink = handle(async (req, res) => {
  const { owner_id: ownerId, code, payout_schedule: schedule } = req.body;
  const target = ownerId || req.user.id;

  const owner = await User.findByPk(target);
  if (!owner) throw err.notFound('صاحب الرابط');

  const validated = referrals.validatePayoutSchedule(schedule || []);

  const finalCode = String(code || '').trim() || credits.randomCode(8);
  const exists = await ReferralLink.findOne({ where: { code: finalCode } });
  if (exists) throw err.conflict('هذا الرمز مستخدم بالفعل');

  const link = await ReferralLink.create({
    owner_id: target,
    code: finalCode,
    type: req.body.type || 'personal',
    campaign_id: req.body.campaign_id || null,
    label: req.body.label || null,
    payout_schedule: validated,
    max_uses: req.body.max_uses ?? null,
    expires_at: req.body.expires_at || null,
    created_by: req.user.id,
  });

  await audit.log({
    actor: req.user, action: 'referral.link_create', resourceType: 'referral_link',
    resourceId: link.id,
    after: { code: link.code, owner_id: target, payout_schedule: validated },
    req, severity: 'critical',
  });

  return ok(res, link, 'تم إنشاء الرابط', 201);
});

exports.updateLink = handle(async (req, res) => {
  const link = await ReferralLink.findByPk(req.params.id);
  if (!link) throw err.notFound('الرابط');

  const patch = {};
  for (const f of EDITABLE) if (Object.hasOwn(req.body, f)) patch[f] = req.body[f];
  if (patch.payout_schedule) {
    patch.payout_schedule = referrals.validatePayoutSchedule(patch.payout_schedule);
  }

  const before = audit.snapshot(link, EDITABLE);
  await link.update(patch);
  const changes = audit.diff(before, link, EDITABLE);

  if (changes.changed) {
    await audit.log({
      actor: req.user, action: 'referral.link_update', resourceType: 'referral_link',
      resourceId: link.id, before: changes.before, after: changes.after,
      req, severity: 'critical',
    });
  }

  return ok(res, link, 'تم حفظ التعديلات');
});

exports.funnel = handle(async (req, res) => {
  const [funnel, health, top] = await Promise.all([
    referrals.funnel({ linkId: req.query.link_id || null, from: req.query.from, to: req.query.to }),
    analytics.referralHealth(),
    analytics.topReferrers({ limit: 10 }),
  ]);
  return ok(res, { funnel, health, top_referrers: top });
});

exports.events = handle(async (req, res) => {
  const { filter, link_id: linkId, page = 1, limit = 50 } = req.query;
  const where = {};
  if (linkId) where.referral_link_id = linkId;
  if (filter === 'held') where.payout_status = 'hold';
  if (filter === 'high_risk') where.risk_band = 'high';
  if (filter === 'revoked') where.payout_status = 'revoked';

  const take = Math.min(parseInt(limit, 10) || 50, 200);
  const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * take;

  const { rows, count } = await ReferralEvent.findAndCountAll({
    where,
    include: [
      { model: User, as: 'referrer', attributes: ['id', 'name', 'email'] },
      { model: User, as: 'referee', attributes: ['id', 'name', 'email'] },
      { model: ReferralLink, as: 'link', attributes: ['id', 'code', 'label'] },
      { model: RewardGrant, as: 'grants', attributes: ['id', 'party', 'milestone', 'value_snapshot', 'status'] },
    ],
    order: [['id', 'DESC']],
    limit: take,
    offset: skip,
  });

  return ok(res, {
    events: rows,
    pagination: { page: Number(page), limit: take, total: count, pages: Math.ceil(count / take) },
  });
});

/**
 * إفراج جماعي عن الدفعات متوسطة المخاطر التي انقضت مدّة تعليقها.
 *
 * كانت الدالة مُعرَّفة بلا مستدعٍ، فكان `fraud.auto_release_days` إعداداً
 * شبحاً: يُعدَّل من اللوحة ولا يفعل شيئاً، وتبقى المكافآت معلّقة إلى الأبد.
 * لا مُجدوِل في هذا النشر، فالإفراج فعل صريح يشغّله المشغّل من طابور المراجعة.
 */
exports.releaseExpired = handle(async (req, res) => {
  const result = await referrals.autoReleaseExpiredHolds({ req });
  return ok(res, result, result.released
    ? `أُفرج عن ${result.released} مكافأة انقضت مدّة تعليقها`
    : 'لا مكافآت انقضت مدّة تعليقها بعد');
});

exports.releaseGrant = handle(async (req, res) => {
  const result = await referrals.releaseHeldGrant({
    grantId: req.params.grantId, actor: req.user, req,
  });
  return ok(res, result, 'تم الإفراج عن المكافأة ومنحها');
});

exports.revokeGrant = handle(async (req, res) => {
  const { reason } = req.body;
  if (!reason?.trim()) throw err.reasonRequired();
  const result = await referrals.revokeGrant({
    grantId: req.params.grantId, reason, actor: req.user, req,
  });
  return ok(res, result, result.shortfall > 0
    ? `تم الإلغاء. استُرجع ${result.recovered} وسُجّل ${result.shortfall} ديناً`
    : 'تم إلغاء المكافأة واسترجاع الرصيد');
});

/** تتبّع نقرة — عام، بلا مصادقة. */
exports.track = handle(async (req, res) => {
  const result = await referrals.trackClick(req.params.code, { req });
  return ok(res, result);
});

/** رابطي الشخصي — لواجهة العميل. */
exports.myLink = handle(async (req, res) => {
  const profile = await credits.ensureProfile(req.user.id);
  let link = await ReferralLink.findOne({
    where: { owner_id: req.user.id, type: 'personal', is_active: true },
  });

  // لا يُنشأ رابط شخصي إلا بجدول دفعات مضبوط من اللوحة — وإلا كان رابطاً
  // بلا مكافأة، وهو وعد فارغ للمستخدم.
  if (!link) {
    return ok(res, {
      code: profile.personal_referral_code,
      link: null,
      message: 'برنامج الإحالة غير مفعّل حالياً',
    });
  }

  const events = await ReferralEvent.count({ where: { referral_link_id: link.id } });
  const activated = await ReferralEvent.count({
    where: { referral_link_id: link.id, activated_at: { [Op.ne]: null } },
  });
  const earned = await RewardGrant.sum('value_snapshot', {
    where: { user_id: req.user.id, party: 'referrer', status: 'granted' },
  });

  return ok(res, {
    code: link.code,
    payout_schedule: link.payout_schedule,
    stats: { clicks: events, activated, credits_earned: Number(earned) || 0 },
  });
});
