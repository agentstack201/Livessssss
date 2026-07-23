require("dotenv").config();
const sequelize = require("../config/database");

async function addMediaPermission() {
  try {
    console.log("🔄 بدء إضافة حقل can_manage_media إلى جدول permissions...");

    // إضافة حقل can_manage_media لبرمجية إدارة الوسائط
    await sequelize.query(`
      ALTER TABLE permissions 
      ADD COLUMN IF NOT EXISTS can_manage_media BOOLEAN DEFAULT FALSE;
    `);

    console.log("✅ تم إضافة حقل can_manage_media بنجاح");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ خطأ أثناء الميجريشن:", error);
    process.exit(1);
  }
}

// Run migration
addMediaPermission();
