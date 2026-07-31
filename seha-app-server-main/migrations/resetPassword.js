// إعادة تعيين كلمة مرور مستخدم موجود.
//
// الاستخدام على السيرفر:
//   node migrations/resetPassword.js <الإيميل> <كلمة المرور الجديدة>
//
// مثال:
//   node migrations/resetPassword.js admin@seha.sa MyNewPass123
//
// بدون معاملات يعيد تعيين admin@seha.sa إلى admin123
require("dotenv").config();
const bcrypt = require("bcrypt");
const sequelize = require("../config/database");
const User = require("../models/user.model");

async function resetPassword() {
  const email = process.argv[2] || "admin@seha.sa";
  const newPassword = process.argv[3] || "admin123";

  try {
    await sequelize.authenticate();
    console.log("✅ تم الاتصال بقاعدة البيانات");

    const user = await User.findOne({ where: { email } });

    if (!user) {
      console.log(`❌ لا يوجد مستخدم بالإيميل: ${email}`);
      // عرض الإيميلات الموجودة للمساعدة (بدون أي كلمات مرور)
      const all = await User.findAll({ attributes: ["name", "email", "role"] });
      if (all.length) {
        console.log("\n📋 المستخدمون الموجودون في النظام:");
        all.forEach(u => console.log(`   • ${u.name} — ${u.email} (${u.role || "user"})`));
      } else {
        console.log("قاعدة البيانات لا تحتوي مستخدمين — شغّل: node migrations/createAdmin.js");
      }
      process.exit(1);
    }

    // نفس عدد جولات التشفير المستخدم في إنشاء الحسابات (10)
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await user.update({ password: hashedPassword });

    console.log("\n🎉 تمت إعادة تعيين كلمة المرور بنجاح!");
    console.log(`   الإيميل: ${email}`);
    console.log(`   كلمة المرور الجديدة: ${newPassword}`);
    console.log("\n⚠️ سجّل الدخول الآن وغيّرها إن أردت من إدارة المستخدمين.");
    process.exit(0);
  } catch (error) {
    console.error("❌ خطأ أثناء إعادة التعيين:", error.message);
    process.exit(1);
  }
}

resetPassword();
