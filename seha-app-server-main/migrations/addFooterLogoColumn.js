require("dotenv").config();
const sequelize = require("../config/database");

async function addFooterLogoColumn() {
  try {
    console.log("🔄 Adding footer_logo column to leaves table...");

    await sequelize.query(`
      ALTER TABLE leaves
      ADD COLUMN IF NOT EXISTS footer_logo TEXT;
    `);

    console.log("✅ footer_logo column added successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error adding footer_logo column:", error.message);
    console.error(error);
    process.exit(1);
  }
}

addFooterLogoColumn();
