const sequelize = require('../config/database');

async function makeEmployerOptional() {
    try {
        console.log('🔄 Starting migration: Make employer fields optional...');

        // الاتصال بقاعدة البيانات
        await sequelize.authenticate();
        console.log('✅ Database connected');

        // PostgreSQL syntax: إزالة قيد NOT NULL من employer_en
        await sequelize.query(`
      ALTER TABLE leaves 
      ALTER COLUMN employer_en DROP NOT NULL
    `);
        console.log('✅ employer_en: NOT NULL constraint dropped');

        // تعيين قيمة افتراضية لـ employer_en
        await sequelize.query(`
      ALTER TABLE leaves 
      ALTER COLUMN employer_en SET DEFAULT ''
    `);
        console.log('✅ employer_en: Default value set to empty string');

        // PostgreSQL syntax: إزالة قيد NOT NULL من employer_ar
        await sequelize.query(`
      ALTER TABLE leaves 
      ALTER COLUMN employer_ar DROP NOT NULL
    `);
        console.log('✅ employer_ar: NOT NULL constraint dropped');

        // تعيين قيمة افتراضية لـ employer_ar
        await sequelize.query(`
      ALTER TABLE leaves 
      ALTER COLUMN employer_ar SET DEFAULT ''
    `);
        console.log('✅ employer_ar: Default value set to empty string');

        // تحديث السجلات الموجودة التي قد تحتوي على NULL
        await sequelize.query(`
      UPDATE leaves 
      SET employer_en = '' 
      WHERE employer_en IS NULL
    `);

        await sequelize.query(`
      UPDATE leaves 
      SET employer_ar = '' 
      WHERE employer_ar IS NULL
    `);
        console.log('✅ Existing NULL values updated to empty string');

        console.log('🎉 Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    }
}

makeEmployerOptional();
