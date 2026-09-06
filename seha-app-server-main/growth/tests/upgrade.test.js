// ───────────────────────────────────────────────────────────────────────────
// مسار النشر الحقيقي — وهو ما لا تختبره المجموعات الأخرى.
//
// كلها تبدأ بقاعدة فارغة و sync({ force: true }). أمّا الإنتاج فقاعدة عامرة
// بجداول المنصة وبياناتها، والنشر يشغّل sync({ alter: false }) — وهو لا
// يُنشئ إلا الجداول المفقودة ولا يمسّ القائم. هذا الاختبار يتحقّق أن تركيب
// الوحدة على قاعدة حيّة لا يمسّ بياناتها، وأن الإقلاع الثاني لا يفشل، وأن
// من سجّلوا قبل الوحدة يعملون بلا ملف تجاري سابق.
// ───────────────────────────────────────────────────────────────────────────
//   TEST_DATABASE_URL=postgresql://user@host:5432/dbname npm run test:growth:upgrade
//
// تحذير: يمسح كل الجداول. استعمل قاعدة اختبار منفصلة.
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

if (!process.env.TEST_DATABASE_URL) {
  console.error('✋ TEST_DATABASE_URL غير مضبوط.');
  process.exit(2);
}
// لا نستعمل setupTestDb هنا: هي تُحمّل نماذج النمو، فتُسجَّل قبل المرحلة
// الأولى ويفقد الاختبار معناه. نبني النسخة يدوياً ونتحكّم بما يُسجَّل ومتى.
const { Sequelize } = require(`${ROOT}/node_modules/sequelize`);
const dbPath = require.resolve(`${ROOT}/config/database`);
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true,
  exports: new Sequelize(process.env.TEST_DATABASE_URL, {
    dialect: 'postgres', dialectModule: require(`${ROOT}/node_modules/pg`), logging: false }) };

let pass=0, fail=0;
const ok=(n,c,x='')=>{if(c){pass++;console.log('  ✅ '+n)}else{fail++;console.log('  ❌ '+n+' '+x)}};

(async()=>{
  // ── المرحلة 1: منصة قائمة بلا وحدة نمو ──────────────────────────────────
  const sequelize = require(`${ROOT}/config/database`);
  const User=require(`${ROOT}/models/user.model`);
  require(`${ROOT}/models/leaves.model`);
  require(`${ROOT}/models/permission.model`);
  require(`${ROOT}/config/models_associations.js`);

  // نبدأ من قاعدة عارية فعلاً. sync({force:true}) لا يُسقط إلا ما سُجِّل من
  // النماذج، وجداول النمو لم تُسجَّل بعد — فلو سبقتنا مجموعة أخرى على نفس
  // القاعدة بقيت جداولها وسقط فرض هذا الاختبار كله.
  await sequelize.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');

  // نُنشئ جداول المنصة فقط (بلا نماذج النمو بعد)
  await sequelize.sync({ force: true });
  const legacy = await User.create({name:'قديم',email:'old@x.com',password:'x',role:'admin'});
  const legacy2 = await User.create({name:'قديم2',email:'old2@x.com',password:'x',role:'user'});
  console.log('\n━━ منصة قائمة: مستخدمان موجودان قبل تركيب الوحدة');

  const before = await sequelize.query(
    "SELECT COUNT(*)::int n FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'growth_%'",
    { type: sequelize.QueryTypes.SELECT });
  ok('لا جداول نمو قبل التركيب', before[0].n === 0, `(${before[0].n})`);

  // ── المرحلة 2: تركيب الوحدة كما يفعل النشر ──────────────────────────────
  console.log('\n━━ تركيب الوحدة (sync alter:false ثم bootstrap)');
  require(`${ROOT}/growth/models`);
  await sequelize.sync({ alter: false });          // نفس ما يشغّله index.js
  const boot = await require(`${ROOT}/growth/bootstrap`).initialize(sequelize);
  ok('التهيئة نجحت', boot.ok === true, JSON.stringify(boot));
  ok('القيود طُبِّقت', boot.constraints === 9, `(${boot.constraints})`);
  ok('الأدوار النظامية زُرعت', boot.roles === 4, `(${boot.roles})`);

  const after = await sequelize.query(
    "SELECT COUNT(*)::int n FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('growth_products','growth_orders','growth_profiles','credit_transactions','coupons','coupon_redemptions','referral_links','referral_events','campaigns','reward_rules','reward_grants','growth_roles','growth_user_roles','growth_audit_logs','growth_settings')",
    { type: sequelize.QueryTypes.SELECT });
  ok('الجداول الخمسة عشر أُنشئت على قاعدة عامرة', after[0].n === 15, `(${after[0].n})`);

  // بيانات المنصة سليمة
  const users = await User.count();
  ok('بيانات المنصة لم تُمسّ', users === 2, `(${users})`);

  // ── المرحلة 3: مستخدم قديم يعمل بلا ملف تجاري ───────────────────────────
  console.log('\n━━ مستخدمون سبقوا الوحدة');
  const credits=require(`${ROOT}/growth/services/credit.service`);
  const bal = await credits.getBalance(legacy2.id);
  ok('يُنشأ ملف تجاري عند أول حاجة لمستخدم قديم', bal.credit_balance === 0);

  const hooks=require(`${ROOT}/growth/hooks`);
  const r = await hooks.onDocumentCreated({ userId: legacy2.id, documentId: 'legacy-doc-1' });
  ok('خطّاف المستند يعمل لمستخدم سبق الوحدة', r.ok === true, JSON.stringify(r));

  // ── المرحلة 4: إعادة التشغيل (النشر الثاني) ─────────────────────────────
  console.log('\n━━ نشر ثانٍ: إعادة تشغيل sync + bootstrap');
  await sequelize.sync({ alter: false });
  const boot2 = await require(`${ROOT}/growth/bootstrap`).initialize(sequelize);
  ok('التهيئة idempotent — لا تفشل عند الإقلاع الثاني', boot2.ok === true);
  ok('القيود تُعاد بلا خطأ', boot2.constraints === 9, `(${boot2.constraints})`);

  const roles=require(`${ROOT}/growth/services/role.service`);
  const roleList = await roles.list();
  ok('الأدوار لم تتضاعف', roleList.length === 4, `(${roleList.length})`);

  // ── المرحلة 5: الأدمن القديم يصل الوحدة ─────────────────────────────────
  ok('الأدمن القديم يتخطّى فحص الصلاحيات',
    await roles.has({ id: legacy.id, role: 'admin' }, 'settings:write'));
  ok('المستخدم العادي القديم لا يصل',
    !(await roles.has({ id: legacy2.id, role: 'user' }, 'settings:write')));

  // ── المرحلة 6: القيود فعّالة على القاعدة المرقّاة ────────────────────────
  console.log('\n━━ القيود على قاعدة مرقّاة');
  let neg=null;
  try { await sequelize.query(`UPDATE growth_profiles SET credit_balance=-1 WHERE user_id=${legacy2.id}`);}
  catch(e){neg=e;}
  ok('قيد عدم السالبية فعّال', !!neg);

  let self=null;
  try { await sequelize.query(
    `INSERT INTO referral_events (referral_link_id,referrer_id,referee_id,stage_reached,"createdAt","updatedAt")
     VALUES (1,${legacy.id},${legacy.id},'clicked',NOW(),NOW())`);}
  catch(e){self=e;}
  ok('قيد منع الإحالة الذاتية فعّال', !!self);

  const rec = await credits.reconcile();
  ok('الدفتر متّسق بعد الترقية', rec.healthy);

  console.log('\n'+'═'.repeat(52));
  console.log(`النتيجة: ${pass} نجح · ${fail} فشل`);
  await sequelize.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('\n💥',e.message);console.error(e.stack.split('\n').slice(0,6).join('\n'));process.exit(1);});
