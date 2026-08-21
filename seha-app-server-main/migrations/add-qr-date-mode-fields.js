require("dotenv").config();
const sequelize = require("../config/database");

async function addQrDateModeFields() {
  try {
    console.log("🔄 Adding add_qr, date_mode, leave_days columns to leaves table...");

    // add_qr: إظهار/إخفاء رمز الاستجابة السريعة في التقرير. الافتراضي TRUE
    // حتى تستمر السجلات القديمة والسجلات التي لا ترسل هذا الحقل بإظهار
    // الـ QR تماماً كما كان يحدث قبل هذا التعديل (السلوك كان دائماً ON).
    await sequelize.query(`
      ALTER TABLE leaves
      ADD COLUMN IF NOT EXISTS add_qr BOOLEAN DEFAULT TRUE;
    `);
    console.log("✅ Added add_qr column");

    // date_mode: 'actual' (السلوك الحالي، الافتراضي) أو 'issue_date' (تاريخا
    // الدخول والخروج = تاريخ الإصدار، ومدة الإجازة قيمة مستقلة).
    await sequelize.query(`
      ALTER TABLE leaves
      ADD COLUMN IF NOT EXISTS date_mode VARCHAR(20) DEFAULT 'actual';
    `);
    console.log("✅ Added date_mode column");

    // leave_days: تُستخدم فقط عندما date_mode = 'issue_date' لتخزين مدة
    // الإجازة كقيمة مستقلة لا تُحسب من الفرق بين التاريخين. تبقى NULL في كل
    // الحالات الأخرى وتُتجاهل، فحساب calcDays() الحالي يستمر كما هو.
    await sequelize.query(`
      ALTER TABLE leaves
      ADD COLUMN IF NOT EXISTS leave_days INTEGER DEFAULT NULL;
    `);
    console.log("✅ Added leave_days column");

    // Backfill: أي سجل قديم بقيمة NULL يحصل على القيم الافتراضية أعلاه صراحةً.
    await sequelize.query(`
      UPDATE leaves
      SET add_qr = TRUE
      WHERE add_qr IS NULL;
    `);
    await sequelize.query(`
      UPDATE leaves
      SET date_mode = 'actual'
      WHERE date_mode IS NULL;
    `);
    console.log("✅ Updated existing records with default values");

    console.log("✅ add_qr / date_mode / leave_days columns added successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error adding columns:", error.message);
    console.error(error);
    process.exit(1);
  }
}

addQrDateModeFields();
