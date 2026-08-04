// ───────────────────────────────────────────────────────────────────────────
// منطق مشترك لإنشاء حسابات فريق العمل: حساب المالك (admin) وثلاثة موظفين.
// يُستخدم من مكانين:
//   - migrations/create-team-accounts.js (سطر أوامر، لمن يملك وصول Shell)
//   - controller/setup.controller.js (مسار HTTP عام، لمن لا يملك وصول Shell،
//     مثل خطط Render/Vercel المجانية)
// ───────────────────────────────────────────────────────────────────────────
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const User = require("../models/user.model");
const Permission = require("../models/permission.model");

// توليد كلمة مرور قوية (16 خانة) عبر مولّد عشوائي تشفيري.
// الأحرف المتشابهة (l/1/O/0) مستبعدة حتى تُقرأ وتُنقل بلا لبس.
function generatePassword() {
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const symbols = '!@#$%&*?';
  const all = lower + upper + digits + symbols;
  const pick = (set) => set[crypto.randomInt(set.length)];

  const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  while (chars.length < 16) chars.push(pick(all));

  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

// صلاحيات كاملة — حساب المالك/المدير.
const OWNER_PERMISSIONS = {
  can_view_leaves: true,
  can_create_leaves: true,
  can_edit_leaves: true,
  can_delete_leaves: true,
  can_view_users: true,
  can_create_users: true,
  can_edit_users: true,
  can_delete_users: true,
  can_manage_media: true,
  can_manage_countries: true,
  can_manage_settings: true,
  can_manage_doctors: true,
  can_manage_hospitals: true,
};

// صلاحيات الموظف: ينشئ ويعدّل التقارير (إجازة مرضية + مشهد مراجعة لمرافق)
// ويضيف الأطباء والمنشآت والشعارات — بلا حذف وبلا إدارة مستخدمين أو إعدادات.
const STAFF_PERMISSIONS = {
  can_view_leaves: true,
  can_create_leaves: true,
  can_edit_leaves: true,
  can_delete_leaves: false,
  can_view_users: false,
  can_create_users: false,
  can_edit_users: false,
  can_delete_users: false,
  can_manage_media: true,
  can_manage_countries: true,
  can_manage_settings: false,
  can_manage_doctors: true,
  can_manage_hospitals: true,
};

// قائمة الحسابات الافتراضية. القيم قابلة للتغيير عبر متغيرات البيئة (تُستخدم
// من سكربت سطر الأوامر فقط)؛ نقطة HTTP تستخدم القيم الافتراضية دائماً.
function defaultAccounts(env = {}) {
  return [
    {
      key: 'OWNER',
      label: 'المدير — حساب المالك',
      name: env.OWNER_NAME || 'المدير',
      email: env.OWNER_EMAIL || 'owner@seha.sa',
      password: env.OWNER_PASSWORD || '',
      role: 'admin',
      permissions: OWNER_PERMISSIONS,
    },
    {
      key: 'USER1',
      label: 'موظف 1',
      name: env.USER1_NAME || 'موظف 1',
      email: env.USER1_EMAIL || 'user1@seha.sa',
      password: env.USER1_PASSWORD || '',
      role: 'user',
      permissions: STAFF_PERMISSIONS,
    },
    {
      key: 'USER2',
      label: 'موظف 2',
      name: env.USER2_NAME || 'موظف 2',
      email: env.USER2_EMAIL || 'user2@seha.sa',
      password: env.USER2_PASSWORD || '',
      role: 'user',
      permissions: STAFF_PERMISSIONS,
    },
    {
      key: 'USER3',
      label: 'موظف 3',
      name: env.USER3_NAME || 'موظف 3',
      email: env.USER3_EMAIL || 'user3@seha.sa',
      password: env.USER3_PASSWORD || '',
      role: 'user',
      permissions: STAFF_PERMISSIONS,
    },
  ];
}

// إنشاء/تحديث حساب واحد. resetExistingPassword: إن كان الحساب موجوداً مسبقاً،
// هل نُعيد ضبط كلمة مروره؟ (السكربت CLI يتحكم بها عبر RESET_EXISTING_PASSWORDS).
async function upsertAccount(account, { resetExistingPassword = false } = {}) {
  const existing = await User.findOne({ where: { email: account.email } });

  const password = account.password || generatePassword();
  const hashed = await bcrypt.hash(password, 10);

  let user;
  let status;
  let passwordShown = password;

  if (existing) {
    const updates = { name: account.name, role: account.role };
    if (account.password || resetExistingPassword) {
      updates.password = hashed;
      status = 'محدَّث (أُعيد ضبط كلمة المرور)';
    } else {
      status = 'موجود مسبقاً (كلمة المرور بلا تغيير)';
      passwordShown = '— (لم تتغيّر)';
    }
    await existing.update(updates);
    user = existing;
  } else {
    user = await User.create({
      name: account.name,
      email: account.email,
      password: hashed,
      role: account.role,
    });
    status = 'تم الإنشاء';
  }

  const existingPermission = await Permission.findOne({ where: { user_id: user.id } });
  if (existingPermission) {
    await existingPermission.update(account.permissions);
  } else {
    await Permission.create({ user_id: user.id, ...account.permissions });
  }

  return { ...account, id: user.id, status, passwordShown };
}

// ينشئ الحسابات الأربعة. options: { env, resetExistingPassword }.
async function createTeamAccounts(options = {}) {
  const accounts = defaultAccounts(options.env || {});
  const results = [];
  for (const account of accounts) {
    results.push(await upsertAccount(account, options));
  }
  return results;
}

module.exports = {
  generatePassword,
  OWNER_PERMISSIONS,
  STAFF_PERMISSIONS,
  defaultAccounts,
  upsertAccount,
  createTeamAccounts,
};
