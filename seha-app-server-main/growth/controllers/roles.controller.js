// الأدوار والفريق — تركيب الصلاحيات وإسنادها.
// مفردات الصلاحيات ثابتة في الكود؛ التركيب حرّ من اللوحة.

const roles = require('../services/role.service');
const { groupedPermissions } = require('../config/permissions');
const { handle, ok } = require('../middlewares/growthAuth');
const { err } = require('../errors');

/** مفردات الصلاحيات — تملأ مُنتقي الصلاحيات مجمَّعةً. */
exports.vocabulary = handle(async (req, res) => ok(res, groupedPermissions()));

exports.list = handle(async (req, res) => ok(res, await roles.list()));

exports.create = handle(async (req, res) => {
  if (!req.body?.name?.trim()) throw err.validation('اسم الدور مطلوب');
  const role = await roles.create({ payload: req.body, actor: req.user, req });
  return ok(res, role, 'تم إنشاء الدور', 201);
});

exports.update = handle(async (req, res) => {
  const role = await roles.update({ roleId: req.params.id, payload: req.body, actor: req.user, req });
  return ok(res, role, 'تم حفظ التعديلات');
});

exports.remove = handle(async (req, res) => {
  const result = await roles.remove({ roleId: req.params.id, actor: req.user, req });
  return ok(res, result, 'تم حذف الدور');
});

exports.members = handle(async (req, res) => ok(res, await roles.members()));

exports.assign = handle(async (req, res) => {
  const { user_id: userId, role_id: roleId } = req.body;
  if (!userId || !roleId) throw err.validation('المستخدم والدور مطلوبان');
  const result = await roles.assign({ userId, roleId, actor: req.user, req });
  return ok(res, result, result.created ? 'تم إسناد الدور' : 'الدور مُسنَد سلفاً');
});

exports.revoke = handle(async (req, res) => {
  const { user_id: userId, role_id: roleId } = req.body;
  if (!userId || !roleId) throw err.validation('المستخدم والدور مطلوبان');
  const result = await roles.revoke({ userId, roleId, actor: req.user, req });
  return ok(res, result, result.revoked ? 'تم سحب الدور' : 'الدور غير مُسنَد');
});

/** صلاحياتي — تستعملها الواجهة لإخفاء ما لا يملكه المستخدم. */
exports.me = handle(async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const permissions = isAdmin ? ['*'] : await roles.permissionsFor(req.user.id);
  return ok(res, {
    user_id: req.user.id,
    name: req.user.name,
    is_admin: isAdmin,
    permissions,
    // الإخفاء في الواجهة راحة للمستخدم لا حماية — الحاجز الحقيقي على الخادم.
    has_growth_access: isAdmin || permissions.length > 0,
  });
});
