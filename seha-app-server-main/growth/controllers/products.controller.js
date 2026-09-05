// المنتجات — اشتراكات وحزم رصيد. كل قيمة هنا يعدّلها الأدمن وتسري فوراً
// على الطلبات اللاحقة، بينما الطلبات السابقة تحتفظ بلقطتها.

const { Op } = require('sequelize');
const { GrowthProduct } = require('../models');
const analytics = require('../services/analytics.service');
const audit = require('../services/audit.service');
const { handle, ok } = require('../middlewares/growthAuth');
const { err } = require('../errors');
const INV = require('../config/invariants');

const EDITABLE = [
  'name', 'description', 'kind', 'billing_cycle', 'price', 'currency',
  'credits_granted', 'features', 'trial_days', 'is_active', 'is_visible',
  'sort_order', 'metadata',
];

function sanitize(body) {
  const out = {};
  for (const f of EDITABLE) if (Object.hasOwn(body, f)) out[f] = body[f];

  if (out.price !== undefined) {
    const p = parseFloat(out.price);
    if (!Number.isFinite(p) || p < 0) throw err.validation('السعر غير صالح');
    out.price = p;
  }
  if (out.credits_granted !== undefined) {
    const c = parseInt(out.credits_granted, 10);
    if (!Number.isFinite(c) || c < 0) throw err.validation('عدد الأرصدة غير صالح');
    out.credits_granted = INV.clamp(c, INV.HARD_MAX_SINGLE_GRANT);
  }
  if (out.trial_days !== undefined) {
    const t = parseInt(out.trial_days, 10) || 0;
    out.trial_days = INV.clamp(Math.max(0, t), INV.RANGES.trialDays.max);
  }
  // الاشتراك يحتاج دورة فوترة؛ حزمة الرصيد لا تحتاجها ولا تُخزَّن لها.
  if (out.kind === 'credit_pack') out.billing_cycle = null;
  if (out.kind === 'subscription' && !out.billing_cycle) {
    throw err.validation('الاشتراك يحتاج دورة فوترة');
  }
  return out;
}

const slugify = (s) =>
  String(s || '').trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 150);

exports.list = handle(async (req, res) => {
  const { kind, active, q } = req.query;
  const where = {};
  if (kind) where.kind = kind;
  if (active === 'true') where.is_active = true;
  if (active === 'false') where.is_active = false;
  if (q) where.name = { [Op.iLike]: `%${q}%` };

  const products = await GrowthProduct.findAll({
    where, order: [['sort_order', 'ASC'], ['id', 'ASC']],
  });
  const performance = await analytics.productPerformance();
  const byId = Object.fromEntries(performance.map((p) => [p.id, p]));

  return ok(res, products.map((p) => ({
    ...p.get({ plain: true }),
    stats: byId[p.id] || { orders: 0, buyers: 0, revenue: 0, active_subscribers: 0 },
  })));
});

/** المنتجات المرئية للعميل — بلا مصادقة، بلا حقول داخلية. */
exports.storefront = handle(async (req, res) => {
  const products = await GrowthProduct.findAll({
    where: { is_active: true, is_visible: true },
    attributes: [
      'id', 'name', 'slug', 'description', 'kind', 'billing_cycle',
      'price', 'currency', 'credits_granted', 'features', 'trial_days', 'sort_order',
    ],
    order: [['sort_order', 'ASC'], ['id', 'ASC']],
  });
  return ok(res, products);
});

exports.get = handle(async (req, res) => {
  const product = await GrowthProduct.findByPk(req.params.id);
  if (!product) throw err.notFound('المنتج');
  return ok(res, product);
});

exports.create = handle(async (req, res) => {
  const payload = sanitize(req.body);
  if (!payload.name) throw err.validation('اسم المنتج مطلوب');

  const slug = slugify(req.body.slug || payload.name) || `product-${Date.now()}`;
  const exists = await GrowthProduct.findOne({ where: { slug }, paranoid: false });
  if (exists) throw err.conflict('يوجد منتج بنفس المُعرِّف');

  const product = await GrowthProduct.create({ ...payload, slug, created_by: req.user.id });

  await audit.log({
    actor: req.user, action: 'product.create', resourceType: 'growth_product',
    resourceId: product.id,
    after: { name: product.name, price: product.price, credits_granted: product.credits_granted },
    req, severity: 'critical',
  });

  return ok(res, product, 'تم إنشاء المنتج', 201);
});

exports.update = handle(async (req, res) => {
  const product = await GrowthProduct.findByPk(req.params.id);
  if (!product) throw err.notFound('المنتج');

  const payload = sanitize(req.body);
  const before = audit.snapshot(product, EDITABLE);
  await product.update(payload);
  const changes = audit.diff(before, product, EDITABLE);

  if (changes.changed) {
    await audit.log({
      actor: req.user, action: 'product.update', resourceType: 'growth_product',
      resourceId: product.id, before: changes.before, after: changes.after,
      reason: req.body.reason || null, req, severity: 'critical',
    });
  }

  return ok(res, product, 'تم حفظ التعديلات');
});

/** ترتيب البطاقات بالسحب والإفلات. */
exports.reorder = handle(async (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order)) throw err.validation('الترتيب يجب أن يكون مصفوفة معرّفات');

  await Promise.all(order.map((id, index) =>
    GrowthProduct.update({ sort_order: index }, { where: { id } })));

  await audit.log({
    actor: req.user, action: 'product.reorder', resourceType: 'growth_product',
    resourceId: null, after: { order }, req, severity: 'info',
  });

  return ok(res, { order }, 'تم حفظ الترتيب');
});

exports.remove = handle(async (req, res) => {
  const product = await GrowthProduct.findByPk(req.params.id);
  if (!product) throw err.notFound('المنتج');

  const before = audit.snapshot(product, ['name', 'price', 'is_active']);
  await product.destroy(); // حذف ناعم — الطلبات السابقة تبقى سليمة

  await audit.log({
    actor: req.user, action: 'product.delete', resourceType: 'growth_product',
    resourceId: product.id, before, reason: req.body?.reason || null,
    req, severity: 'critical',
  });

  return ok(res, { deleted: true }, 'تم حذف المنتج');
});
