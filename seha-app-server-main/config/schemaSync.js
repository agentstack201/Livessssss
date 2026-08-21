// ───────────────────────────────────────────────────────────────────────────
// مزامنة مخطّط قاعدة البيانات — المصدر الوحيد للحقيقة للأعمدة المطلوبة.
//
// لماذا هذا الملف موجود أصلاً؟
// النشر يشغّل `npm start` فقط (`node index.js`)، ولا يشغّل أي ملف في
// migrations/ إطلاقاً. و`sequelize.sync({ alter: false })` ينشئ الجداول
// المفقودة لكنه لا يضيف عموداً إلى جدول قائم. فأي عمود يُضاف إلى النموذج
// دون سطر DDL هنا يبقى مفقوداً في قاعدة الإنتاج، بينما يضعه Sequelize في
// كل جملة SELECT — فيفشل *كل* جلب للسجلات بـ:
//     column leaves.<name> does not exist
// وهذا ما حدث فعلاً مع template_data و document_font.
//
// كان الـ DDL مكتوباً داخل index.js كقائمة مضمّنة، وملفات migrations/ نسخة
// ثانية منه لا يشغّلها أحد. نسختان تفترقان بصمت. الحل الجذري: القائمة هنا
// وحدها، وindex.js وملفات migrations/ كلها تقرأ منها.
//
// إضافة عمود جديد مستقبلاً = سطر واحد في REQUIRED_COLUMNS. لا شيء غيره.
//
// كل جملة idempotent (ADD COLUMN IF NOT EXISTS) فتُشغَّل عند كل إقلاع بلا ضرر.
// ───────────────────────────────────────────────────────────────────────────

const REQUIRED_COLUMNS = [
  // صلاحيات إدارية
  { sql: `ALTER TABLE permissions ADD COLUMN IF NOT EXISTS can_manage_doctors BOOLEAN DEFAULT false;`, why: 'صلاحية إدارة الأطباء' },
  { sql: `ALTER TABLE permissions ADD COLUMN IF NOT EXISTS can_manage_hospitals BOOLEAN DEFAULT false;`, why: 'صلاحية إدارة المستشفيات' },
  { sql: `ALTER TABLE permissions ADD COLUMN IF NOT EXISTS can_manage_settings BOOLEAN DEFAULT false;`, why: 'صلاحية إدارة الإعدادات' },

  // رقم جوال الزبون لإرسال التقرير عبر واتساب
  { sql: `ALTER TABLE leaves ADD COLUMN IF NOT EXISTS phone VARCHAR(30) DEFAULT '';`, why: 'إرسال واتساب' },

  // قالب «مشهد مراجعة لمرافق» — أعمدة اختيارية لا تمسّ الإجازة المرضية
  { sql: `ALTER TABLE leaves ADD COLUMN IF NOT EXISTS document_type VARCHAR(32) DEFAULT 'sick_leave';`, why: 'نوع المستند' },
  { sql: `ALTER TABLE leaves ADD COLUMN IF NOT EXISTS admission_time VARCHAR(32) DEFAULT '';`, why: 'وقت الدخول' },
  { sql: `ALTER TABLE leaves ADD COLUMN IF NOT EXISTS discharge_time VARCHAR(32) DEFAULT '';`, why: 'وقت الخروج' },
  { sql: `ALTER TABLE leaves ADD COLUMN IF NOT EXISTS relation_en VARCHAR(191) DEFAULT '';`, why: 'صلة القرابة' },
  { sql: `ALTER TABLE leaves ADD COLUMN IF NOT EXISTS relation_ar VARCHAR(191) DEFAULT '';`, why: 'صلة القرابة' },
  { sql: `ALTER TABLE leaves ADD COLUMN IF NOT EXISTS visit_type_en VARCHAR(191) DEFAULT '';`, why: 'نوع الزيارة' },
  { sql: `ALTER TABLE leaves ADD COLUMN IF NOT EXISTS visit_type_ar VARCHAR(191) DEFAULT '';`, why: 'نوع الزيارة' },

  // QR اختياري وطريقة التاريخ.
  // add_qr افتراضيّه TRUE عمداً: السجل الذي لا يحدّد قيمة يُظهر الـ QR كما كان
  // دائماً قبل هذه الميزة (وهو ما يعتمد عليه data.add_qr !== false).
  { sql: `ALTER TABLE leaves ADD COLUMN IF NOT EXISTS add_qr BOOLEAN DEFAULT TRUE;`, why: 'إظهار الباركود' },
  { sql: `ALTER TABLE leaves ADD COLUMN IF NOT EXISTS date_mode VARCHAR(20) DEFAULT 'actual';`, why: 'طريقة احتساب التاريخ' },
  { sql: `ALTER TABLE leaves ADD COLUMN IF NOT EXISTS leave_days INTEGER DEFAULT NULL;`, why: 'مدة الإجازة المستقلة' },

  // القوالب الورقية: عمود JSONB واحد يحمل حقول أي قالب، وعمود الخط المختار.
  // بغيابهما يفشل كل جلب للسجلات لأن النموذج يعلنهما وSequelize يطلبهما في
  // كل SELECT. هذا سطرا الـ DDL اللذان كانا مفقودَين وأسقطا «جلب السجلات».
  { sql: `ALTER TABLE leaves ADD COLUMN IF NOT EXISTS template_data JSONB DEFAULT '{}'::jsonb;`, why: 'حقول القوالب الورقية' },
  { sql: `ALTER TABLE leaves ADD COLUMN IF NOT EXISTS document_font VARCHAR(32) DEFAULT NULL;`, why: 'خط المستند المختار' },
  { sql: `UPDATE leaves SET template_data = '{}'::jsonb WHERE template_data IS NULL;`, why: 'كائن فارغ بدل NULL للسجلات القديمة' },

  // توسيع عمود رابط الوسائط ليتّسع لروابط data:base64 عند الرفع المحلي
  { sql: `ALTER TABLE media ALTER COLUMN url TYPE TEXT;`, why: 'روابط base64 الطويلة' },
];

/**
 * يشغّل كل جمل الـ DDL المطلوبة، واحدةً واحدةً.
 *
 * التتابع مقصود بدل Promise.all: مع Promise.all كان فشل جملة واحدة يبتلع
 * الحصيلة كلها في تحذير واحد غامض لا يذكر أي جملة فشلت. هنا كل جملة تُسجَّل
 * وحدها، وفشلها لا يمنع ما بعدها.
 */
async function runRequiredColumns(sequelize) {
  const failures = [];
  for (const { sql, why } of REQUIRED_COLUMNS) {
    try {
      await sequelize.query(sql);
    } catch (err) {
      failures.push({ sql, why, message: err.message });
      console.warn(`⚠️  DDL فشل (${why}): ${err.message}`);
    }
  }
  if (!failures.length) console.log(`✅ مخطّط قاعدة البيانات محدَّث (${REQUIRED_COLUMNS.length} جملة).`);
  return failures;
}

/**
 * يتحقّق أن كل عمود يعلنه أي نموذج موجود فعلاً في قاعدة البيانات.
 *
 * هذه هي الحارسة التي كانت غائبة: بدونها يظهر العمود الناقص فقط على شكل
 * خطأ 500 عند أول طلب من المستخدم، بلا أي إشارة في سجلّ الإقلاع. الآن يُطبع
 * اسم العمود الناقص وجملة الـ ALTER اللازمة عند الإقلاع مباشرةً.
 *
 * تحذير فقط ولا يُسقط الخادم: بقية الخدمات يجب أن تظل تعمل.
 */
async function verifyModelColumns(sequelize) {
  const missing = [];
  const [rows] = await sequelize.query(
    `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = current_schema();`
  );
  const present = new Set(rows.map((r) => `${r.table_name}.${r.column_name}`));

  for (const model of Object.values(sequelize.models)) {
    const table = model.getTableName();
    const tableName = typeof table === 'string' ? table : table.tableName;
    for (const attr of Object.values(model.getAttributes())) {
      // الحقول الافتراضية (VIRTUAL) لا وجود لها في قاعدة البيانات.
      if (attr.type && attr.type.key === 'VIRTUAL') continue;
      const column = attr.field || attr.fieldName;
      if (!present.has(`${tableName}.${column}`)) missing.push(`${tableName}.${column}`);
    }
  }

  if (missing.length) {
    console.error('❌ أعمدة يعلنها النموذج وهي مفقودة في قاعدة البيانات:');
    for (const m of missing) console.error(`   • ${m}`);
    console.error('   كل طلب يقرأ هذا الجدول سيفشل بـ "column ... does not exist".');
    console.error('   الحل: أضِف جملة ALTER TABLE ... ADD COLUMN IF NOT EXISTS في config/schemaSync.js');
  } else {
    console.log('✅ كل أعمدة النماذج موجودة في قاعدة البيانات.');
  }
  return missing;
}

/** يشغّل الـ DDL ثم يتحقّق — ما يستدعيه الخادم عند الإقلاع. */
async function syncSchema(sequelize) {
  const failures = await runRequiredColumns(sequelize);
  const missing = await verifyModelColumns(sequelize);
  return { failures, missing };
}

module.exports = { REQUIRED_COLUMNS, runRequiredColumns, verifyModelColumns, syncSchema };
