// الطلبات — الإنشاء واعتماد الدفع والاسترداد. طابور الاعتماد هو أكثر شاشة
// يزورها المشغّل يومياً، ولذلك الفلاتر والإجراءات فيها مباشرة بلا تعمّق.

const { Op } = require('sequelize');
const { GrowthOrder, User, GrowthProduct } = require('../models');
const orders = require('../services/order.service');
const settings = require('../services/settings.service');
const roles = require('../services/role.service');
const { handle, ok } = require('../middlewares/growthAuth');
const { err } = require('../errors');

exports.list = handle(async (req, res) => {
  const { status, q, from, to, page = 1, limit = 25 } = req.query;
  const where = {};
  if (status) where.status = status;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt[Op.gte] = new Date(from);
    if (to) where.createdAt[Op.lte] = new Date(to);
  }
  if (q) {
    where[Op.or] = [
      { reference: { [Op.iLike]: `%${q}%` } },
      { product_name_snapshot: { [Op.iLike]: `%${q}%` } },
      { coupon_code_snapshot: { [Op.iLike]: `%${q}%` } },
    ];
  }

  const take = Math.min(parseInt(limit, 10) || 25, 100);
  const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * take;

  const { rows, count } = await GrowthOrder.findAndCountAll({
    where,
    include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }],
    order: [['id', 'DESC']],
    limit: take,
    offset: skip,
  });

  return ok(res, {
    orders: rows,
    pagination: { page: Number(page), limit: take, total: count, pages: Math.ceil(count / take) },
  });
});

exports.get = handle(async (req, res) => {
  const order = await GrowthOrder.findByPk(req.params.id, {
    include: [
      { model: User, as: 'user', attributes: ['id', 'name', 'email'] },
      { model: User, as: 'approver', attributes: ['id', 'name'] },
    ],
  });
  if (!order) throw err.notFound('الطلب');
  return ok(res, order);
});

/** إنشاء طلب لمستخدم — من اللوحة أو من واجهة العميل. */
exports.create = handle(async (req, res) => {
  const { user_id: bodyUser, product_id: productId, coupon_code: couponCode, campaign_id: campaignId } = req.body;

  if (!productId) throw err.validation('المنتج مطلوب');

  // المشغّل ينشئ لغيره؛ العميل ينشئ لنفسه فقط.
  //
  // الفحص صريح عمداً بدل الاعتماد على req._growthPermissions: ذلك الحقل لا
  // يملؤه إلا requirePermission، ومسار /me/orders لا يمرّ به — فكان الأمان
  // ناتجاً عن ترتيب الوسائط لا عن قرار. لو أُضيف فحص صلاحية إلى /me/orders
  // يوماً لأي سبب، لصار جسم الطلب قادراً على انتحال مستخدم آخر بصمت.
  //
  // والرفض هنا صريح لا تراجع صامت إلى المستخدم الحالي: عميل يرسل user_id
  // لغيره يجب أن يعرف أن العملية رُفضت، لا أن يظنّ أنه أنشأ طلباً لسواه.
  let targetUser = req.user.id;
  if (bodyUser !== undefined && bodyUser !== null && Number(bodyUser) !== req.user.id) {
    if (!(await roles.has(req.user, 'orders:approve'))) {
      throw err.forbidden('لا تملك صلاحية إنشاء طلب لمستخدم آخر');
    }
    targetUser = Number(bodyUser);
  }

  const order = await orders.create({
    userId: targetUser, productId, couponCode, campaignId,
    req, actor: req.user,
  });

  // تعليمات الدفع تُقرأ من الإعدادات لا من نص مكتوب في الواجهة.
  const cfg = await settings.forRequest(req);
  return ok(res, {
    order,
    payment: {
      instructions: cfg['payment.instructions_ar'],
      bank_name: cfg['payment.bank_name'],
      bank_iban: cfg['payment.bank_iban'],
      account_name: cfg['payment.bank_account_name'],
      whatsapp: cfg['support.whatsapp_number'],
    },
  }, 'تم إنشاء الطلب', 201);
});

exports.approve = handle(async (req, res) => {
  const order = await orders.approve({
    orderId: req.params.id,
    paymentReference: req.body?.payment_reference || null,
    actor: req.user, req,
  });
  return ok(res, order, 'تم اعتماد الدفع ومنح الأرصدة');
});

exports.refund = handle(async (req, res) => {
  const { reason } = req.body;
  if (!reason?.trim()) throw err.reasonRequired();
  const order = await orders.refund({ orderId: req.params.id, reason, actor: req.user, req });
  return ok(res, order, 'تم تنفيذ الاسترداد');
});

exports.cancel = handle(async (req, res) => {
  const order = await orders.cancel({
    orderId: req.params.id, reason: req.body?.reason, actor: req.user, req,
  });
  return ok(res, order, 'تم إلغاء الطلب');
});

/** طلباتي — لواجهة العميل. */
exports.mine = handle(async (req, res) => {
  const rows = await GrowthOrder.findAll({
    where: { user_id: req.user.id },
    order: [['id', 'DESC']],
    limit: 50,
  });
  return ok(res, rows);
});

/** إثبات دفع يرفعه العميل. */
exports.submitPayment = handle(async (req, res) => {
  const order = await GrowthOrder.findByPk(req.params.id);
  if (!order) throw err.notFound('الطلب');
  if (order.user_id !== req.user.id) throw err.forbidden();
  if (order.status !== 'awaiting_payment') throw err.conflict('لا يمكن تحديث هذا الطلب');

  await order.update({
    payment_reference: String(req.body?.payment_reference || '').slice(0, 191),
    payment_note: String(req.body?.note || '').slice(0, 2000),
  });
  return ok(res, order, 'تم استلام إثبات الدفع، سيراجعه فريقنا');
});
