require("dotenv").config();
const sequelize = require("../config/database");

async function addCreatedByField() {
  try {
    console.log("🔄 بدء إضافة حقل created_by...");

    // Add created_by column to leaves table if not exists
    await sequelize.query(`
      ALTER TABLE leaves 
      ADD COLUMN IF NOT EXISTS created_by VARCHAR(100) DEFAULT 'system'
    `);
    console.log("✅ تم إضافة حقل created_by بنجاح");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ خطأ:", error);
    process.exit(1);
  }
}

// Run migration
addCreatedByField();
