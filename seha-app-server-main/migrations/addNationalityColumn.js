const sequelize = require('../config/database');

async function addNationalityColumn() {
  try {
    await sequelize.sync();
    console.log('✅ Database connected');

    // Add nationality column
    await sequelize.query(`
      ALTER TABLE leaves 
      ADD COLUMN IF NOT EXISTS nationality VARCHAR(191) DEFAULT 'سعودي';
    `);

    console.log('✅ Nationality column added successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

addNationalityColumn();
