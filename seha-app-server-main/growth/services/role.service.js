// ───────────────────────────────────────────────────────────────────────────
// خدمة الأدوار — RBAC مستقل عن نظام الصلاحيات القائم في المشروع.
//
// لماذا مستقل؟ النظام الحالي أعمدة boolean في جدول permissions تعتمد عليها
// كل ميزات المنصة. تعديله لإدخال أدوار يعني مخاطرة على الإنتاج مقابل لا شيء.
// هذا النظام يعمل بالتوازي: صلاحيات وحدة النمو فقط، ولا يمسّ الفحوص القائمة.
//
// جسر التوافق: من يملك role === 'admin' في النظام القديم يتخطّى فحص النمو
// كاملاً. هذا مقصود — مالك النظام يجب ألّا يُقفَل خارج وحدة أُضيفت لاحقاً.
// ───────────────────────────────────────────────────────────────────────────

const { GrowthRole, GrowthUserRole, User } = require('../models');
const { validatePermissionList, ALL_PERMISSIONS } = require('../config/permissions');
const audit = require('./audit.service');
const { err } = require('../errors');

/** يجمع صلاحيات مستخدم من كل أدواره (اتّحاد). */
async function permissionsFor(userId) {
  const rows = await GrowthUserRole.findAll({
    where: { user_id: userId },
    include: [{ model: GrowthRole, as: 'role', attributes: ['slug', 'permissions'] }],
  });

  const set = new Set();
  for (const row of rows) {
    const perms = row.role?.permissions;
    if (Array.isArray(perms)) perms.forEach((p) => set.add(p));
  }
  return [...set];
}

/** هل يملك المستخدم صلاحية بعينها؟ الأدمن القديم يملك كل شيء. */
async function has(user, permission) {
  if (!user?.id) return false;
  if (user.role === 'admin') return true;
  const perms = await permissionsFor(user.id);
  return perms.includes(permission);
}

async function list() {
  const roles = await GrowthRole.findAll({ order: [['is_system', 'DESC'], ['id', 'ASC']] });
  const counts = await GrowthUserRole.findAll({
    attributes: ['role_id', [GrowthUserRole.sequelize.fn('COUNT', '*'), 'members']],
    group: ['role_id'],
    raw: true,
  });
  const byRole = Object.fromEntries(counts.map((c) => [c.role_id, parseInt(c.members, 10)]));
  return roles.map((r) => ({ ...r.get({ plain: true }), members: byRole[r.id] || 0 }));
}

async function create({ payload, actor, req }) {
  const check = validatePermissionList(payload.permissions || []);
  if (!check.valid) throw err.validation(check.message, { unknown: check.unknown });

  const role = await GrowthRole.create({
    name: payload.name,
    slug: String(payload.slug || payload.name || '').trim().toLowerCase().replace(/\s+/g, '-').slice(0, 60),
    description: payload.description || null,
    permissions: payload.permissions || [],
    is_system: false,
    created_by: actor?.id || null,
  });

  await audit.log({
    actor, action: 'role.create', resourceType: 'growth_role', resourceId: role.id,
    after: { name: role.name, permissions: role.permissions }, req, severity: 'critical',
  });
  return role;
}

async function update({ roleId, payload, actor, req }) {
  const role = await GrowthRole.findByPk(roleId);
  if (!role) throw err.notFound('الدور');

  if (payload.permissions) {
    const check = validatePermissionList(payload.permissions);
    if (!check.valid) throw err.validation(check.message, { unknown: check.unknown });
  }

  const fields = ['name', 'description', 'permissions'];
  const before = audit.snapshot(role, fields);

  // الدور النظامي تُعدَّل تسميته لا صلاحياته: تجريده يقفل المشغّل خارج النظام.
  const patch = { ...payload };
  if (role.is_system) delete patch.permissions;
  delete patch.slug;
  delete patch.is_system;

  await role.update(patch);
  const after = audit.snapshot(role, fields);

  await audit.log({
    actor, action: 'role.update', resourceType: 'growth_role', resourceId: role.id,
    before, after, req, severity: 'critical',
  });
  return role;
}

async function remove({ roleId, actor, req }) {
  const role = await GrowthRole.findByPk(roleId);
  if (!role) throw err.notFound('الدور');
  if (role.is_system) throw err.forbidden('لا يمكن حذف دور نظامي');

  const before = audit.snapshot(role, ['name', 'slug', 'permissions']);
  await GrowthUserRole.destroy({ where: { role_id: roleId } });
  await role.destroy();

  await audit.log({
    actor, action: 'role.delete', resourceType: 'growth_role', resourceId: roleId,
    before, req, severity: 'critical',
  });
  return { deleted: true };
}

async function assign({ userId, roleId, actor, req }) {
  const [user, role] = await Promise.all([User.findByPk(userId), GrowthRole.findByPk(roleId)]);
  if (!user) throw err.notFound('المستخدم');
  if (!role) throw err.notFound('الدور');

  const [link, created] = await GrowthUserRole.findOrCreate({
    where: { user_id: userId, role_id: roleId },
    defaults: { user_id: userId, role_id: roleId, assigned_by: actor?.id || null },
  });

  if (created) {
    await audit.log({
      actor, action: 'role.assign', resourceType: 'growth_user_role', resourceId: link.id,
      after: { user_id: userId, user: user.name, role: role.name },
      req, severity: 'critical',
    });
  }
  return { assigned: true, created };
}

async function revoke({ userId, roleId, actor, req }) {
  const link = await GrowthUserRole.findOne({ where: { user_id: userId, role_id: roleId } });
  if (!link) return { revoked: false };

  const role = await GrowthRole.findByPk(roleId);
  await link.destroy();

  await audit.log({
    actor, action: 'role.revoke', resourceType: 'growth_user_role', resourceId: link.id,
    before: { user_id: userId, role: role?.name }, req, severity: 'critical',
  });
  return { revoked: true };
}

/** أعضاء الفريق: كل من يحمل دوراً في وحدة النمو. */
async function members() {
  const rows = await GrowthUserRole.findAll({
    include: [
      { model: User, as: 'user', attributes: ['id', 'name', 'email', 'role'] },
      { model: GrowthRole, as: 'role', attributes: ['id', 'name', 'slug', 'permissions'] },
    ],
    order: [['user_id', 'ASC']],
  });

  const byUser = new Map();
  for (const row of rows) {
    if (!row.user) continue;
    if (!byUser.has(row.user.id)) {
      byUser.set(row.user.id, { ...row.user.get({ plain: true }), roles: [], permissions: new Set() });
    }
    const entry = byUser.get(row.user.id);
    if (row.role) {
      entry.roles.push({ id: row.role.id, name: row.role.name, slug: row.role.slug });
      (row.role.permissions || []).forEach((p) => entry.permissions.add(p));
    }
  }

  return [...byUser.values()].map((u) => ({ ...u, permissions: [...u.permissions] }));
}

/** الأدوار المؤسِّسة — تُزرع عند الإقلاع وتُحدَّث صلاحياتها مع كل نشر. */
const SYSTEM_ROLES = [
  {
    slug: 'growth-manager', name: 'مدير النمو', is_system: true,
    description: 'صلاحية كاملة على وحدة النمو عدا إدارة الأدوار',
    permissions: ALL_PERMISSIONS.filter((p) => !p.startsWith('roles:')),
  },
  {
    slug: 'operations', name: 'مشغّل', is_system: true,
    description: 'إدارة المنتجات والطلبات والأرصدة والكوبونات',
    permissions: [
      'products:read', 'products:write',
      'orders:read', 'orders:approve',
      'credits:read', 'credits:adjust',
      'coupons:read', 'coupons:write',
      'members:read', 'analytics:read',
    ],
  },
  {
    slug: 'analyst', name: 'محلّل', is_system: true,
    description: 'قراءة فقط لكل شيء',
    permissions: ALL_PERMISSIONS.filter((p) => p.endsWith(':read')),
  },
  {
    slug: 'support', name: 'دعم العملاء', is_system: true,
    description: 'بحث عن المستخدمين وتعديل أرصدتهم ومراجعة طلباتهم',
    permissions: [
      'members:read', 'credits:read', 'credits:adjust',
      'orders:read', 'coupons:read', 'referrals:read', 'products:read',
    ],
  },
];

/** بذرة الأدوار — idempotent، تُشغَّل عند كل إقلاع. */
async function seedSystemRoles() {
  for (const def of SYSTEM_ROLES) {
    const [role, created] = await GrowthRole.findOrCreate({
      where: { slug: def.slug },
      defaults: def,
    });
    // الأدوار النظامية تتبع الكود: صلاحية جديدة تصل لمدير النمو بلا تدخّل.
    if (!created) await role.update({ permissions: def.permissions, is_system: true });
  }
  return SYSTEM_ROLES.length;
}

module.exports = {
  permissionsFor, has, list, create, update, remove,
  assign, revoke, members, seedSystemRoles, SYSTEM_ROLES,
};
