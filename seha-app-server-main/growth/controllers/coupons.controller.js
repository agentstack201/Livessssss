// الكوبونات — إنشاء وتعديل وسجل استخدام وأداء.
// التحقّق العام (validate) يخدم واجهة العميل أثناء الكتابة ولا يستهلك سقفاً.

const { Op } = require('sequelize');
const { Coupon, CouponRedemption, User, Campaign } = require('../models');
const coupons = require('../services/coupon.service');
const audit = require('../services/audit.service');
const { handle, ok } = require('../middlewares/growthAuth');
const { err } = require('../errors');

const EDITABLE = [
  'code', 'name', 'discount_type', 'discount_value', 'max_discount_amount',
  'min_purchase_amount', 'usage_limit', 'per_user_limit', 'require_new_user',
  'applicable_product_ids', 'campaign_id', 'valid_from', 'valid_until', 'is_active',
];

function pick(body) {
  const out = {};
  for (const f of EDITABLE) if (Object.hasOwn(body, f)) out[f] = body[f];
  return out;
}

exports.list = handle(async (req, res) => {
  const { q, active, campaign_id: campaignId } = req.query;
  const where = {};
  if (active === 'true') where.is_active = true;
  if (active === 'false') where.is_active = false;
  if (campaignId) where.campaign_id = campaignId;
  if (q) {
    where[Op.or] = [
      { code: { [Op.iLike]: `%${q}%` } },
      { name: { [Op.iLike]: `%${q}%` } },
    ];
  }

  const rows = await Coupon.findAll({
    where,
    include: [{ model: Campaign, as: 'campaign', attributes: ['id', 'name'] }],
    order: [['id', 'DESC']],
  });

  // معدّل الاستخدام يظهر بجانب كل كوبون — الرقم وحده بلا سقف لا يعني شيئاً.
  return ok(res, rows.map((c) => {
    const plain = c.get({ plain: true });
    return {
      ...plain,
      usage_rate: c.usage_limit ? Math.round((c.times_used / c.usage_limit) * 100) : null,
      is_expired: c.valid_until ? new Date(c.valid_until) < new Date() : false,
    };
  }));
});

exports.get = handle(async (req, res) => {
  const coupon = await Coupon.findByPk(req.params.id);
  if (!coupon) throw err.notFound('الكوبون');
  const performance = await coupons.performance(coupon.id);
  return ok(res, { coupon, performance });
});

exports.create = handle(async (req, res) => {
  const payload = coupons.validateDefinition(pick(req.body));
  if (!payload.code) throw err.validation('رمز الكوبون مطلوب');

  const exists = await Coupon.findOne({ where: { code: payload.code }, paranoid: false });
  if (exists) throw err.conflict('هذا الرمز مستخدم بالفعل');

  const coupon = await Coupon.create({ ...payload, created_by: req.user.id });

  await audit.log({
    actor: req.user, action: 'coupon.create', resourceType: 'coupon', resourceId: coupon.id,
    after: {
      code: coupon.code, discount_type: coupon.discount_type,
      discount_value: coupon.discount_value, usage_limit: coupon.usage_limit,
    },
    req, severity: 'critical',
  });

  return ok(res, coupon, 'تم إنشاء الكوبون', 201);
});

exports.update = handle(async (req, res) => {
  const coupon = await Coupon.findByPk(req.params.id);
  if (!coupon) throw err.notFound('الكوبون');

  // نُدمج القائم بالوارد قبل التحقّق حتى يُفحص حاجز «حدّ واحد على الأقل»
  // على الحالة النهائية لا على الحقول المُرسَلة وحدها.
  const merged = { ...coupon.get({ plain: true }), ...pick(req.body) };
  const payload = coupons.validateDefinition(merged);

  const before = audit.snapshot(coupon, EDITABLE);
  await coupon.update(pick(payload));
  const changes = audit.diff(before, coupon, EDITABLE);

  if (changes.changed) {
    await audit.log({
      actor: req.user, action: 'coupon.update', resourceType: 'coupon', resourceId: coupon.id,
      before: changes.before, after: changes.after, req, severity: 'critical',
    });
  }

  return ok(res, coupon, 'تم حفظ التعديلات');
});

exports.remove = handle(async (req, res) => {
  const coupon = await Coupon.findByPk(req.params.id);
  if (!coupon) throw err.notFound('الكوبون');

  const before = audit.snapshot(coupon, ['code', 'discount_type', 'discount_value']);
  await coupon.destroy();

  await audit.log({
    actor: req.user, action: 'coupon.delete', resourceType: 'coupon', resourceId: coupon.id,
    before, reason: req.body?.reason || null, req, severity: 'critical',
  });

  return ok(res, { deleted: true }, 'تم حذف الكوبون');
});

exports.redemptions = handle(async (req, res) => {
  const rows = await CouponRedemption.findAll({
    where: { coupon_id: req.params.id },
    include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }],
    order: [['id', 'DESC']],
    limit: 200,
  });
  return ok(res, rows);
});

/** تحقّق آمن للعميل — يحسب الخصم ولا يغيّر شيئاً. */
exports.validate = handle(async (req, res) => {
  const { code, product_id: productId, amount } = req.body;
  const result = await coupons.validateForUse({
    code, userId: req.user?.id || null, productId, amount: Number(amount) || 0,
  });

  if (!result.valid) return ok(res, { valid: false, reason: result.reason });
  return ok(res, {
    valid: true,
    discount: result.discount,
    credits_granted: result.creditsGranted,
    net_amount: result.netAmount,
    code: result.coupon.code,
  });
});
