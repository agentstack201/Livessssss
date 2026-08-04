require("dotenv").config();
const crypto = require("crypto");
const bcrypt = require("bcrypt");

const sequelize = require("../config/database");
const User = require("../models/user.model");
const Permission = require("../models/permission.model");
require("../config/models_associations");

// ───────────────────────────────────────────────────────────────────────────
// إنشاء حسابات فريق العمل: حساب المالك (المدير) + ثلاثة موظفين.
//
// التشغيل:
//   node migrations/create-team-accounts.js
//
// السكربت يولّد كلمات مرور قوية عشوائية ويطبعها في نهاية التشغيل — لا تُخزَّن
// أي كلمة مرور داخل المستودع. يمكن تحديد بريد/كلمة مرور بنفسك عبر متغيرات
// البيئة، مثال:
//   OWNER_EMAIL=boss@seha.sa OWNER_PASSWORD='...' node migrations/create-team-accounts.js
//
// السكربت آمن لإعادة التشغيل (idempotent): إن كان البريد موجوداً يُحدَّث دوره
// وصلاحياته فقط، ولا تُغيَّر كلمة مروره إلا إذا شغّلته بـ:
//   RESET_EXISTING_PASSWORDS=true node migrations/create-team-accounts.js
// ───────────────────────────────────────────────────────────────────────────

const RESET_EXISTING = String(process.env.RESET_EXISTING_PASSWORDS || '').toLowerCase() === 'true';

// توليد كلمة مرور قوية (16 خانة) عبر مولّد عشوائي تشفيري.
// الأحرف المتشابهة (l/1/O/0) مستبعدة حتى تُقرأ وتُنقل بلا لبس.
function generatePassword() {
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const symbols = '!@#$%&*?';
  const all = lower + upper + digits + symbols;
  const pick = (set) => set[crypto.randomInt(set.length)];

  // نضمن وجود حرف كبير وصغير ورقم ورمز على الأقل.
  const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  while (chars.length < 16) chars.push(pick(all));

  // خلط Fisher–Yates بمصدر عشوائي تشفيري حتى لا تكون المواضع متوقعة.
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

const ACCOUNTS = [
  {
    key: 'OWNER',
    label: 'المدير — حساب المالك',
    name: process.env.OWNER_NAME || 'المدير',
    email: process.env.OWNER_EMAIL || 'owner@seha.sa',
    password: process.env.OWNER_PASSWORD || '',
    role: 'admin',
    permissions: OWNER_PERMISSIONS,
  },
  {
    key: 'USER1',
    label: 'موظف 1',
    name: process.env.USER1_NAME || 'موظف 1',
    email: process.env.USER1_EMAIL || 'user1@seha.sa',
    password: process.env.USER1_PASSWORD || '',
    role: 'user',
    permissions: STAFF_PERMISSIONS,
  },
  {
    key: 'USER2',
    label: 'موظف 2',
    name: process.env.USER2_NAME || 'موظف 2',
    email: process.env.USER2_EMAIL || 'user2@seha.sa',
    password: process.env.USER2_PASSWORD || '',
    role: 'user',
    permissions: STAFF_PERMISSIONS,
  },
  {
    key: 'USER3',
    label: 'موظف 3',
    name: process.env.USER3_NAME || 'موظف 3',
    email: process.env.USER3_EMAIL || 'user3@seha.sa',
    password: process.env.USER3_PASSWORD || '',
    role: 'user',
    permissions: STAFF_PERMISSIONS,
  },
];

async function upsertAccount(account) {
  const existing = await User.findOne({ where: { email: account.email } });

  // كلمة المرور: المُعطاة عبر البيئة، وإلا مولّدة عشوائياً.
  const password = account.password || generatePassword();
  const hashed = await bcrypt.hash(password, 10);

  let user;
  let status;
  let passwordShown = password;

  if (existing) {
    const updates = { name: account.name, role: account.role };
    if (account.password || RESET_EXISTING) {
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

  // الصلاحيات: صف واحد لكل مستخدم (فهرس فريد على user_id).
  const existingPermission = await Permission.findOne({ where: { user_id: user.id } });
  if (existingPermission) {
    await existingPermission.update(account.permissions);
  } else {
    await Permission.create({ user_id: user.id, ...account.permissions });
  }

  return { ...account, id: user.id, status, passwordShown };
}

async function createTeamAccounts() {
  try {
    await sequelize.authenticate();
    console.log('✅ الاتصال بقاعدة البيانات ناجح');

    // إنشاء الجداول إن لم تكن موجودة (بدون تعديل أعمدة قائمة).
    await sequelize.sync({ alter: false });

    const results = [];
    for (const account of ACCOUNTS) {
      results.push(await upsertAccount(account));
    }

    console.log('\n════════════════ بيانات الدخول ════════════════');
    for (const r of results) {
      console.log(`\n▸ ${r.label}`);
      console.log(`   الاسم        : ${r.name}`);
      console.log(`   البريد       : ${r.email}`);
      console.log(`   كلمة المرور  : ${r.passwordShown}`);
      console.log(`   الدور        : ${r.role === 'admin' ? 'admin (صلاحيات كاملة)' : 'user'}`);
      console.log(`   الحالة       : ${r.status}`);
    }
    console.log('\n═══════════════════════════════════════════════');
    console.log('⚠️  انسخ كلمات المرور الآن — لا تُخزَّن في أي مكان ولا يمكن استرجاعها لاحقاً.');
    console.log('   يمكن تغييرها في أي وقت من صفحة إدارة المستخدمين.\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ خطأ أثناء إنشاء الحسابات:', error.message);
    console.error(error);
    process.exit(1);
  }
}

createTeamAccounts();
