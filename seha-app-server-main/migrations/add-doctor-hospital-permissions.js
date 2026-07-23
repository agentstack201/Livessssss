require("dotenv").config();
const sequelize = require("../config/database");

async function addDoctorHospitalPermissions() {
  try {
    console.log("🔄 بدء إضافة صلاحيات الأطباء والمستشفيات...");

    // 1. إضافة الحقول إلى جدول الصلاحيات
    console.log("🔄 إضافة حقل can_manage_doctors...");
    await sequelize.query(`
      ALTER TABLE permissions 
      ADD COLUMN IF NOT EXISTS can_manage_doctors BOOLEAN DEFAULT FALSE;
    `);
    console.log("✅ تم إضافة حقل can_manage_doctors");

    console.log("🔄 إضافة حقل can_manage_hospitals...");
    await sequelize.query(`
      ALTER TABLE permissions 
      ADD COLUMN IF NOT EXISTS can_manage_hospitals BOOLEAN DEFAULT FALSE;
    `);
    console.log("✅ تم إضافة حقل can_manage_hospitals");

    // 2. تحديث جميع الأدمن ليحصلوا على الصلاحيات الجديدة
    console.log("🔄 تفعيل الصلاحيات لجميع الأدمن...");
    await sequelize.query(`
      UPDATE permissions 
      SET can_manage_doctors = TRUE, 
          can_manage_hospitals = TRUE 
      WHERE user_id IN (
        SELECT id FROM users WHERE role = 'admin'
      );
    `);
    console.log("✅ تم تفعيل الصلاحيات لجميع الأدمن بنجاح");

    process.exit(0);
  } catch (error) {
    console.error("❌ خطأ أثناء تشغيل الميجريشن:", error);
    process.exit(1);
  }
}

addDoctorHospitalPermissions();
