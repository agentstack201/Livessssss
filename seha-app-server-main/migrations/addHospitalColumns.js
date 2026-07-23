require("dotenv").config();
const sequelize = require("../config/database");

async function addHospitalColumns() {
  try {
    console.log("🔄 Adding hospital columns to leaves table...");

    // Add hospital_name_en column
    await sequelize.query(`
      ALTER TABLE leaves 
      ADD COLUMN IF NOT EXISTS hospital_name_en VARCHAR(191) DEFAULT 'AL NOOR SPECIALIST HOSPITAL';
    `);
    console.log("✅ Added hospital_name_en column");

    // Add hospital_name_ar column
    await sequelize.query(`
      ALTER TABLE leaves 
      ADD COLUMN IF NOT EXISTS hospital_name_ar VARCHAR(191) DEFAULT 'مستشفى النور التخصصي';
    `);
    console.log("✅ Added hospital_name_ar column");

    // Add license_number column
    await sequelize.query(`
      ALTER TABLE leaves 
      ADD COLUMN IF NOT EXISTS license_number VARCHAR(191) DEFAULT '1410845906';
    `);
    console.log("✅ Added license_number column");

    console.log("✅ All hospital columns added successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error adding columns:", error.message);
    console.error(error);
    process.exit(1);
  }
}

addHospitalColumns();
