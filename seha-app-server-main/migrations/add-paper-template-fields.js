require("dotenv").config();
const sequelize = require("../config/database");

// أعمدة القوالب الورقية (تقارير المستشفيات المصوّرة وملفات Word).
//
// لماذا عمود JSONB واحد بدل ~٣٠ عموداً؟ كل تقرير ورقي يحمل حقولاً خاصة به
// (الجنس، تاريخ الميلاد، المهنة، رقم الملف الطبي، التشخيص، خانات التوصيات،
// وبيانات إشعار الموعد…) ولا يتقاطع كثير منها بين القوالب. إضافة عمود لكل
// حقل تعني هجرة جديدة مع كل قالب يُضاف، وجدولاً بأعمدة فارغة في معظم السجلات.
// عمود template_data واحد يجعل إضافة قالب جديد بلا هجرة إطلاقاً، ويصف كل
// قالب حقوله في سجلّ القوالب.
//
// الأعمدة الحالية لا تُمَسّ: السجلات القائمة تبقى كما هي تماماً.
async function addPaperTemplateFields() {
  try {
    console.log("🔄 Adding paper-template columns to leaves table...");

    await sequelize.query(`
      ALTER TABLE leaves
        ADD COLUMN IF NOT EXISTS template_data JSONB DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS document_font VARCHAR(32) DEFAULT NULL;
    `);

    // السجلات القديمة: كائن فارغ بدل NULL حتى تقرأها الشيفرة بلا حراسة إضافية.
    await sequelize.query(`
      UPDATE leaves SET template_data = '{}'::jsonb WHERE template_data IS NULL;
    `);

    console.log("✅ Paper-template columns added successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error adding paper-template columns:", error.message);
    console.error(error);
    process.exit(1);
  }
}

addPaperTemplateFields();
