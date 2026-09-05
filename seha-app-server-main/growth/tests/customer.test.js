// ───────────────────────────────────────────────────────────────────────────
// اختبار حلقة النمو كاملة — من إنشاء الحساب إلى مكافأة المُحيل.
//
// يتحقّق أن الخطّافات موصولة فعلاً بمسارات المنصة القائمة: إنشاء مستخدم
// عبر متحكّم المستخدمين الحقيقي، وإصدار مستند عبر متحكّم الإجازات الحقيقي.
// بدون هذا الوصل يبقى القمع ميتاً و MAPU صفراً مهما بدت الوحدة مكتملة.
//
//   TEST_DATABASE_URL=postgresql://user@host:5432/dbname npm run test:growth:flow
//
// تحذير: يشغّل sync({ force: true }) فيمسح كل الجداول.
// ───────────────────────────────────────────────────────────────────────────

process.env.JWT_SECRET = process.env.JWT_SECRET || 'growth-test-secret';

const { setupTestDb } = require('./setup');

const { sequelize, models } = setupTestDb();
const ROOT = require('path').join(__dirname, '..');

const express = require('express');
const jwt = require('jsonwebtoken');
const bootstrap = require(`${ROOT}/bootstrap`);
const settings = require(`${ROOT}/services/settings.service`);
const credits = require(`${ROOT}/services/credit.service`);

let pass = 0, fail = 0;
const ok = (n, c, x = '') => { if (c) { pass++; console.log(`  ✅ ${n}`); } else { fail++; console.log(`  ❌ ${n} ${x}`); } };
const section = (t) => console.log(`\n━━ ${t}`);

(async () => {
  await sequelize.authenticate();
  await sequelize.sync({ force: true });
  await bootstrap.initialize(sequelize);

  const {
    User, GrowthProfile, ReferralLink, ReferralEvent, RewardGrant,
    GrowthProduct, CreditTransaction,
  } = models;

  // متحكّمات المنصة القائمة — نستدعيها كما يستدعيها الخادم تماماً.
  const usersController = require(`${ROOT}/../controller/users.controller`);
  const growthRoutes = require(`${ROOT}/routes`);

  const app = express();
  app.use(express.json());
  app.use('/growth', growthRoutes);
  const server = app.listen(0);
  const B = `http://127.0.0.1:${server.address().port}/growth`;

  const admin = await User.create({ name: 'Admin', email: 'a@x.com', password: 'x', role: 'admin' });
  const adminT = jwt.sign({ id: admin.id, name: 'Admin', email: 'a@x.com', role: 'admin' },
    process.env.JWT_SECRET, { expiresIn: '1h' });

  const call = async (method, path, { token, body } = {}) => {
    const res = await fetch(B + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let json = null; try { json = await res.json(); } catch { /* غير JSON */ }
    return { status: res.status, body: json };
  };

  /** ينادي متحكّم إنشاء المستخدم الحقيقي بردّ وهمي. */
  const createUserViaController = async (payload) => {
    const req = { body: payload, user: { id: admin.id, role: 'admin' }, headers: {}, get: () => null };
    let captured = null;
    const res = {
      status(c) { this._c = c; return this; },
      json(p) { captured = { status: this._c, body: p }; return this; },
    };
    await usersController.createUser(req, res);
    return captured;
  };

  // ══════════════════════════════════════════════════════════════════════
  section('خطّاف التسجيل موصول بمتحكّم المستخدمين');
  await settings.setMany({ 'credits.signup_bonus': 15 }, { actorId: admin.id });

  const created = await createUserViaController({
    name: 'Layla', email: 'layla@x.com', password: 'secret123', role: 'user',
  });
  ok('المستخدم أُنشئ عبر المتحكّم القائم', created?.status === 201, JSON.stringify(created?.body?.message));

  const layla = await User.findOne({ where: { email: 'layla@x.com' } });
  const laylaProfile = await GrowthProfile.findOne({ where: { user_id: layla.id } });
  ok('الملف التجاري أُنشئ تلقائياً', !!laylaProfile);
  ok('رمز إحالة شخصي مولَّد', !!laylaProfile?.personal_referral_code
    && laylaProfile.personal_referral_code.length === 8);
  ok('الرصيد الترحيبي مُنح من الإعدادات (15)',
    laylaProfile?.credit_balance === 15, `(${laylaProfile?.credit_balance})`);

  // ══════════════════════════════════════════════════════════════════════
  section('إسناد الإحالة عند إنشاء الحساب');
  const link = await ReferralLink.create({
    owner_id: layla.id, code: 'LAYLA1', type: 'personal', is_active: true,
    payout_schedule: [
      { milestone: 'verified', party: 'referee', amount: 20 },
      { milestone: 'activated', party: 'referrer', amount: 30 },
      { milestone: 'first_purchase', party: 'referrer', amount: 45 },
    ],
  });

  await createUserViaController({
    name: 'Omar', email: 'omar@x.com', password: 'secret123', role: 'user',
    referral_code: 'LAYLA1',
  });
  const omar = await User.findOne({ where: { email: 'omar@x.com' } });
  const omarProfile = await GrowthProfile.findOne({ where: { user_id: omar.id } });
  ok('المُحال إليه مُسنَد للمُحيل', omarProfile?.referred_by_user_id === layla.id);

  const event = await ReferralEvent.findOne({ where: { referee_id: omar.id } });
  ok('حدث الإحالة أُنشئ بمرحلة registered', event?.stage_reached === 'registered');

  const selfTry = await createUserViaController({
    name: 'Self', email: 'self@x.com', password: 'secret123', role: 'user',
    referral_code: laylaProfile.personal_referral_code,
  });
  ok('رمز غير مرتبط برابط لا يكسر إنشاء الحساب', selfTry?.status === 201);

  // ══════════════════════════════════════════════════════════════════════
  section('خطّاف إصدار المستند يقود القمع');
  await settings.setMany({
    'credits.cost_per_document': 2, 'referral.meaningful_action_count': 3,
  }, { actorId: admin.id });

  const hooks = require(`${ROOT}/hooks`);

  // التوثيق يفتح بوابة أول دفعة
  await hooks.onUserVerified({ userId: omar.id });
  let omarBal = (await credits.getBalance(omar.id)).credit_balance;
  ok('المُحال إليه مُنح 20 عند التوثيق (15 ترحيبي + 20)',
    omarBal === 35, `(${omarBal})`);

  const laylaBefore = (await credits.getBalance(layla.id)).credit_balance;

  // أول مستند = التفعيل
  await hooks.onDocumentCreated({ userId: omar.id, documentId: 'doc-1' });
  const omarAfter1 = await GrowthProfile.findOne({ where: { user_id: omar.id } });
  ok('التفعيل سُجّل عند أول مستند', !!omarAfter1.activated_at);
  ok('عدّاد المستندات = 1', omarAfter1.documents_created === 1);
  ok('الرصيد خُصم بتكلفة المستند (35 − 2 = 33)',
    omarAfter1.credit_balance === 33, `(${omarAfter1.credit_balance})`);

  const laylaAfterAct = (await credits.getBalance(layla.id)).credit_balance;
  ok('المُحيل مُنح 30 عند تفعيل المُحال إليه',
    laylaAfterAct === laylaBefore + 30, `(${laylaAfterAct} vs ${laylaBefore + 30})`);

  const evAfterAct = await ReferralEvent.findByPk(event.id);
  ok('مرحلة القمع تقدّمت إلى activated', evAfterAct.stage_reached === 'activated');

  // المستند الثالث = الفعل الجوهري
  await hooks.onDocumentCreated({ userId: omar.id, documentId: 'doc-2' });
  await hooks.onDocumentCreated({ userId: omar.id, documentId: 'doc-3' });
  const evAfterMeaning = await ReferralEvent.findByPk(event.id);
  ok('المستند الثالث يرقّي المرحلة إلى meaningful_action',
    evAfterMeaning.stage_reached === 'meaningful_action', evAfterMeaning.stage_reached);

  // نفس المستند مرتين لا يُخصم مرتين
  const balBefore = (await credits.getBalance(omar.id)).credit_balance;
  await hooks.onDocumentCreated({ userId: omar.id, documentId: 'doc-3' });
  const balAfter = (await credits.getBalance(omar.id)).credit_balance;
  ok('إعادة نفس المستند لا تخصم مرتين', balBefore === balAfter, `(${balBefore} → ${balAfter})`);

  // ══════════════════════════════════════════════════════════════════════
  section('نقص الرصيد لا يمنع الإصدار افتراضياً');
  const poor = await User.create({ name: 'Poor', email: 'poor@x.com', password: 'x', role: 'user' });
  await credits.ensureProfile(poor.id);
  const softRes = await hooks.onDocumentCreated({ userId: poor.id, documentId: 'doc-poor' });
  const poorProfile = await GrowthProfile.findOne({ where: { user_id: poor.id } });
  ok('enforce=false: العملية تنجح ولا تُسقط الإصدار', softRes.ok === true);
  ok('العدّاد يتقدّم رغم تعذّر الخصم', poorProfile.documents_created === 1);
  ok('الرصيد بقي صفراً ولم يصر سالباً', poorProfile.credit_balance === 0);

  let enforced = null;
  try {
    await hooks.onDocumentCreated({ userId: poor.id, documentId: 'doc-poor-2', enforce: true });
  } catch (e) { enforced = e; }
  ok('enforce=true: نقص الرصيد يرمي خطأً يمنع الإصدار',
    enforced?.code === 'INSUFFICIENT_CREDITS');

  // ══════════════════════════════════════════════════════════════════════
  section('مسارات واجهة العميل');
  const product = await GrowthProduct.create({
    name: 'باقة برو', slug: 'pro', kind: 'subscription', billing_cycle: 'monthly',
    price: 199, credits_granted: 300, currency: 'SAR', is_active: true, is_visible: true,
    features: { whatsapp: true },
  });
  await GrowthProduct.create({
    name: 'باقة مخفية', slug: 'hidden', kind: 'credit_pack',
    price: 50, credits_granted: 60, is_active: true, is_visible: false,
  });

  const store = await call('GET', '/public/products');
  ok('واجهة المتجر تُظهر المرئي فقط',
    store.body.data.length === 1 && store.body.data[0].slug === 'pro');
  ok('لا تسريب لحقول داخلية في المتجر',
    !('created_by' in store.body.data[0]) && !('metadata' in store.body.data[0]));

  const omarT = jwt.sign({ id: omar.id, name: 'Omar', email: 'omar@x.com', role: 'user' },
    process.env.JWT_SECRET, { expiresIn: '1h' });

  const meProfile = await call('GET', '/me', { token: omarT });
  ok('العميل يقرأ ملفه', meProfile.status === 200 && meProfile.body.data.referral_code);

  const myOrder = await call('POST', '/me/orders', {
    token: omarT, body: { product_id: product.id },
  });
  ok('العميل ينشئ طلباً لنفسه ⇒ 201', myOrder.status === 201);
  ok('الرد يحمل تعليمات الدفع من الإعدادات',
    'payment' in myOrder.body.data && 'whatsapp' in myOrder.body.data.payment);
  const orderId = myOrder.body.data.order.id;

  const proof = await call('POST', `/me/orders/${orderId}/payment`, {
    token: omarT, body: { payment_reference: 'TRX-9', note: 'حوّلت' },
  });
  ok('العميل يرفق إثبات الدفع ⇒ 200', proof.status === 200);

  // عميل آخر لا يستطيع المساس بطلب غيره
  const laylaT = jwt.sign({ id: layla.id, name: 'Layla', email: 'layla@x.com', role: 'user' },
    process.env.JWT_SECRET, { expiresIn: '1h' });
  const foreign = await call('POST', `/me/orders/${orderId}/payment`, {
    token: laylaT, body: { payment_reference: 'HACK' },
  });
  ok('عميل آخر لا يمسّ طلب غيره ⇒ 403', foreign.status === 403);

  const otherOrders = await call('GET', '/me/orders', { token: laylaT });
  ok('كل عميل يرى طلباته فقط', otherOrders.body.data.length === 0);

  // ══════════════════════════════════════════════════════════════════════
  section('اعتماد الطلب يُكمل حلقة الإحالة');
  const laylaPrePurchase = (await credits.getBalance(layla.id)).credit_balance;
  const approved = await call('POST', `/orders/${orderId}/approve`, {
    token: adminT, body: { payment_reference: 'TRX-9' },
  });
  ok('الاعتماد ⇒ 200', approved.status === 200);

  const omarFinal = (await credits.getBalance(omar.id)).credit_balance;
  ok('العميل مُنح 300 رصيداً', omarFinal >= 300, `(${omarFinal})`);

  const laylaFinal = (await credits.getBalance(layla.id)).credit_balance;
  ok('المُحيل مُنح 45 عند أول شراء للمُحال إليه',
    laylaFinal === laylaPrePurchase + 45, `(${laylaFinal} vs ${laylaPrePurchase + 45})`);

  const evFinal = await ReferralEvent.findByPk(event.id);
  ok('القمع بلغ first_purchase', evFinal.stage_reached === 'first_purchase');
  ok('حالة الدفع مكتملة', evFinal.payout_status === 'complete', evFinal.payout_status);

  const grants = await RewardGrant.findAll({ where: { referral_event_id: event.id } });
  ok('ثلاث منح مسجَّلة (مُحال إليه + مُحيل ×2)', grants.length === 3, `(${grants.length})`);
  ok('كل المنح ممنوحة', grants.every((g) => g.status === 'granted'));

  // ══════════════════════════════════════════════════════════════════════
  section('صفحة الإحالة للعميل');
  const myRef = await call('GET', '/me/referral', { token: laylaT });
  ok('المُحيل يرى رابطه وجدول دفعاته',
    myRef.body.data.code === 'LAYLA1' && myRef.body.data.payout_schedule.length === 3);
  ok('الإحصاءات تعكس الواقع',
    myRef.body.data.stats.activated === 1 && myRef.body.data.stats.credits_earned === 75,
    JSON.stringify(myRef.body.data.stats));

  const track = await call('GET', '/r/LAYLA1');
  ok('تتبّع النقرة يعمل بلا مصادقة', track.status === 200 && track.body.data.tracked === true);

  const badTrack = await call('GET', '/r/NOPE');
  ok('رمز باطل يُرجع tracked=false لا خطأً',
    badTrack.status === 200 && badTrack.body.data.tracked === false);

  // ══════════════════════════════════════════════════════════════════════
  section('سلامة الدفتر بعد الحلقة كاملة');
  const rec = await credits.reconcile();
  ok('I1 محفوظ بعد كل ما سبق', rec.healthy, JSON.stringify(rec.discrepancies));

  const allTx = await CreditTransaction.findAll({ order: [['id', 'ASC']] });
  const byUser = {};
  let chainOk = true;
  for (const t of allTx) {
    if (t.balance_after !== t.balance_before + t.amount) chainOk = false;
    if (byUser[t.user_id] !== undefined && t.balance_before !== byUser[t.user_id]) chainOk = false;
    byUser[t.user_id] = t.balance_after;
  }
  ok('I3 السلسلة متّصلة لكل المستخدمين', chainOk);

  const analytics = require(`${ROOT}/services/analytics.service`);
  const mapu = await analytics.mapu();
  ok('MAPU لم يعد صفراً — القمع حيّ', mapu >= 1, `(${mapu})`);

  console.log(`\n${'═'.repeat(56)}`);
  console.log(`النتيجة: ${pass} نجح · ${fail} فشل`);
  server.close();
  await sequelize.close();
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => {
  console.error('\n💥', e.message);
  console.error(e.stack.split('\n').slice(0, 8).join('\n'));
  process.exit(1);
});
