// ───────────────────────────────────────────────────────────────────────────
// اختبار HTTP من طرف إلى طرف — يسلك السلسلة كما تسلكها اللوحة تماماً:
// طلب مصادق ← فحص صلاحية ← تحقّق مدخلات ← خدمة ← PostgreSQL ← رد.
//
//   TEST_DATABASE_URL=postgresql://user@host:5432/dbname npm run test:growth:api
//
// تحذير: يشغّل sync({ force: true }) فيمسح كل الجداول.
// ───────────────────────────────────────────────────────────────────────────

// الرموز تُوقَّع بنفس السرّ الذي يفحصه authMW، فيمرّ الطلب بالمصادقة الحقيقية
// لا بمحاكاة لها.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'growth-test-secret';

const { setupTestDb } = require('./setup');

const { sequelize, models } = setupTestDb();
const ROOT = require('path').join(__dirname, '..');

const express = require('express');
const jwt = require('jsonwebtoken');
const bootstrap = require(`${ROOT}/bootstrap`);
const roles = require(`${ROOT}/services/role.service`);

let pass = 0, fail = 0;
const ok = (n, c, x = '') => { if (c) { pass++; console.log(`  ✅ ${n}`); } else { fail++; console.log(`  ❌ ${n} ${x}`); } };
const section = (t) => console.log(`\n━━ ${t}`);

(async () => {
  await sequelize.authenticate();
  await sequelize.sync({ force: true });
  await bootstrap.initialize(sequelize);

  const { User } = models;
  const admin = await User.create({ name: 'Admin', email: 'admin@x.com', password: 'x', role: 'admin' });
  const support = await User.create({ name: 'Sup', email: 'sup@x.com', password: 'x', role: 'user' });
  const outsider = await User.create({ name: 'Out', email: 'out@x.com', password: 'x', role: 'user' });
  const customer = await User.create({ name: 'Cust', email: 'cust@x.com', password: 'x', role: 'user' });

  const roleList = await roles.list();
  await roles.assign({
    userId: support.id, roleId: roleList.find((r) => r.slug === 'support').id,
    actor: { id: admin.id, name: 'Admin', role: 'admin' },
  });

  const tok = (u) => jwt.sign({ id: u.id, name: u.name, email: u.email, role: u.role },
    process.env.JWT_SECRET, { expiresIn: '1h' });

  const app = express();
  app.use(express.json());
  app.use('/growth', require(`${ROOT}/routes`));
  const server = app.listen(0);
  const port = server.address().port;
  const B = `http://127.0.0.1:${port}/growth`;

  const call = async (method, path, { token, body } = {}) => {
    const res = await fetch(B + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let json = null;
    try { json = await res.json(); } catch { /* غير JSON */ }
    return { status: res.status, body: json };
  };

  const adminT = tok(admin), supT = tok(support), outT = tok(outsider), custT = tok(customer);

  // ══════════════════════════════════════════════════════════════════════
  section('التفويض على الخادم');
  ok('بلا رمز ⇒ 401', (await call('GET', '/products')).status === 401);
  ok('رمز صالح بلا دور ⇒ 403', (await call('GET', '/products', { token: outT })).status === 403);
  ok('الأدمن ⇒ 200', (await call('GET', '/products', { token: adminT })).status === 200);
  ok('الدعم يقرأ المنتجات (يملك products:read)',
    (await call('GET', '/products', { token: supT })).status === 200);

  const supWrite = await call('POST', '/products', {
    token: supT, body: { name: 'X', kind: 'credit_pack', price: 10, credits_granted: 10 },
  });
  ok('الدعم لا يكتب المنتجات ⇒ 403 مع اسم الصلاحية',
    supWrite.status === 403 && supWrite.body?.required === 'products:write');

  ok('الدعم لا يقرأ سجل التدقيق ⇒ 403',
    (await call('GET', '/audit', { token: supT })).status === 403);
  ok('الدعم لا يعدّل الإعدادات ⇒ 403',
    (await call('PUT', '/settings', { token: supT, body: { settings: {} } })).status === 403);

  // ══════════════════════════════════════════════════════════════════════
  section('المسارات العامة (بلا مصادقة)');
  const pub = await call('GET', '/public/settings');
  ok('إعدادات عامة تُقرأ بلا رمز',
    pub.status === 200 && 'support.whatsapp_number' in pub.body.data);
  ok('لا تسريب لمفاتيح خاصة', !('fraud.high_threshold' in pub.body.data));
  ok('واجهة المتجر تُقرأ بلا رمز', (await call('GET', '/public/products')).status === 200);

  // ══════════════════════════════════════════════════════════════════════
  section('دورة الإعداد: لوحة ← API ← قاعدة ← أثر فوري');
  const wa = '966555000111';
  const setRes = await call('PUT', '/settings', {
    token: adminT,
    body: { settings: { 'support.whatsapp_number': wa, 'payment.instructions_ar': 'حوّل ثم أرفق الإيصال' } },
  });
  ok('حفظ الإعدادات ⇒ 200', setRes.status === 200);

  const dbRow = await models.GrowthSetting.findOne({ where: { key: 'support.whatsapp_number' } });
  ok('القيمة مخزَّنة في PostgreSQL فعلاً', dbRow?.value === wa, `(${dbRow?.value})`);

  const pub2 = await call('GET', '/public/settings');
  ok('المسار العام يعكس القيمة الجديدة فوراً بلا إعادة تشغيل',
    pub2.body.data['support.whatsapp_number'] === wa);

  const clamp = await call('PUT', '/settings', {
    token: adminT, body: { settings: { 'referral.clawback_window_days': 9999 } },
  });
  ok('قيمة فوق النطاق تُقصّ ويُبلَّغ المشغّل',
    clamp.body.data.clamped.length === 1 && clamp.body.data.clamped[0].applied === 180);

  const badKey = await call('PUT', '/settings', {
    token: adminT, body: { settings: { 'made.up.key': 'x' } },
  });
  ok('مفتاح غير مُعلَن ⇒ 422', badKey.status === 422 && badKey.body.code === 'VALIDATION');

  // ══════════════════════════════════════════════════════════════════════
  section('دورة المنتج والطلب عبر HTTP');
  const created = await call('POST', '/products', {
    token: adminT,
    body: {
      name: 'باقة برو', kind: 'subscription', billing_cycle: 'monthly',
      price: 249, credits_granted: 300, currency: 'SAR', is_active: true, is_visible: true,
    },
  });
  ok('إنشاء منتج ⇒ 201', created.status === 201);
  const productId = created.body.data.id;

  const store1 = await call('GET', '/public/products');
  ok('المنتج يظهر للعميل بسعر 249',
    Number(store1.body.data.find((p) => p.id === productId).price) === 249);

  await call('PUT', `/products/${productId}`, { token: adminT, body: { price: 199 } });
  const store2 = await call('GET', '/public/products');
  ok('تغيير السعر من اللوحة يظهر للعميل فوراً (199)',
    Number(store2.body.data.find((p) => p.id === productId).price) === 199);

  await call('PUT', `/products/${productId}`, { token: adminT, body: { is_visible: false } });
  const store3 = await call('GET', '/public/products');
  ok('إخفاء المنتج يزيله من واجهة العميل فوراً',
    !store3.body.data.some((p) => p.id === productId));
  await call('PUT', `/products/${productId}`, { token: adminT, body: { is_visible: true } });

  const order = await call('POST', '/orders', {
    token: adminT, body: { user_id: customer.id, product_id: productId },
  });
  ok('إنشاء طلب ⇒ 201 مع تعليمات الدفع من الإعدادات',
    order.status === 201 && order.body.data.payment.instructions === 'حوّل ثم أرفق الإيصال'
      && order.body.data.payment.whatsapp === wa);
  const orderId = order.body.data.order.id;

  ok('الطلب سجّل السعر وقت الشراء (199)',
    Number(order.body.data.order.unit_price_snapshot) === 199);

  // الأدمن يرفع السعر بعد إنشاء الطلب
  await call('PUT', `/products/${productId}`, { token: adminT, body: { price: 399, credits_granted: 999 } });

  const approved = await call('POST', `/orders/${orderId}/approve`, {
    token: adminT, body: { payment_reference: 'BANK-77' },
  });
  ok('اعتماد الدفع ⇒ 200', approved.status === 200);

  const orderAfter = await call('GET', `/orders/${orderId}`, { token: adminT });
  ok('الطلب ما زال 199 / 300 رغم أن المنتج صار 399 / 999',
    Number(orderAfter.body.data.unit_price_snapshot) === 199
      && orderAfter.body.data.credits_snapshot === 300,
    `(${orderAfter.body.data.unit_price_snapshot}/${orderAfter.body.data.credits_snapshot})`);

  const bal = await call('GET', `/credits/${customer.id}/balance`, { token: adminT });
  ok('العميل مُنح 300 رصيداً (لقطة الطلب لا المنتج الحالي)',
    bal.body.data.credit_balance === 300, `(${bal.body.data.credit_balance})`);

  const dbl = await call('POST', `/orders/${orderId}/approve`, { token: adminT });
  ok('اعتماد ثانٍ لنفس الطلب ⇒ 409', dbl.status === 409);

  // ══════════════════════════════════════════════════════════════════════
  section('التحقّق من المدخلات والسبب الإلزامي');
  const noReason = await call('POST', '/credits/adjust', {
    token: adminT, body: { user_id: customer.id, amount: 50, direction: 'grant' },
  });
  ok('تعديل رصيد بلا سبب ⇒ 422 REASON_REQUIRED',
    noReason.status === 422 && noReason.body.code === 'REASON_REQUIRED');

  const badAmount = await call('POST', '/credits/adjust', {
    token: adminT, body: { user_id: customer.id, amount: -5, direction: 'grant', reason: 'x y z' },
  });
  ok('مبلغ سالب ⇒ 422', badAmount.status === 422);

  const adj = await call('POST', '/credits/adjust', {
    token: adminT,
    body: { user_id: customer.id, amount: 50, direction: 'grant', reason: 'تعويض عن عطل', client_key: 'ck1' },
  });
  ok('تعديل صحيح ⇒ 200 والرصيد 350', adj.status === 200 && adj.body.data.balance === 350);

  const adjDup = await call('POST', '/credits/adjust', {
    token: adminT,
    body: { user_id: customer.id, amount: 50, direction: 'grant', reason: 'تعويض عن عطل', client_key: 'ck1' },
  });
  ok('إعادة إرسال بنفس client_key لا تمنح مرتين',
    adjDup.body.data.idempotent === true && adjDup.body.data.balance === 350);

  const over = await call('POST', '/credits/adjust', {
    token: adminT,
    body: { user_id: customer.id, amount: 99999, direction: 'debit', reason: 'محاولة تجاوز' },
  });
  ok('خصم أكبر من الرصيد ⇒ 422 INSUFFICIENT_CREDITS',
    over.status === 422 && over.body.code === 'INSUFFICIENT_CREDITS');

  const noBoundCoupon = await call('POST', '/coupons', {
    token: adminT,
    body: { code: 'INFINITE', discount_type: 'percentage', discount_value: 50,
      usage_limit: null, per_user_limit: null, valid_until: null },
  });
  ok('كوبون بلا حدود ⇒ 422 (لا صنبور مال)', noBoundCoupon.status === 422);

  const badRule = await call('POST', '/rewards/rules', {
    token: adminT, body: { name: 'X', event_type: 'made_up_event', reward_value: 10 },
  });
  ok('قاعدة مكافأة بنوع حدث مخترَع ⇒ 422', badRule.status === 422);

  const badRole = await call('POST', '/roles', {
    token: adminT, body: { name: 'Fake', permissions: ['not:real'] },
  });
  ok('دور بصلاحية مخترَعة ⇒ 422', badRole.status === 422);

  // ══════════════════════════════════════════════════════════════════════
  section('تغيير الصلاحيات يسري فوراً');
  const before = await call('GET', '/products', { token: supT });
  ok('الدعم يقرأ المنتجات الآن', before.status === 200);

  const supportRole = (await roles.list()).find((r) => r.slug === 'support');
  await call('POST', '/roles/revoke', {
    token: adminT, body: { user_id: support.id, role_id: supportRole.id },
  });
  const after = await call('GET', '/products', { token: supT });
  ok('سحب الدور يمنع الوصول فوراً بنفس الرمز (الصلاحيات تُقرأ من القاعدة لا من JWT)',
    after.status === 403);

  // ══════════════════════════════════════════════════════════════════════
  section('التدقيق يلتقط كل ما سبق');
  const audit = await call('GET', '/audit?limit=200', { token: adminT });
  const actions = audit.body.data.entries.map((e) => e.action);
  ok('اعتماد الدفع مسجَّل', actions.includes('order.approve'));
  ok('تعديل الرصيد مسجَّل', actions.includes('credit.adjust'));
  ok('تعديل المنتج مسجَّل', actions.includes('product.update'));
  ok('تعديل الإعدادات مسجَّل', actions.includes('settings.update'));
  ok('سحب الدور مسجَّل', actions.includes('role.revoke'));

  // القائمة تنازلية، وهناك أكثر من تعديل إعدادات — نبحث عن سجل الواتساب تحديداً.
  const settingEntry = audit.body.data.entries.find(
    (e) => e.action === 'settings.update' && e.after && 'support.whatsapp_number' in e.after);
  ok('سجل الإعدادات يحمل لقطتَي قبل/بعد',
    settingEntry?.after['support.whatsapp_number'] === wa
      && settingEntry.before['support.whatsapp_number'] === '',
    JSON.stringify(settingEntry?.after));

  const clampEntry = audit.body.data.entries.find(
    (e) => e.action === 'settings.update' && e.after && 'referral.clawback_window_days' in e.after);
  ok('السجل يخزّن القيمة المقصوصة لا القيمة المطلوبة',
    clampEntry?.after['referral.clawback_window_days'] === 180);

  const adjEntry = audit.body.data.entries.find((e) => e.action === 'credit.adjust');
  ok('سجل تعديل الرصيد يحمل السبب والمنفّذ ودرجة critical',
    adjEntry?.reason === 'تعويض عن عطل' && adjEntry.actor_id === admin.id
      && adjEntry.severity === 'critical');

  const csv = await fetch(`${B}/audit/export`, { headers: { Authorization: `Bearer ${adminT}` } });
  const csvText = await csv.text();
  ok('تصدير CSV يعمل ويحمل ترويسة صحيحة',
    csv.status === 200 && csvText.includes('id,timestamp,actor'));

  // ══════════════════════════════════════════════════════════════════════
  section('حقن الصيغ في تصدير CSV (انحدار أمني)');

  // مستخدم مخصّص لاختبارات الأمان: لا يلمس أرصدة ولا طلبات من تعتمد عليهم
  // تأكيدات لاحقة، فيبقى كل اختبار مستقلاً عن ترتيب التنفيذ.
  const probe = await User.create({ name: 'Probe', email: 'probe@x.com', password: 'x', role: 'user' });
  const probeT = tok(probe);

  // ترويسة يضعها العميل بنفسه — لا يجوز أن تصل إلى ملف يُفتح في Excel.
  await fetch(`${B}/me/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${probeT}`,
      'X-Forwarded-For': "=cmd|' /C calc'!A0",
    },
    body: JSON.stringify({ product_id: productId }),
  });

  const injectedLog = await models.GrowthAuditLog.findOne({
    where: { action: 'order.create' }, order: [['id', 'DESC']],
  });
  ok('ترويسة X-Forwarded-For غير الصالحة لا تُخزَّن أصلاً',
    injectedLog?.ip_address === null, `(${injectedLog?.ip_address})`);

  // نزرع صيغة عبر حقل يكتبه مستخدم فعلاً ويصل التصدير: السبب.
  await call('POST', '/credits/adjust', {
    token: adminT,
    body: {
      user_id: probe.id, amount: 1, direction: 'grant',
      reason: '=HYPERLINK("http://evil","انقر")', client_key: 'csv-probe',
    },
  });

  const csvRes = await fetch(`${B}/audit/export`, { headers: { Authorization: `Bearer ${adminT}` } });
  const csvBody = await csvRes.text();
  ok('الخلية التي تبدأ بـ = تُحيَّد باقتباس مفرد',
    csvBody.includes(`"'=HYPERLINK`), 'لم يُحيَّد');
  ok('لا خلية في الملف كلّه تبدأ بمحرف صيغة',
    !/(^|,)"[=+@]/.test(csvBody), 'وُجدت خلية غير محيَّدة');

  // ══════════════════════════════════════════════════════════════════════
  section('انتحال مستخدم آخر عند إنشاء طلب (انحدار أمني)');

  const impersonate = await call('POST', '/me/orders', {
    token: probeT, body: { product_id: productId, user_id: admin.id },
  });
  ok('عميل يمرّر user_id لغيره ⇒ 403 لا تراجع صامت',
    impersonate.status === 403, `(${impersonate.status})`);

  const ownOrder = await call('POST', '/me/orders', {
    token: probeT, body: { product_id: productId, user_id: probe.id },
  });
  ok('تمرير معرّفه هو مقبول', ownOrder.status === 201, `(${ownOrder.status})`);

  const adminForOther = await call('POST', '/orders', {
    token: adminT, body: { product_id: productId, user_id: probe.id },
  });
  ok('صاحب orders:approve ما زال ينشئ لغيره', adminForOther.status === 201);

  // ══════════════════════════════════════════════════════════════════════
  section('مسارات المستخدم الحالي');
  const me = await call('GET', '/me', { token: custT });
  ok('العميل يقرأ ملفه ⇒ 200 مع رصيده', me.status === 200 && me.body.data.credit_balance === 350);
  const myOrders = await call('GET', '/me/orders', { token: custT });
  ok('العميل يقرأ طلباته', myOrders.status === 200 && myOrders.body.data.length === 1);
  const perms = await call('GET', '/me/permissions', { token: custT });
  ok('العميل بلا صلاحيات نمو', perms.body.data.has_growth_access === false);

  // ══════════════════════════════════════════════════════════════════════
  section('التحليلات والمطابقة عبر HTTP');
  const ov = await call('GET', '/analytics/overview', { token: adminT });
  ok('النظرة العامة ⇒ 200 مع MAPU',
    ov.status === 200 && typeof ov.body.data.north_star.value === 'number');
  const recon = await call('GET', '/credits/reconcile', { token: adminT });
  ok('المطابقة سليمة بعد كل العمليات', recon.body.data.healthy === true,
    JSON.stringify(recon.body.data.discrepancies));

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
