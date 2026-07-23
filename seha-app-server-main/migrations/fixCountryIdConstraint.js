const sequelize = require('../config/database');

async function fixCountryIdConstraint() {
  try {
    await sequelize.sync();
    console.log('✅ Database connected');

    // Drop the foreign key constraint
    await sequelize.query(`
      ALTER TABLE leaves 
      DROP CONSTRAINT IF EXISTS leaves_countryId_fkey;
    `);
    console.log('✅ Foreign key constraint dropped');

    // Make countryId nullable
    await sequelize.query(`
      ALTER TABLE leaves 
      ALTER COLUMN "countryId" DROP NOT NULL;
    `);
    console.log('✅ countryId is now nullable');

    // Set default value for existing records
    await sequelize.query(`
      UPDATE leaves 
      SET "countryId" = 1 
      WHERE "countryId" IS NULL;
    `);
    console.log('✅ Updated existing records');

    console.log('✅ All fixes applied successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixCountryIdConstraint();
