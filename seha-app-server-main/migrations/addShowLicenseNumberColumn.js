require("dotenv").config();
const sequelize = require("../config/database");

async function addShowLicenseNumberColumn() {
  try {
    console.log("🔄 Adding show_license_number column to leaves table...");

    // Add show_license_number column (BOOLEAN with default TRUE)
    await sequelize.query(`
      ALTER TABLE leaves 
      ADD COLUMN IF NOT EXISTS show_license_number BOOLEAN DEFAULT TRUE;
    `);
    console.log("✅ Added show_license_number column");

    // Update existing records to have show_license_number = true
    await sequelize.query(`
      UPDATE leaves 
      SET show_license_number = TRUE 
      WHERE show_license_number IS NULL;
    `);
    console.log("✅ Updated existing records with default value");

    console.log("✅ show_license_number column added successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error adding column:", error.message);
    console.error(error);
    process.exit(1);
  }
}

addShowLicenseNumberColumn();
