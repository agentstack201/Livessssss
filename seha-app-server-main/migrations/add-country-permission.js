require("dotenv").config();
const sequelize = require("../config/database");

async function addCountryPermission() {
  try {
    console.log("🔄 بدء إضافة صلاحية إدارة الدول...");

    // إضافة حقل can_manage_countries
    await sequelize.query(`
      ALTER TABLE permissions 
      ADD COLUMN IF NOT EXISTS can_manage_countries BOOLEAN DEFAULT TRUE;
    `);
    console.log("✅ تم إضافة حقل can_manage_countries");

    // تحديث جميع الأدمن ليحصلوا على الصلاحية
    await sequelize.query(`
      UPDATE permissions SET can_manage_countries = TRUE WHERE user_id IN (
        SELECT id FROM users WHERE role = 'admin'
      );
    `);
    console.log("✅ تم تفعيل الصلاحية لجميع الأدمن");

    process.exit(0);
  } catch (error) {
    console.error("❌ خطأ:", error);
    process.exit(1);
  }
}

addCountryPermission();
