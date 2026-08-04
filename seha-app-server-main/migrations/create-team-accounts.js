require("dotenv").config();
const sequelize = require("../config/database");
require("../config/models_associations");
const { createTeamAccounts } = require("../utils/teamAccounts");

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
//
// لمن لا يملك وصول Shell (مثل خطط الاستضافة المجانية): استخدم بدلاً من هذا
// نقطة HTTP العامة GET /setup/bootstrap-team (تعمل مرة واحدة فقط، وتتوقف
// تلقائياً بعد إنشاء أول حساب في النظام). راجع controller/setup.controller.js.
// ───────────────────────────────────────────────────────────────────────────

async function main() {
  try {
    await sequelize.authenticate();
    console.log('✅ الاتصال بقاعدة البيانات ناجح');

    await sequelize.sync({ alter: false });

    const results = await createTeamAccounts({
      env: process.env,
      resetExistingPassword: String(process.env.RESET_EXISTING_PASSWORDS || '').toLowerCase() === 'true',
    });

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

main();
