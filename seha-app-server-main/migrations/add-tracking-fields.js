require("dotenv").config();
const sequelize = require("../config/database");

async function addTrackingFields() {
  try {
    console.log("🔄 إضافة حقول التتبع للدول والوسائط...");

    // إضافة حقول التتبع لجدول الدول
    await sequelize.query(`
      ALTER TABLE countries 
      ADD COLUMN IF NOT EXISTS created_by VARCHAR(191) DEFAULT 'احمد',
      ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
    `);
    console.log("✅ تم إضافة حقول التتبع لجدول countries");

    // إضافة حقول التتبع لجدول الوسائط (إذا كان موجوداً)
    try {
      await sequelize.query(`
        ALTER TABLE media 
        ADD COLUMN IF NOT EXISTS created_by VARCHAR(191) DEFAULT 'احمد',
        ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
      `);
      console.log("✅ تم إضافة حقول التتبع لجدول media");
    } catch (e) {
      console.log("⚠️ جدول media غير موجود أو الحقول موجودة مسبقاً");
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ خطأ:", error);
    process.exit(1);
  }
}

addTrackingFields();
