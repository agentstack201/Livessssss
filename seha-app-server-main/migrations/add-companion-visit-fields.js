require("dotenv").config();
const sequelize = require("../config/database");

// أعمدة قالب «مشهد مراجعة لمرافق» (Companion Statement of Visit).
// كلها اختيارية وبقيم افتراضية، فالسجلات الحالية (الإجازات المرضية) لا تتأثر:
// تبقى document_type = 'sick_leave' وتُطبع بنفس القالب القديم تماماً.
async function addCompanionVisitFields() {
  try {
    console.log("🔄 Adding companion-visit columns to leaves table...");

    await sequelize.query(`
      ALTER TABLE leaves
        ADD COLUMN IF NOT EXISTS document_type VARCHAR(32) DEFAULT 'sick_leave',
        ADD COLUMN IF NOT EXISTS admission_time VARCHAR(32) DEFAULT '',
        ADD COLUMN IF NOT EXISTS discharge_time VARCHAR(32) DEFAULT '',
        ADD COLUMN IF NOT EXISTS relation_en VARCHAR(191) DEFAULT '',
        ADD COLUMN IF NOT EXISTS relation_ar VARCHAR(191) DEFAULT '',
        ADD COLUMN IF NOT EXISTS visit_type_en VARCHAR(191) DEFAULT '',
        ADD COLUMN IF NOT EXISTS visit_type_ar VARCHAR(191) DEFAULT '';
    `);

    // ضمان أن كل السجلات القديمة تُصنَّف كإجازة مرضية.
    await sequelize.query(`
      UPDATE leaves SET document_type = 'sick_leave' WHERE document_type IS NULL;
    `);

    console.log("✅ Companion-visit columns added successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error adding companion-visit columns:", error.message);
    console.error(error);
    process.exit(1);
  }
}

addCompanionVisitFields();
