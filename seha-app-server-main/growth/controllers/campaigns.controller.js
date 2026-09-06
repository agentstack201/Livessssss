// الحملات — مجلّد له ميزانية وساعة. لا يملك آلية خاصة به.
// إنشاء حملة لا يستلزم إنشاء أي كائن آخر، وكل أداة تعمل بلا حملة.

const { Op } = require('sequelize');
const { Campaign, Coupon, ReferralLink, RewardRule, GrowthProduct } = require('../models');
const analytics = require('../services/analytics.service');
const audit = require('../services/audit.service');
const { handle, ok } = require('../middlewares/growthAuth');
const { err } = require('../errors');

const EDITABLE = [
  'name', 'description', 'type', 'status', 'start_date', 'end_date',
  'budget', 'target_audience', 'target_product_id',
];

// قوائم مغلقة على مستوى قاعدة البيانات (ENUM). بدون فحصها هنا يمرّ المدخل
// الخاطئ إلى INSERT فيرتدّ خطأ Postgres خاماً كـ 500 مبهم بدل رسالة تقول
// للمشغّل ما المسموح.
// تُقرأ من النموذج لا تُكتب يدوياً، وإلا افترقت القائمتان عند أول تعديل.
const ENUMS = Object.fromEntries(
  ['type', 'status', 'target_audience'].map((f) => [f, Campaign.rawAttributes[f].values])
);

const slugify = (s) =>
  String(s || '').trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 120);

function pick(body) {
  const out = {};
  for (const f of EDITABLE) if (Object.hasOwn(body, f)) out[f] = body[f];

  for (const [field, allowed] of Object.entries(ENUMS)) {
    if (out[field] !== undefined && !allowed.includes(out[field])) {
      throw err.validation(`قيمة «${field}» غير مسموحة. المسموح: ${allowed.join(', ')}`);
    }
  }

  if (out.budget !== undefined && out.budget !== null && out.budget !== '') {
    const b = parseFloat(out.budget);
    if (!Number.isFinite(b) || b < 0) throw err.validation('الميزانية غير صالحة');
    out.budget = b;
  }
  if (out.start_date && out.end_date && new Date(out.end_date) <= new Date(out.start_date)) {
    throw err.validation('تاريخ الانتهاء يجب أن يكون بعد تاريخ البدء');
  }
  return out;
}

exports.list = handle(async (req, res) => {
  const { status, q } = req.query;
  const where = {};
  if (status) where.status = status;
  if (q) where.name = { [Op.iLike]: `%${q}%` };

  const campaigns = await Campaign.findAll({ where, order: [['id', 'DESC']] });
  const performance = await analytics.campaignPerformance({ limit: 100 });
  const byId = Object.fromEntries(performance.map((p) => [p.id, p]));

  return ok(res, campaigns.map((c) => ({
    ...c.get({ plain: true }),
    stats: byId[c.id] || { orders: 0, buyers: 0, revenue: 0, roi: null },
    budget_pct: c.budget ? Math.round((Number(c.budget_used) / Number(c.budget)) * 100) : null,
  })));
});

exports.get = handle(async (req, res) => {
  const campaign = await Campaign.findByPk(req.params.id, {
    include: [{ model: GrowthProduct, as: 'targetProduct', attributes: ['id', 'name'] }],
  });
  if (!campaign) throw err.notFound('الحملة');

  // الأدوات المرتبطة — يراها المشغّل في مكان واحد بدل التنقّل بين ثلاث صفحات.
  const [coupons, links, rules, performance] = await Promise.all([
    Coupon.findAll({ where: { campaign_id: campaign.id }, attributes: ['id', 'code', 'times_used', 'is_active'] }),
    ReferralLink.findAll({ where: { campaign_id: campaign.id }, attributes: ['id', 'code', 'times_used', 'total_paid_out'] }),
    RewardRule.findAll({ where: { campaign_id: campaign.id }, attributes: ['id', 'name', 'reward_value', 'total_granted'] }),
    analytics.campaignPerformance({ limit: 100 }),
  ]);

  return ok(res, {
    campaign,
    tools: { coupons, referral_links: links, reward_rules: rules },
    stats: performance.find((p) => p.id === campaign.id) || null,
  });
});

exports.create = handle(async (req, res) => {
  const payload = pick(req.body);
  if (!payload.name) throw err.validation('اسم الحملة مطلوب');

  const slug = slugify(req.body.slug || payload.name) || `campaign-${Date.now()}`;
  const exists = await Campaign.findOne({ where: { slug }, paranoid: false });
  if (exists) throw err.conflict('يوجد حملة بنفس المُعرِّف');

  const campaign = await Campaign.create({ ...payload, slug, created_by: req.user.id });

  await audit.log({
    actor: req.user, action: 'campaign.create', resourceType: 'campaign', resourceId: campaign.id,
    after: { name: campaign.name, budget: campaign.budget, status: campaign.status },
    req, severity: 'notice',
  });

  return ok(res, campaign, 'تم إنشاء الحملة', 201);
});

exports.update = handle(async (req, res) => {
  const campaign = await Campaign.findByPk(req.params.id);
  if (!campaign) throw err.notFound('الحملة');

  const before = audit.snapshot(campaign, EDITABLE);
  await campaign.update(pick(req.body));
  const changes = audit.diff(before, campaign, EDITABLE);

  if (changes.changed) {
    await audit.log({
      actor: req.user, action: 'campaign.update', resourceType: 'campaign', resourceId: campaign.id,
      before: changes.before, after: changes.after, req, severity: 'critical',
    });
  }

  return ok(res, campaign, 'تم حفظ التعديلات');
});

exports.remove = handle(async (req, res) => {
  const campaign = await Campaign.findByPk(req.params.id);
  if (!campaign) throw err.notFound('الحملة');

  // فكّ ارتباط الأدوات بدل حذفها: الكوبون المرتبط بحملة محذوفة يبقى صالحاً
  // وحده، وحذفه معها يفاجئ عملاء يحملونه.
  await Promise.all([
    Coupon.update({ campaign_id: null }, { where: { campaign_id: campaign.id } }),
    ReferralLink.update({ campaign_id: null }, { where: { campaign_id: campaign.id } }),
    RewardRule.update({ campaign_id: null }, { where: { campaign_id: campaign.id } }),
  ]);

  const before = audit.snapshot(campaign, ['name', 'status', 'budget']);
  await campaign.destroy();

  await audit.log({
    actor: req.user, action: 'campaign.delete', resourceType: 'campaign', resourceId: campaign.id,
    before, reason: req.body?.reason || null, req, severity: 'critical',
  });

  return ok(res, { deleted: true }, 'تم حذف الحملة وفكّ ارتباط أدواتها');
});

exports.performance = handle(async (req, res) => {
  const rows = await analytics.campaignPerformance({ limit: parseInt(req.query.limit, 10) || 20 });
  return ok(res, rows);
});
