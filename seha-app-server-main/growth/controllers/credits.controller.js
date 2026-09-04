// الأرصدة — الدفتر والبحث والتعديل الإداري والمطابقة.
// التعديل الإداري يفرض سبباً نصّياً ويُسجَّل بدرجة critical دائماً.

const { Op } = require('sequelize');
const { CreditTransaction, GrowthProfile, User } = require('../models');
const credits = require('../services/credit.service');
const analytics = require('../services/analytics.service');
const { handle, ok } = require('../middlewares/growthAuth');
const { err } = require('../errors');

exports.ledger = handle(async (req, res) => {
  const { user_id: userId, type, source_type: sourceType, from, to, page = 1, limit = 50 } = req.query;
  const where = {};
  if (userId) where.user_id = userId;
  if (type) where.type = type;
  if (sourceType) where.source_type = sourceType;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt[Op.gte] = new Date(from);
    if (to) where.createdAt[Op.lte] = new Date(to);
  }

  const take = Math.min(parseInt(limit, 10) || 50, 200);
  const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * take;

  const { rows, count } = await CreditTransaction.findAndCountAll({
    where,
    include: [
      { model: User, as: 'user', attributes: ['id', 'name', 'email'] },
      { model: User, as: 'actor', attributes: ['id', 'name'] },
    ],
    order: [['id', 'DESC']],
    limit: take,
    offset: skip,
  });

  return ok(res, {
    transactions: rows,
    pagination: { page: Number(page), limit: take, total: count, pages: Math.ceil(count / take) },
  });
});

exports.summary = handle(async (req, res) => {
  const [byType, liability] = await Promise.all([
    analytics.creditSummary({ days: parseInt(req.query.days, 10) || 30 }),
    analytics.creditLiability(),
  ]);
  return ok(res, { by_type: byType, liability });
});

/** بحث سريع عن رصيد مستخدم — أكثر ما يستعمله وكيل الدعم. */
exports.lookup = handle(async (req, res) => {
  const { q } = req.query;
  if (!q?.trim()) throw err.validation('أدخل اسماً أو بريداً أو رقم مستخدم');

  const where = /^\d+$/.test(q.trim())
    ? { id: Number(q.trim()) }
    : { [Op.or]: [{ email: { [Op.iLike]: `%${q}%` } }, { name: { [Op.iLike]: `%${q}%` } }] };

  const users = await User.findAll({ where, attributes: ['id', 'name', 'email', 'role'], limit: 10 });
  const profiles = await GrowthProfile.findAll({ where: { user_id: users.map((u) => u.id) } });
  const byUser = Object.fromEntries(profiles.map((p) => [p.user_id, p]));

  return ok(res, users.map((u) => ({
    ...u.get({ plain: true }),
    profile: byUser[u.id] || null,
  })));
});

exports.balance = handle(async (req, res) => {
  const balance = await credits.getBalance(req.params.userId);
  return ok(res, balance);
});

exports.history = handle(async (req, res) => {
  const rows = await CreditTransaction.findAll({
    where: { user_id: req.params.userId },
    include: [{ model: User, as: 'actor', attributes: ['id', 'name'] }],
    order: [['id', 'DESC']],
    limit: Math.min(parseInt(req.query.limit, 10) || 100, 500),
  });
  return ok(res, rows);
});

/**
 * تعديل إداري. السبب إلزامي — لا لأن المخطّط يفرضه بل لأن الخدمة ترفض بدونه.
 * client_key يجعل إعادة إرسال النموذج بعد انقطاع شبكة آمنة.
 */
exports.adjust = handle(async (req, res) => {
  const { user_id: userId, amount, direction, reason, client_key: clientKey } = req.body;

  if (!userId) throw err.validation('المستخدم مطلوب');
  if (!reason?.trim()) throw err.reasonRequired();
  const value = parseInt(amount, 10);
  if (!Number.isFinite(value) || value <= 0) throw err.validation('المبلغ يجب أن يكون رقماً موجباً');
  if (!['grant', 'debit'].includes(direction)) throw err.validation('اتجاه غير صالح');

  const result = await credits.adjust({
    userId, amount: value, direction, reason,
    performedBy: req.user.id, clientKey,
    req, actor: req.user,
  });

  return ok(res, {
    transaction: result.transaction,
    idempotent: result.idempotent,
    balance: result.transaction.balance_after,
  }, result.idempotent ? 'العملية مطبَّقة سلفاً' : 'تم تعديل الرصيد');
});

/**
 * المطابقة — تُبلّغ ولا تكتب.
 * التصحيح الصامت يخفي الخلل الذي سبّب التباين، وهو أخطر من التباين نفسه.
 */
exports.reconcile = handle(async (req, res) => {
  const report = await credits.reconcile({
    userId: req.query.user_id || null,
    limit: Math.min(parseInt(req.query.limit, 10) || 500, 2000),
  });
  return ok(res, report, report.healthy
    ? 'الرصيد مطابق للدفتر في كل السجلات المفحوصة'
    : `وُجد ${report.discrepancies.length} تباين — يحتاج فحصاً`);
});

/** رصيدي — لواجهة العميل. */
exports.myBalance = handle(async (req, res) => {
  const balance = await credits.getBalance(req.user.id);
  const recent = await CreditTransaction.findAll({
    where: { user_id: req.user.id },
    order: [['id', 'DESC']],
    limit: 20,
    attributes: ['id', 'type', 'amount', 'balance_after', 'source_type', 'description', 'createdAt'],
  });
  return ok(res, { ...balance, recent });
});
