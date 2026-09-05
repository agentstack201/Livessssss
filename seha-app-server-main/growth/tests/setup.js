// ───────────────────────────────────────────────────────────────────────────
// تهيئة بيئة الاختبار.
//
// config/database يفرض SSL لأن الإنتاج على Neon. قاعدة اختبار محلية لا تدعمه
// عادةً، فنحقن هنا نسخة موجَّهة إلى TEST_DATABASE_URL في ذاكرة require قبل
// تحميل أي نموذج. النماذج والخدمات تستورد الوحدة نفسها فتحصل على هذه النسخة
// دون أي تعديل في كود الإنتاج.
//
// SSL يُفعَّل تلقائياً حين يطلبه الرابط (sslmode=require) وإلا يُترك مغلقاً.
// ───────────────────────────────────────────────────────────────────────────

const path = require('path');
const { Sequelize } = require('sequelize');

function setupTestDb() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    console.error('✋ TEST_DATABASE_URL غير مضبوط.\n');
    console.error('   مثال:');
    console.error('   TEST_DATABASE_URL=postgresql://postgres@localhost:5432/growth_test \\');
    console.error('     npm run test:growth\n');
    console.error('   تحذير: الاختبار يمسح كل الجداول في القاعدة المُشار إليها.');
    process.exit(2);
  }

  const wantsSsl = /sslmode=require/i.test(url);
  const instance = new Sequelize(url, {
    dialect: 'postgres',
    dialectModule: require('pg'),
    logging: false,
    ...(wantsSsl
      ? { dialectOptions: { ssl: { require: true, rejectUnauthorized: false } } }
      : {}),
  });

  const dbPath = require.resolve(path.join(__dirname, '..', '..', 'config', 'database'));
  require.cache[dbPath] = {
    id: dbPath, filename: dbPath, loaded: true, exports: instance,
  };

  const models = require(path.join(__dirname, '..', 'models'));
  require(path.join(__dirname, '..', '..', 'config', 'models_associations.js'));

  return { sequelize: instance, models };
}

module.exports = { setupTestDb };
