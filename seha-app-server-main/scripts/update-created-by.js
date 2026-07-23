require("dotenv").config();
const sequelize = require("../config/database");

async function updateCreatedBy() {
  try {
    console.log('🔄 Updating created_by field for existing records...');
    
    // Update all existing records
    const [updatedCount] = await sequelize.query(`
      UPDATE leaves 
      SET created_by = 'ahmed' 
      WHERE created_by IS NULL OR created_by = '' OR created_by = 'system'
    `);
    
    console.log(`✅ Updated ${updatedCount} records with created_by = 'ahmed'`);
    
    // Verify the update
    const [totalRecords] = await sequelize.query(`
      SELECT COUNT(*) as count FROM leaves
    `);
    
    const [ahmedRecords] = await sequelize.query(`
      SELECT COUNT(*) as count FROM leaves WHERE created_by = 'ahmed'
    `);
    
    console.log(`📊 Database stats:`);
    console.log(`   Total records: ${totalRecords[0].count}`);
    console.log(`   Records with created_by = 'ahmed': ${ahmedRecords[0].count}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating created_by:', error);
    process.exit(1);
  }
}

updateCreatedBy();
