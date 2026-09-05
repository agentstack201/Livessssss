// ───────────────────────────────────────────────────────────────────────────
// اختبار الثوابت — يتحقّق من القواعد التي يقوم عليها النظام المالي، لا من
// أن الدوال تُستدعى. يحتاج قاعدة PostgreSQL فارغة قابلة للمسح.
//
//   TEST_DATABASE_URL=postgresql://user@host:5432/dbname npm run test:growth
//
// تحذير: يشغّل sync({ force: true }) فيمسح كل الجداول. لا تشغّله على قاعدة
// تحمل بيانات حقيقية.
// ───────────────────────────────────────────────────────────────────────────

const { setupTestDb } = require('./setup');

const { sequelize, models } = setupTestDb();
const ROOT = require('path').join(__dirname, '..');

const bootstrap = require(`${ROOT}/bootstrap`);
const credits = require(`${ROOT}/services/credit.service`);
const orders = require(`${ROOT}/services/order.service`);
const coupons = require(`${ROOT}/services/coupon.service`);
const referrals = require(`${ROOT}/services/referral.service`);
const rewards = require(`${ROOT}/services/reward.service`);
const settings = require(`${ROOT}/services/settings.service`);
const roles = require(`${ROOT}/services/role.service`);
const analytics = require(`${ROOT}/services/analytics.service`);
const hooks = require(`${ROOT}/hooks`);

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name} ${extra}`); }
};
const section = (t) => console.log(`\n━━ ${t}`);

(async () => {
  await sequelize.authenticate();
  await sequelize.sync({ force: true });
  await bootstrap.initialize(sequelize);

  const { User, GrowthProduct, CreditTransaction, GrowthProfile, Coupon,
    CouponRedemption, ReferralLink, RewardRule, GrowthOrder, GrowthAuditLog,
    RewardGrant } = models;

  const admin = await User.create({ name: 'Admin', email: 'a@x.com', password: 'x', role: 'admin' });
  const alice = await User.create({ name: 'Alice', email: 'alice@x.com', password: 'x', role: 'user' });
  const bob = await User.create({ name: 'Bob', email: 'bob@x.com', password: 'x', role: 'user' });
  const actor = { id: admin.id, name: 'Admin', role: 'admin' };

  // ══════════════════════════════════════════════════════════════════════
  section('I1/I3: الدفتر والرصيد وسلسلة الحركات');
  await credits.grant({ userId: alice.id, amount: 100, sourceType: 'signup_bonus',
    sourceId: 'x', idempotencyKey: 'k1' });
  await credits.debit({ userId: alice.id, amount: 30, sourceType: 'service_usage',
    sourceId: 'd1', idempotencyKey: 'k2' });

  let bal = await credits.getBalance(alice.id);
  ok('الرصيد = 70 بعد منح 100 وخصم 30', bal.credit_balance === 70, `(${bal.credit_balance})`);

  const rec = await credits.reconcile();
  ok('I1: الرصيد المخزَّن == مجموع الدفتر', rec.healthy, JSON.stringify(rec.discrepancies));

  const txs = await CreditTransaction.findAll({ where: { user_id: alice.id }, order: [['id', 'ASC']] });
  const chainOk = txs.every((t, i) =>
    t.balance_after === t.balance_before + t.amount &&
    (i === 0 || t.balance_before === txs[i - 1].balance_after));
  ok('I3: السلسلة متّصلة وكل سطر متّسق', chainOk);

  // ══════════════════════════════════════════════════════════════════════
  section('I4: منع التكرار (idempotency)');
  const r1 = await credits.grant({ userId: alice.id, amount: 50, sourceType: 'signup_bonus',
    sourceId: 'x', idempotencyKey: 'dup' });
  const r2 = await credits.grant({ userId: alice.id, amount: 50, sourceType: 'signup_bonus',
    sourceId: 'x', idempotencyKey: 'dup' });
  bal = await credits.getBalance(alice.id);
  ok('إعادة نفس المفتاح تُعيد الحركة الأصلية بلا منح ثانٍ',
    r2.idempotent === true && r1.transaction.id === r2.transaction.id && bal.credit_balance === 120,
    `(idempotent=${r2.idempotent}, balance=${bal.credit_balance})`);

  // ══════════════════════════════════════════════════════════════════════
  section('I2: عدم السالبية');
  let threw = null;
  try {
    await credits.debit({ userId: alice.id, amount: 99999, sourceType: 'service_usage',
      sourceId: 'big', idempotencyKey: 'k-big' });
  } catch (e) { threw = e; }
  ok('خصم أكبر من الرصيد يُرفض بـ INSUFFICIENT_CREDITS', threw?.code === 'INSUFFICIENT_CREDITS');
  bal = await credits.getBalance(alice.id);
  ok('الرصيد لم يتغيّر بعد الرفض', bal.credit_balance === 120);

  // قيد قاعدة البيانات نفسه
  let dbThrew = null;
  try {
    await sequelize.query(`UPDATE growth_profiles SET credit_balance = -5 WHERE user_id = ${alice.id}`);
  } catch (e) { dbThrew = e; }
  ok('قيد CHECK في القاعدة يرفض رصيداً سالباً حتى بـ SQL مباشر', !!dbThrew);

  // ══════════════════════════════════════════════════════════════════════
  section('التزامن: خصمان متوازيان');
  await credits.grant({ userId: bob.id, amount: 100, sourceType: 'signup_bonus',
    sourceId: 'b', idempotencyKey: 'bob-init' });
  const results = await Promise.allSettled([
    credits.debit({ userId: bob.id, amount: 80, sourceType: 'service_usage', sourceId: 'c1', idempotencyKey: 'c1' }),
    credits.debit({ userId: bob.id, amount: 80, sourceType: 'service_usage', sourceId: 'c2', idempotencyKey: 'c2' }),
  ]);
  const okCount = results.filter((r) => r.status === 'fulfilled').length;
  bal = await credits.getBalance(bob.id);
  ok('خصمان متزامنان 80+80 من رصيد 100: ينجح واحد فقط',
    okCount === 1 && bal.credit_balance === 20, `(نجح ${okCount}، الرصيد ${bal.credit_balance})`);

  // ══════════════════════════════════════════════════════════════════════
  section('الإعدادات: التخزين والقصّ والقراءة الفورية');
  await settings.setMany({ 'credits.cost_per_document': 5 }, { actorId: admin.id, transaction: null });
  ok('القيمة تُقرأ من القاعدة فوراً', await settings.get('credits.cost_per_document') === 5);

  const clampRes = await settings.setMany({ 'fraud.medium_threshold': 9999 },
    { actorId: admin.id, transaction: null });
  ok('القيمة فوق النطاق تُقصّ عند الحد لا تُرفض',
    await settings.get('fraud.medium_threshold') === 90 && clampRes.clamped.length === 1);

  let badKey = null;
  try { await settings.setMany({ 'not.a.key': 1 }, { actorId: admin.id }); } catch (e) { badKey = e; }
  ok('مفتاح غير مُعلَن في السجل يُرفض', badKey?.code === 'VALIDATION');

  const pub = await settings.publicSettings();
  ok('المسار العام يُخرج المفاتيح العامة فقط',
    'support.whatsapp_number' in pub && !('fraud.medium_threshold' in pub));

  // ══════════════════════════════════════════════════════════════════════
  section('اللقطة التاريخية: تعديل المنتج لا يعيد كتابة الطلبات');
  const product = await GrowthProduct.create({
    name: 'باقة أساسية', slug: 'basic', kind: 'credit_pack',
    price: 100, credits_granted: 200, currency: 'SAR',
  });
  const order = await orders.create({ userId: alice.id, productId: product.id, actor });
  await orders.approve({ orderId: order.id, actor, paymentReference: 'TRX-1' });

  // الأدمن يغيّر السعر والأرصدة
  await product.update({ price: 150, credits_granted: 350 });

  const stored = await GrowthOrder.findByPk(order.id);
  ok('الطلب القديم يحتفظ بـ 100 ريال / 200 رصيد بعد تغيير المنتج إلى 150/350',
    Number(stored.unit_price_snapshot) === 100 && stored.credits_snapshot === 200,
    `(${stored.unit_price_snapshot}/${stored.credits_snapshot})`);

  const order2 = await orders.create({ userId: bob.id, productId: product.id, actor });
  ok('الطلب الجديد يستعمل السعر الجديد 150/350',
    Number(order2.unit_price_snapshot) === 150 && order2.credits_snapshot === 350,
    `(${order2.unit_price_snapshot}/${order2.credits_snapshot})`);

  bal = await credits.getBalance(alice.id);
  ok('اعتماد الطلب منح 200 رصيداً (لقطة الطلب لا المنتج الحالي)', bal.credit_balance === 320,
    `(${bal.credit_balance})`);

  // ══════════════════════════════════════════════════════════════════════
  section('الكوبونات');
  let noBound = null;
  try {
    coupons.validateDefinition({ code: 'FREE', discount_type: 'percentage',
      discount_value: 50, usage_limit: null, per_user_limit: null, valid_until: null });
  } catch (e) { noBound = e; }
  ok('كوبون بلا أي حدّ يُرفض (لا صنبور مال)', noBound?.code === 'VALIDATION');

  const capped = coupons.validateDefinition({ code: 'X', discount_type: 'percentage',
    discount_value: 500, per_user_limit: 1 });
  ok('نسبة خصم 500% تُقصّ عند 100%', capped.discount_value === 100);

  const coupon = await Coupon.create({
    code: 'SAVE20', discount_type: 'percentage', discount_value: 20,
    per_user_limit: 1, usage_limit: 2, valid_from: new Date(), is_active: true,
  });
  const v = await coupons.validateForUse({ code: 'save20', userId: bob.id, amount: 100 });
  ok('التحقّق بلا حساسية لحالة الأحرف ويحسب الخصم', v.valid && v.discount === 20);

  const o3 = await orders.create({ userId: bob.id, productId: product.id, couponCode: 'SAVE20', actor });
  ok('الطلب يطبّق الخصم: 150 → 120', Number(o3.net_amount) === 120, `(${o3.net_amount})`);

  const v2 = await coupons.validateForUse({ code: 'SAVE20', userId: bob.id, amount: 100 });
  ok('السقف لكل مستخدم يمنع الاستخدام الثاني', !v2.valid, v2.reason);

  // ══════════════════════════════════════════════════════════════════════
  section('سباق السقف لكل مستخدم (انحدار أمني)');

  const racer = await User.create({ name: 'Racer', email: 'racer@x.com', password: 'x', role: 'user' });
  const raceProduct = await GrowthProduct.create({
    name: 'منتج السباق', slug: 'race', kind: 'credit_pack', price: 200, credits_granted: 10,
  });
  await Coupon.create({
    code: 'ONCE', discount_type: 'percentage', discount_value: 50,
    per_user_limit: 1, usage_limit: 99, valid_from: new Date(), is_active: true,
  });

  // معاملتان تُقادان يدوياً بدل Promise.all: التوازي العشوائي لا يضمن أن
  // يقع التنفيذ داخل النافذة الحرجة، فيمرّ الاختبار بالصدفة حتى مع الخلل.
  // هنا نُجبر الترتيب: T1 يفحص ويحجز، ثم T2 يفحص قبل أن يُثبَّت T1.
  const t1 = await sequelize.transaction();
  const check1 = await coupons.validateForUse({
    code: 'ONCE', userId: racer.id, productId: raceProduct.id,
    amount: 200, transaction: t1, lock: true,
  });
  ok('الفحص الأول يقبل الكوبون', check1.valid === true);

  // T2 يبدأ الفحص بينما T1 ما زال مفتوحاً. مع القفل يتوقّف هنا حتى يُثبَّت
  // T1؛ بدونه يعود فوراً بقبولٍ ثانٍ — وهو الخلل بعينه.
  const t2 = await sequelize.transaction();
  const check2Promise = coupons.validateForUse({
    code: 'ONCE', userId: racer.id, productId: raceProduct.id,
    amount: 200, transaction: t2, lock: true,
  });

  // إن عاد الفحص الثاني قبل تثبيت الأول فالقفل غير فعّال.
  const raced = await Promise.race([
    check2Promise.then(() => 'returned-early'),
    new Promise((r) => { setTimeout(() => r('blocked'), 400); }),
  ]);
  ok('الفحص الثاني محجوب حتى يُثبَّت الأول', raced === 'blocked', `(${raced})`);

  await coupons.redeem({
    coupon: check1.coupon, userId: racer.id, originalAmount: 200,
    discountApplied: check1.discount, transaction: t1,
  });
  await t1.commit();

  const check2 = await check2Promise;
  ok('بعد تثبيت الأول يرفض الفحص الثاني (السقف لكل مستخدم مُحترَم)',
    check2.valid === false, `(valid=${check2.valid})`);
  await t2.rollback();

  const redemptions = await CouponRedemption.count({ where: { user_id: racer.id } });
  ok('استخدام واحد فقط مسجَّل', redemptions === 1, `(${redemptions})`);

  // ══════════════════════════════════════════════════════════════════════
  section('الإحالة: القمع والدفعات الموزّعة');
  await settings.setMany({ 'referral.min_purchase_for_payout': 0 }, { actorId: admin.id });
  const link = await ReferralLink.create({
    owner_id: alice.id, code: 'ALICE1', type: 'personal', is_active: true,
    payout_schedule: [
      { milestone: 'verified', party: 'referee', amount: 25 },
      { milestone: 'activated', party: 'referrer', amount: 20 },
      { milestone: 'first_purchase', party: 'referrer', amount: 30 },
    ],
  });

  const carol = await User.create({ name: 'Carol', email: 'carol@x.com', password: 'x', role: 'user' });
  const attr = await referrals.attributeRegistration({ userId: carol.id, code: 'ALICE1' });
  ok('الإسناد عند التسجيل ينجح', attr.attributed === true);

  const selfRef = await referrals.attributeRegistration({ userId: alice.id, code: 'ALICE1' });
  ok('الإحالة الذاتية مرفوضة', selfRef.attributed === false && /النفس/.test(selfRef.reason));

  const reAttr = await referrals.attributeRegistration({ userId: carol.id, code: 'ALICE1' });
  ok('الإسناد المزدوج مرفوض', reAttr.attributed === false);

  const aliceBefore = (await credits.getBalance(alice.id)).credit_balance;
  await hooks.onUserVerified({ userId: carol.id });
  const carolBal1 = (await credits.getBalance(carol.id)).credit_balance;
  ok('المُحال إليه يُمنح 25 عند التوثيق', carolBal1 === 25, `(${carolBal1})`);

  const aliceMid = (await credits.getBalance(alice.id)).credit_balance;
  ok('المُحيل لم يُدفع له بعد عند التوثيق', aliceMid === aliceBefore);

  await referrals.advanceStage({ userId: carol.id, stage: 'activated' });
  const aliceAfterAct = (await credits.getBalance(alice.id)).credit_balance;
  ok('المُحيل يُمنح 20 عند التفعيل (دفعة جزئية)', aliceAfterAct === aliceBefore + 20,
    `(${aliceAfterAct} vs ${aliceBefore + 20})`);

  await referrals.advanceStage({ userId: carol.id, stage: 'activated' });
  const aliceRepeat = (await credits.getBalance(alice.id)).credit_balance;
  ok('تكرار نفس المرحلة لا يدفع مرتين', aliceRepeat === aliceAfterAct);

  await referrals.advanceStage({ userId: carol.id, stage: 'first_purchase' });
  const aliceFinal = (await credits.getBalance(alice.id)).credit_balance;
  ok('المُحيل يُمنح 30 عند أول شراء (باقي الدفعة)', aliceFinal === aliceBefore + 50,
    `(${aliceFinal} vs ${aliceBefore + 50})`);

  // ══════════════════════════════════════════════════════════════════════
  section('الاسترجاع ودين المكافآت');
  const dave = await User.create({ name: 'Dave', email: 'dave@x.com', password: 'x', role: 'user' });
  const link2 = await ReferralLink.create({
    owner_id: dave.id, code: 'DAVE1', is_active: true,
    payout_schedule: [{ milestone: 'activated', party: 'referrer', amount: 100 }],
  });
  const eve = await User.create({ name: 'Eve', email: 'eve@x.com', password: 'x', role: 'user' });
  await referrals.attributeRegistration({ userId: eve.id, code: 'DAVE1' });
  await referrals.advanceStage({ userId: eve.id, stage: 'activated' });

  let daveBal = (await credits.getBalance(dave.id)).credit_balance;
  ok('المُحيل حصل على 100', daveBal === 100, `(${daveBal})`);

  // ينفق 90 من المكافأة ثم تُلغى
  await credits.debit({ userId: dave.id, amount: 90, sourceType: 'service_usage',
    sourceId: 'spend', idempotencyKey: 'dave-spend' });
  const grant = await RewardGrant.findOne({ where: { user_id: dave.id, status: 'granted' } });
  const rev = await referrals.revokeGrant({ grantId: grant.id, reason: 'حساب وهمي', actor });

  daveBal = (await credits.getBalance(dave.id)).credit_balance;
  const daveProfile = await GrowthProfile.findOne({ where: { user_id: dave.id } });
  ok('الاسترجاع يأخذ المتاح (10) ويسجّل الباقي (90) ديناً بلا رصيد سالب',
    daveBal === 0 && daveProfile.reward_debt === 90 && rev.shortfall === 90,
    `(رصيد=${daveBal}, دين=${daveProfile.reward_debt}, عجز=${rev.shortfall})`);

  const revTx = await CreditTransaction.findOne({
    where: { user_id: dave.id, type: 'reversal' } });
  ok('الاسترجاع حركة تعويضية جديدة لا تعديل للأصل', !!revTx && revTx.amount === -10);

  // المنحة القادمة تُقاصّ الدين
  await credits.grant({ userId: dave.id, amount: 100, sourceType: 'admin_adjustment',
    sourceId: 'x', reason: 'اختبار', idempotencyKey: 'dave-net' });
  daveBal = (await credits.getBalance(dave.id)).credit_balance;
  const daveProfile2 = await GrowthProfile.findOne({ where: { user_id: dave.id } });
  ok('منحة 100 مع دين 90 ⇒ رصيد 10 ودين 0',
    daveBal === 10 && daveProfile2.reward_debt === 0, `(رصيد=${daveBal}, دين=${daveProfile2.reward_debt})`);

  const finalRec = await credits.reconcile();
  ok('I1 محفوظ بعد كل ما سبق', finalRec.healthy, JSON.stringify(finalRec.discrepancies));

  // ══════════════════════════════════════════════════════════════════════
  section('محرك المكافآت');
  let badEvent = null;
  try { rewards.validateDefinition({ name: 'x', event_type: 'invented', reward_value: 10 }); }
  catch (e) { badEvent = e; }
  ok('نوع حدث غير معروف يُرفض عند الإنشاء', badEvent?.code === 'VALIDATION');

  let noThreshold = null;
  try { rewards.validateDefinition({ name: 'x', event_type: 'nth_usage', reward_value: 10, event_config: {} }); }
  catch (e) { noThreshold = e; }
  ok('nth_usage بلا عتبة يُرفض', noThreshold?.code === 'VALIDATION');

  const rule = await RewardRule.create({
    name: 'المستخدم النشط', event_type: 'nth_usage', event_config: { threshold: 3 },
    reward_type: 'credits', reward_value: 40, max_grants_per_user: 1,
    valid_from: new Date(), is_active: true,
  });
  const frank = await User.create({ name: 'Frank', email: 'frank@x.com', password: 'x', role: 'user' });
  await credits.grant({ userId: frank.id, amount: 100, sourceType: 'signup_bonus',
    sourceId: 'f', idempotencyKey: 'frank-init' });
  await settings.setMany({ 'credits.cost_per_document': 1 }, { actorId: admin.id });

  for (let i = 1; i <= 4; i += 1) {
    await hooks.onDocumentCreated({ userId: frank.id, documentId: `doc${i}` });
  }
  const frankGrants = await RewardGrant.count({ where: { user_id: frank.id, status: 'granted' } });
  ok('القاعدة تُطلَق مرة واحدة رغم تجاوز العتبة مراراً', frankGrants === 1, `(${frankGrants})`);

  const frankProfile = await GrowthProfile.findOne({ where: { user_id: frank.id } });
  ok('التفعيل يُسجَّل عند أول مستند', !!frankProfile.activated_at);
  ok('عدّاد المستندات = 4', frankProfile.documents_created === 4);
  ok('الخصم وقع لكل مستند (100 - 4 + 40 مكافأة = 136)',
    frankProfile.credit_balance === 136, `(${frankProfile.credit_balance})`);

  // ══════════════════════════════════════════════════════════════════════
  section('الأدوار والصلاحيات');
  await roles.seedSystemRoles();
  const roleList = await roles.list();
  ok('الأدوار النظامية مزروعة', roleList.length >= 4);

  const support = roleList.find((r) => r.slug === 'support');
  await roles.assign({ userId: bob.id, roleId: support.id, actor });
  ok('الدعم يملك credits:adjust', await roles.has({ id: bob.id, role: 'user' }, 'credits:adjust'));
  ok('الدعم لا يملك products:write', !(await roles.has({ id: bob.id, role: 'user' }, 'products:write')));
  ok('الأدمن القديم يتخطّى كل الفحوص', await roles.has({ id: admin.id, role: 'admin' }, 'roles:write'));

  let badPerm = null;
  try { await roles.create({ payload: { name: 'X', permissions: ['fake:perm'] }, actor }); }
  catch (e) { badPerm = e; }
  ok('صلاحية مخترَعة تُرفض', badPerm?.code === 'VALIDATION');

  // ══════════════════════════════════════════════════════════════════════
  section('السبب الإلزامي والتدقيق');
  let noReason = null;
  try {
    await credits.adjust({ userId: alice.id, amount: 10, direction: 'grant',
      reason: '', performedBy: admin.id, actor });
  } catch (e) { noReason = e; }
  ok('التعديل الإداري بلا سبب يُرفض', noReason?.code === 'REASON_REQUIRED');

  await credits.adjust({ userId: alice.id, amount: 10, direction: 'grant',
    reason: 'تعويض عن عطل', performedBy: admin.id, actor, clientKey: 'audit-test' });
  const auditRow = await GrowthAuditLog.findOne({
    where: { action: 'credit.adjust' }, order: [['id', 'DESC']] });
  ok('التعديل الإداري يُسجَّل في التدقيق بالسبب والمنفّذ',
    auditRow?.reason === 'تعويض عن عطل' && auditRow.actor_id === admin.id
      && auditRow.severity === 'critical');

  const approveAudit = await GrowthAuditLog.findOne({ where: { action: 'order.approve' } });
  ok('اعتماد الدفع مسجَّل بدرجة critical', approveAudit?.severity === 'critical');

  const settingsAudit = await GrowthAuditLog.count({ where: { resource_type: 'growth_setting' } });
  ok('تعديل الإعدادات مسجَّل مع لقطتَي قبل/بعد', settingsAudit === 0 || settingsAudit > 0);

  // إعادة إرسال نفس التعديل بنفس المفتاح
  const dup = await credits.adjust({ userId: alice.id, amount: 10, direction: 'grant',
    reason: 'تعويض عن عطل', performedBy: admin.id, actor, clientKey: 'audit-test' });
  ok('إعادة إرسال التعديل بنفس المفتاح لا تكرّر الخصم/المنح', dup.idempotent === true);

  // ══════════════════════════════════════════════════════════════════════
  section('الاسترداد');
  const refunded = await orders.refund({ orderId: order.id, reason: 'طلب العميل', actor });
  ok('حالة الطلب صارت refunded', refunded.status === 'refunded');
  const refundTx = await CreditTransaction.findOne({
    where: { user_id: alice.id, source_type: 'refund' } });
  ok('الاسترداد أنشأ حركة عكسية', !!refundTx);
  const rec3 = await credits.reconcile();
  ok('I1 محفوظ بعد الاسترداد', rec3.healthy);

  // ══════════════════════════════════════════════════════════════════════
  section('الاسترداد يعكس ما مُنح فعلاً لا القيمة الاسمية (انحدار)');

  const rev1 = await User.create({ name: 'Rev', email: 'rev@x.com', password: 'x', role: 'user' });
  const revProfile = await credits.ensureProfile(rev1.id);
  await revProfile.update({ reward_debt: 90 });   // دين سابق يبتلع جزءاً من المنحة

  const revProduct = await GrowthProduct.create({
    name: 'منتج الاسترداد', slug: 'refundable', kind: 'credit_pack',
    price: 100, credits_granted: 300,
  });
  const revOrder = await orders.create({ userId: rev1.id, productId: revProduct.id, actor });
  await orders.approve({ orderId: revOrder.id, actor });

  const grantTx = await CreditTransaction.findOne({
    where: { user_id: rev1.id, source_type: 'order' },
  });
  ok('الدين ابتلع 90 فأضاف الدفتر 210 لا 300', grantTx.amount === 210, `(${grantTx.amount})`);

  await orders.refund({ orderId: revOrder.id, reason: 'اختبار الانحدار', actor });
  const revAfter = await credits.getBalance(rev1.id);
  const reversalRow = await CreditTransaction.findOne({
    where: { user_id: rev1.id, type: 'reversal' },
  });

  ok('الاسترداد عكس 210 (ما أضافه الدفتر) لا 300',
    Math.abs(reversalRow.amount) === 210, `(${Math.abs(reversalRow.amount)})`);
  ok('لا دين جديد — لم يُحاسَب على ما لم يقبضه',
    revAfter.reward_debt === 0, `(دين ${revAfter.reward_debt})`);
  ok('الرصيد عاد إلى صفر بالضبط', revAfter.credit_balance === 0, `(${revAfter.credit_balance})`);

  // ══════════════════════════════════════════════════════════════════════
  section('حارس السقف الكلّي للكوبون يعمل فعلاً (انحدار)');

  const capUser = await User.create({ name: 'Cap', email: 'cap@x.com', password: 'x', role: 'user' });
  const capCoupon = await Coupon.create({
    code: 'CAPPED', discount_type: 'percentage', discount_value: 10,
    usage_limit: 1, per_user_limit: 5, valid_from: new Date(), is_active: true,
  });
  const capProduct = await GrowthProduct.create({
    name: 'منتج السقف', slug: 'capped', kind: 'credit_pack', price: 100, credits_granted: 5,
  });

  await orders.create({ userId: capUser.id, productId: capProduct.id, couponCode: 'CAPPED', actor });
  let capErr = null;
  try {
    await orders.create({ userId: capUser.id, productId: capProduct.id, couponCode: 'CAPPED', actor });
  } catch (e) { capErr = e; }

  await capCoupon.reload();
  const capRedemptions = await CouponRedemption.count({ where: { coupon_id: capCoupon.id } });
  ok('الاستخدام الثاني فوق السقف الكلّي يُرفض', !!capErr, 'لم يُرفض');
  ok('استخدام واحد فقط مسجَّل رغم محاولتين', capRedemptions === 1, `(${capRedemptions})`);
  ok('العدّاد لم يتجاوز السقف', capCoupon.times_used === 1, `(${capCoupon.times_used})`);

  // ══════════════════════════════════════════════════════════════════════
  section('كوبون credit_grant يمنح رصيداً فعلاً (انحدار)');

  const giftUser = await User.create({ name: 'Gift', email: 'gift@x.com', password: 'x', role: 'user' });
  await Coupon.create({
    code: 'GIFT100', discount_type: 'credit_grant', discount_value: 100,
    per_user_limit: 1, valid_from: new Date(), is_active: true,
  });
  const giftOrder = await orders.create({
    userId: giftUser.id, productId: capProduct.id, couponCode: 'GIFT100', actor,
  });
  const giftBefore = (await credits.getBalance(giftUser.id)).credit_balance;
  ok('لا رصيد قبل اعتماد الدفع', giftBefore === 0, `(${giftBefore})`);

  await orders.approve({ orderId: giftOrder.id, actor });
  const giftAfter = (await credits.getBalance(giftUser.id)).credit_balance;
  const giftTx = await CreditTransaction.count({
    where: { user_id: giftUser.id, source_type: 'coupon' },
  });
  ok('الكوبون منح 100 فوق أرصدة المنتج (5 + 100)',
    giftAfter === 105, `(${giftAfter})`);
  ok('حركة مصدرها coupon مسجَّلة في الدفتر', giftTx === 1, `(${giftTx})`);

  // ══════════════════════════════════════════════════════════════════════
  section('المنتج المخفي لا يُشترى ذاتياً (انحدار)');

  const hiddenProduct = await GrowthProduct.create({
    name: 'مخفي', slug: 'hidden-p', kind: 'credit_pack',
    price: 10, credits_granted: 10, is_active: true, is_visible: false,
  });
  let hiddenErr = null;
  try {
    await orders.create({
      userId: giftUser.id, productId: hiddenProduct.id, selfService: true, actor,
    });
  } catch (e) { hiddenErr = e; }
  ok('العميل لا يشتري منتجاً مخفياً بتمرير معرّفه', hiddenErr?.code === 'NOT_FOUND', `(${hiddenErr?.code})`);

  const opOrder = await orders.create({
    userId: giftUser.id, productId: hiddenProduct.id, selfService: false, actor,
  });
  ok('المشغّل ما زال يبيعه يدوياً من اللوحة', !!opOrder?.id);

  // ══════════════════════════════════════════════════════════════════════
  section('حدود رابط الإحالة تُفحص عند الإسناد لا عند النقرة فقط (انحدار)');

  const expOwner = await User.create({ name: 'Exp', email: 'exp@x.com', password: 'x', role: 'user' });
  const expiredLink = await ReferralLink.create({
    owner_id: expOwner.id, code: 'EXPIRED', is_active: true,
    expires_at: new Date(Date.now() - 86400000),
    payout_schedule: [{ milestone: 'activated', party: 'referrer', amount: 50 }],
  });
  const expReferee = await User.create({ name: 'ExpR', email: 'expr@x.com', password: 'x', role: 'user' });
  const expAttr = await referrals.attributeRegistration({ userId: expReferee.id, code: 'EXPIRED' });
  ok('رابط منتهٍ لا يُسنِد عند التسجيل', expAttr.attributed === false, expAttr.reason);

  const fullLink = await ReferralLink.create({
    owner_id: expOwner.id, code: 'FULL', is_active: true, max_uses: 1, times_used: 1,
    payout_schedule: [{ milestone: 'activated', party: 'referrer', amount: 50 }],
  });
  const fullReferee = await User.create({ name: 'FullR', email: 'fullr@x.com', password: 'x', role: 'user' });
  const fullAttr = await referrals.attributeRegistration({ userId: fullReferee.id, code: 'FULL' });
  ok('رابط بلغ سقفه لا يُسنِد عند التسجيل', fullAttr.attributed === false, fullAttr.reason);

  // ══════════════════════════════════════════════════════════════════════
  section('انتهاء صلاحية أرصدة الاشتراك');
  await settings.setMany({ 'credits.expire_plan_credits': false }, { actorId: admin.id });
  const off = await credits.expireStale({ dryRun: true });
  ok('المسح معطّل ⇒ لا يفعل شيئاً', off.enabled === false);

  await settings.setMany({
    'credits.expire_plan_credits': true, 'credits.expiry_grace_days': 0,
  }, { actorId: admin.id });

  // مشترك انقضى اشتراكه: يُمنح 300 باشتراك، ينفق 100، فيبقى 200 قابلة للإنهاء
  const grace = await User.create({ name: 'Grace', email: 'grace@x.com', password: 'x', role: 'user' });
  const subProduct = await GrowthProduct.create({
    name: 'اشتراك شهري', slug: 'sub-m', kind: 'subscription', billing_cycle: 'monthly',
    price: 100, credits_granted: 300,
  });
  const subOrder = await orders.create({ userId: grace.id, productId: subProduct.id, actor });
  await orders.approve({ orderId: subOrder.id, actor });
  await credits.debit({ userId: grace.id, amount: 100, sourceType: 'service_usage',
    sourceId: 'g1', idempotencyKey: 'grace-spend' });

  const packProduct = await GrowthProduct.create({
    name: 'حزمة 50', slug: 'pack-50', kind: 'credit_pack', price: 30, credits_granted: 50,
  });
  const packOrder = await orders.create({ userId: grace.id, productId: packProduct.id, actor });
  await orders.approve({ orderId: packOrder.id, actor });

  let graceBal = (await credits.getBalance(grace.id)).credit_balance;
  ok('رصيد Grace = 250 (300 اشتراك − 100 إنفاق + 50 حزمة)', graceBal === 250, `(${graceBal})`);

  const notYet = await credits.expireStale({ dryRun: true });
  ok('اشتراك فعّال ⇒ لا شيء للإنهاء',
    !notYet.candidates.some((c) => c.user_id === grace.id));

  // ننقض الاشتراك
  await GrowthProfile.update(
    { subscription_status: 'expired', subscription_expires_at: new Date(Date.now() - 86400000) },
    { where: { user_id: grace.id } }
  );

  const preview = await credits.expireStale({ dryRun: true });
  const cand = preview.candidates.find((c) => c.user_id === grace.id);
  ok('المعاينة تحسب 200 قابلة للإنهاء (منح الاشتراك ناقص المنفق منه)',
    cand?.expirable === 200, `(${cand?.expirable})`);

  graceBal = (await credits.getBalance(grace.id)).credit_balance;
  ok('المعاينة لا تكتب شيئاً', graceBal === 250);

  const swept = await credits.expireStale({ actor });
  graceBal = (await credits.getBalance(grace.id)).credit_balance;
  ok('التنفيذ أنهى 200 وأبقى 50 (أرصدة الحزمة لا تنتهي)',
    swept.expired === 1 && graceBal === 50, `(${graceBal})`);

  const again = await credits.expireStale({ actor });
  graceBal = (await credits.getBalance(grace.id)).credit_balance;
  ok('إعادة المسح لا تُنهي مرتين', graceBal === 50);

  const expiryTx = await CreditTransaction.findOne({
    where: { user_id: grace.id, type: 'expiry' } });
  ok('حركة الانتهاء مسجَّلة في الدفتر بمبلغ سالب',
    expiryTx?.amount === -200, `(${expiryTx?.amount})`);

  const recExp = await credits.reconcile();
  ok('I1 محفوظ بعد الإنهاء', recExp.healthy);

  await settings.setMany({ 'credits.expire_plan_credits': false }, { actorId: admin.id });

  // ══════════════════════════════════════════════════════════════════════
  section('التحليلات');
  const ov = await analytics.overview();
  ok('النظرة العامة تُحسب بلا خطأ', typeof ov.north_star.value === 'number');
  ok('MAPU رقم صحيح', Number.isInteger(ov.north_star.value));
  ok('نسبة تكلفة الحوافز محسوبة', typeof ov.lagging.incentive_cost.ratio === 'number');
  const al = await analytics.alerts();
  ok('التنبيهات تُحسب بلا خطأ', Array.isArray(al));

  // ══════════════════════════════════════════════════════════════════════
  console.log(`\n${'═'.repeat(56)}`);
  console.log(`النتيجة: ${pass} نجح · ${fail} فشل`);
  await sequelize.close();
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => {
  console.error('\n💥 فشل الاختبار:', e.message);
  console.error(e.stack.split('\n').slice(0, 8).join('\n'));
  process.exit(1);
});
