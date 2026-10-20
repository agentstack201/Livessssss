// ───────────────────────────────────────────────────────────────────────────
// اختبار «التكريم الملكي» في صفحة الدخول من طرف إلى طرف عبر HTTP:
// قراءة عامة ← حفظ مصادق بصلاحية ← تحقق صارم ← PostgreSQL ← خدمة الصورة/الصوت.
//
//   TEST_DATABASE_URL=postgresql://user@host:5432/dbname JWT_SECRET=... \
//     npm run test:tribute
//
// تحذير: يشغّل sync({ force: true }) فيمسح كل الجداول.
// ───────────────────────────────────────────────────────────────────────────

// الرموز تُوقَّع بنفس السرّ الذي يفحصه authMW.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'tribute-test-secret';
// الرفع في الذاكرة ويُحفظ كـ data URI: لا Supabase حقيقي ولا ملفات على القرص.
// (قيمة فارغة لا مجرد حذف، حتى لا يعيد dotenv ملأها من ملف .env)
process.env.VERCEL = '1';
process.env.SUPABASE_URL = '';
process.env.SUPABASE_SERVICE_ROLE_KEY = '';

const path = require('path');
const { setupTestDb } = require('../growth/tests/setup');

const { sequelize } = setupTestDb();
const ROOT = path.join(__dirname, '..');

const express = require('express');
const jwt = require('jsonwebtoken');
const { User, Permission, Media, Setting } = require(`${ROOT}/config/models_associations.js`);
const tribute = require(`${ROOT}/utils/loginTribute`);

let pass = 0, fail = 0;
const ok = (n, c, x = '') => { if (c) { pass++; console.log(`  ✅ ${n}`); } else { fail++; console.log(`  ❌ ${n} ${x}`); } };
const section = (t) => console.log(`\n━━ ${t}`);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const isArabic = (s) => typeof s === 'string' && /[؀-ۿ]/.test(s);

// بايتات معروفة نتحقق من وصولها كما هي.
const bytes = (n, seed) => Buffer.from(Array.from({ length: n }, (_, i) => (i * 31 + seed) % 256));
const dataUri = (mime, buf) => `data:${mime};base64,${buf.toString('base64')}`;

(async () => {
  await sequelize.authenticate();
  await sequelize.sync({ force: true });

  const admin = await User.create({ name: 'Admin', email: 'admin@t.com', password: 'x', role: 'admin' });
  const manager = await User.create({ name: 'Mgr', email: 'mgr@t.com', password: 'x', role: 'user' });
  const plain = await User.create({ name: 'Plain', email: 'plain@t.com', password: 'x', role: 'user' });
  const bare = await User.create({ name: 'Bare', email: 'bare@t.com', password: 'x', role: 'user' });
  await Permission.create({ user_id: manager.id, can_manage_settings: true });
  await Permission.create({ user_id: plain.id, can_manage_settings: false });

  const tok = (u) => jwt.sign({ id: u.id, name: u.name, email: u.email, role: u.role },
    process.env.JWT_SECRET, { expiresIn: '1h' });
  const adminT = tok(admin), mgrT = tok(manager), plainT = tok(plain), bareT = tok(bare);

  const JPEG = bytes(1500, 7);
  const MP3 = bytes(1000, 3);
  const mkMedia = (mime, url, name) => Media.create({
    filename: name, original_name: name, mime_type: mime, size: 10, path: `inline/${name}`, url,
  });
  const jpeg = await mkMedia('image/jpeg', dataUri('image/jpeg', JPEG), 'star.jpg');
  const remote = await mkMedia('image/png', 'https://cdn.example.com/star.png', 'remote.png');
  const pdf = await mkMedia('application/pdf', dataUri('application/pdf', bytes(50, 1)), 'doc.pdf');
  const svg = await mkMedia('image/svg+xml', dataUri('image/svg+xml', Buffer.from('<svg/>')), 'x.svg');
  const mp3 = await mkMedia('audio/mpeg', dataUri('audio/mpeg', MP3), 'shela.mp3');
  const localPath = await mkMedia('image/png', '/uploads/old.png', 'old.png');

  const app = express();
  app.use(express.json());
  app.use('/settings', require(`${ROOT}/routes/settings.route.js`));
  app.use('/media', require(`${ROOT}/routes/media.routes.js`));
  // مثل معالج الأخطاء في index.js لكن بلا طباعة المكدّس في مخرجات الاختبار.
  // eslint-disable-next-line no-unused-vars
  app.use((error, req, res, next) => {
    res.status(error.status || 500).json({ message: 'internal error ' + error.message });
  });
  const server = app.listen(0);
  const port = server.address().port;
  const B = `http://127.0.0.1:${port}`;

  const call = async (method, p, { token, body } = {}) => {
    const res = await fetch(B + p, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let json = null;
    try { json = await res.json(); } catch { /* غير JSON */ }
    return { status: res.status, headers: res.headers, body: json };
  };
  const getBin = async (p, headers = {}, method = 'GET') => {
    const res = await fetch(B + p, { method, headers, redirect: 'manual' });
    const buf = Buffer.from(await res.arrayBuffer());
    return { status: res.status, headers: res.headers, buf };
  };
  const put = (body, token = adminT) => call('PUT', '/settings/login-tribute', { token, body });
  const pub = () => call('GET', '/settings/public/login-tribute');
  const storedRow = () => Setting.findOne({ where: { key: 'login_tribute' } });
  const stored = async () => { const r = await storedRow(); return r ? JSON.parse(r.value) : null; };
  const putBad = async (name, body, field) => {
    const before = (await storedRow())?.value;
    const r = await put(body);
    const after = (await storedRow())?.value;
    ok(`${name} ⇒ 400 برسالة عربية تسمي الحقل`,
      r.status === 400 && r.body?.success === false && isArabic(r.body.message) &&
      (!field || r.body.message.includes(field)),
      `(${r.status} ${r.body?.message})`);
    ok(`  … والقيمة المحفوظة لم تتغير`, before === after);
  };

  // ══════════════════════════════════════════════════════════════════════
  section('القراءة العامة بلا إعداد محفوظ');
  const empty = await pub();
  ok('بلا رمز ⇒ 200', empty.status === 200 && empty.body.success === true);
  ok('enabled=false والروابط null',
    same(empty.body.data, { enabled: false, photoUrl: null, audioUrl: null }), JSON.stringify(empty.body.data));
  ok('Cache-Control: no-store', empty.headers.get('cache-control') === 'no-store');
  const noPhoto = await call('GET', '/settings/public/login-tribute/photo');
  ok('الصورة بلا إعداد ⇒ 404 JSON', noPhoto.status === 404 && noPhoto.body?.success === false);
  ok('الصوت بلا إعداد ⇒ 404', (await call('GET', '/settings/public/login-tribute/audio')).status === 404);
  ok('نوع غير معروف ⇒ 404', (await call('GET', '/settings/public/login-tribute/video')).status === 404);

  // ══════════════════════════════════════════════════════════════════════
  section('المصادقة والصلاحيات');
  ok('PUT بلا رمز ⇒ 401', (await call('PUT', '/settings/login-tribute', { body: { enabled: true } })).status === 401);
  ok('PUT برمز مزوّر ⇒ 401',
    (await call('PUT', '/settings/login-tribute', { token: 'abc.def.ghi', body: { enabled: true } })).status === 401);
  ok('مستخدم بلا can_manage_settings ⇒ 403', (await put({ enabled: true }, plainT)).status === 403);
  ok('مستخدم بلا سجل صلاحيات ⇒ 403', (await put({ enabled: true }, bareT)).status === 403);
  ok('لم يُحفظ شيء بعد الرفض', (await storedRow()) === null);

  const byMgr = await put({ enabled: true, hint: 'من المدير' }, mgrT);
  ok('صاحب الصلاحية ⇒ 200 برسالة الحفظ',
    byMgr.status === 200 && byMgr.body.success === true && byMgr.body.message === 'تم حفظ إعدادات التكريم',
    `(${byMgr.status} ${JSON.stringify(byMgr.body)})`);
  ok('رد الحفظ بنفس شكل القراءة العامة',
    byMgr.body.data.enabled === true && byMgr.body.data.hint === 'من المدير' &&
    byMgr.body.data.photoUrl === null && byMgr.body.data.audioUrl === null &&
    typeof byMgr.body.data.updatedAt === 'string');
  const row = await storedRow();
  ok('محفوظ تحت login_tribute بالوصف المطلوب',
    row && row.description === 'إعدادات التكريم الملكي في صفحة الدخول');
  const byAdmin = await put({ enabled: false }, adminT);
  ok('الأدمن ⇒ 200 (يتجاوز فحص الصلاحية)', byAdmin.status === 200);

  // ══════════════════════════════════════════════════════════════════════
  section('التحقق الصارم من الأنواع');
  await put({ enabled: true, hint: 'قبل الأخطاء' });
  await putBad('enabled نص', { enabled: 'yes' }, 'enabled');
  await putBad('badge نص بدل كائن', { badge: 'x' }, 'badge');
  await putBad('badge.main رقم', { badge: { main: 5 } }, 'badge.main');
  await putBad('poem نص بدل قائمة', { poem: 'بيت' }, 'poem');
  await putBad('meter.lines كائن', { meter: { lines: { a: 1 } } }, 'meter.lines');
  await putBad('shela.enabled رقم', { shela: { enabled: 1 } }, 'shela.enabled');
  await putBad('effects.stars رقم', { effects: { stars: 1 } }, 'effects.stars');
  await putBad('photo.crown.x نص رقمي', { photo: { crown: { x: '50' } } }, 'photo.crown.x');
  await putBad('photo.glasses.size null (NaN في JSON)', { photo: { glasses: { size: null } } }, 'photo.glasses.size');
  await putBad('photo.mediaId صفر', { photo: { mediaId: 0 } }, 'photo.mediaId');
  await putBad('photo.mediaId كسر', { photo: { mediaId: 1.5 } }, 'photo.mediaId');
  await putBad('audio.mediaId نص', { audio: { mediaId: '3' } }, 'audio.mediaId');
  await putBad('photo.mediaId فوق مدى INTEGER', { photo: { mediaId: 2 ** 40 } }, 'photo.mediaId');
  await putBad('الجسم مصفوفة', [1, 2]);
  const noJson = await fetch(`${B}/settings/login-tribute`, {
    method: 'PUT', headers: { Authorization: `Bearer ${adminT}`, 'Content-Type': 'text/plain' }, body: 'x',
  });
  const noJsonBody = await noJson.json().catch(() => null);
  ok('جسم ليس JSON ⇒ 400 برسالة عربية', noJson.status === 400 && isArabic(noJsonBody?.message),
    `(${noJson.status})`);

  // ══════════════════════════════════════════════════════════════════════
  section('التنظيف: قص وتشذيب وحدود وحذف المجهول');
  const long = 'ك'.repeat(300);
  const emoji = 'a'.repeat(199) + '😀';
  const full = await put({
    enabled: true,
    badge: { main: `  ${long}  `, sub: '  سطر  ', extra: 'x' },
    poem: ['١', '', '   ', 7, null, '٢', '٣', '٤', '٥', '٦'],
    hint: emoji,
    kashkha: '',
    meter: { enabled: false, loading: ' تحميل ', lines: Array.from({ length: 20 }, (_, i) => `سطر ${i}`) },
    shela: { enabled: true, lyrics: Array.from({ length: 15 }, (_, i) => ` بيت ${i} `) },
    effects: { stars: false, confetti: true, crown: false, sunglasses: true, fireworks: false, hearts: true, rain: true },
    photo: { mediaId: null, crown: { x: 150, y: -10, size: 1 }, glasses: { x: 42.5, y: 33, size: 100 }, url: 'x' },
    audio: { mediaId: null },
    foo: 'bar',
    photoUrl: 'https://evil.example/x.png',
    audioUrl: 'https://evil.example/x.mp3',
    updatedAt: '1999-01-01T00:00:00.000Z',
  });
  ok('حفظ إعداد كامل ⇒ 200', full.status === 200, `(${full.status} ${full.body?.message})`);
  const s1 = await stored();
  ok('النص الطويل يُقص إلى 200 بعد التشذيب', s1.badge.main === 'ك'.repeat(200), `(${s1.badge.main.length})`);
  ok('النصوص مشذّبة', s1.badge.sub === 'سطر' && s1.meter.loading === 'تحميل');
  ok('القص لا يشطر رمزاً تعبيرياً', s1.hint === 'a'.repeat(199), `(${s1.hint.length})`);
  ok('النص الفارغ محفوظ فارغاً (لا يرجع للافتراضي)', s1.kashkha === '');
  ok('poem: النصوص فقط، بلا فارغ، بحد 4', same(s1.poem, ['١', '٢', '٣', '٤']), JSON.stringify(s1.poem));
  ok('meter.lines بحد 12', s1.meter.lines.length === 12 && s1.meter.lines[11] === 'سطر 11');
  ok('shela.lyrics بحد 12 ومشذّبة', s1.shela.lyrics.length === 12 && s1.shela.lyrics[0] === 'بيت 0');
  ok('المواقع والأحجام مقيّدة بالمدى',
    same(s1.photo.crown, { x: 100, y: 0, size: 5 }) && same(s1.photo.glasses, { x: 42.5, y: 33, size: 60 }),
    JSON.stringify(s1.photo));
  ok('mediaId=null يُحفظ صراحة', s1.photo.mediaId === null && s1.audio.mediaId === null);
  ok('المفاتيح المجهولة محذوفة',
    !('foo' in s1) && !('photoUrl' in s1) && !('audioUrl' in s1) && !('extra' in s1.badge) &&
    !('rain' in s1.effects) && !('url' in s1.photo));
  ok('updatedAt يضعه الخادم لا العميل',
    s1.updatedAt !== '1999-01-01T00:00:00.000Z' && Math.abs(Date.parse(s1.updatedAt) - Date.now()) < 60000);
  ok('القراءة العامة تعكس المحفوظ', (await pub()).body.data.badge.main === 'ك'.repeat(200));

  const partial = await put({ enabled: true });
  ok('الحفظ الجزئي ⇒ 200', partial.status === 200);
  const s2 = await stored();
  ok('الحفظ الجزئي يخزن الحقول المرسلة فقط',
    same(Object.keys(s2).sort(), ['enabled', 'updatedAt']), JSON.stringify(s2));
  await put({ poem: [], meter: { lines: [] } });
  const s3 = await stored();
  ok('القائمة الفارغة تُحفظ فارغة', same(s3.poem, []) && same(s3.meter, { lines: [] }));
  const pubNoEnabled = await pub();
  ok('إعداد بلا enabled ⇒ enabled=false في الرد', pubNoEnabled.body.data.enabled === false);
  await put({ badge: {}, effects: {} });
  ok('كائنات فارغة لا تُحفظ', same(Object.keys(await stored()).sort(), ['updatedAt']));

  // ══════════════════════════════════════════════════════════════════════
  section('التحقق من ملفات الوسائط');
  await putBad('صورة برقم غير موجود', { photo: { mediaId: 99999 } }, '99999');
  await putBad('PDF كصورة', { photo: { mediaId: pdf.id } });
  await putBad('SVG كصورة', { photo: { mediaId: svg.id } });
  await putBad('MP3 كصورة', { photo: { mediaId: mp3.id } });
  await putBad('صورة كصوت', { audio: { mediaId: jpeg.id } });
  await putBad('صورة برابط محلي لا يُخدم', { photo: { mediaId: localPath.id } });

  const withPhoto = await put({ enabled: true, photo: { mediaId: jpeg.id } });
  ok('صورة JPEG ⇒ 200', withPhoto.status === 200, `(${withPhoto.status} ${withPhoto.body?.message})`);
  const s4 = await stored();
  const pubPhoto = await pub();
  ok('photoUrl يظهر في القراءة العامة بإصدار = updatedAt',
    pubPhoto.body.data.photoUrl === `/settings/public/login-tribute/photo?v=${Date.parse(s4.updatedAt)}`,
    pubPhoto.body.data.photoUrl);
  ok('ورد الحفظ يحمل الرابط نفسه', withPhoto.body.data.photoUrl === pubPhoto.body.data.photoUrl);
  ok('audioUrl ما زال null', pubPhoto.body.data.audioUrl === null);

  // ══════════════════════════════════════════════════════════════════════
  section('خدمة الصورة');
  const img = await getBin('/settings/public/login-tribute/photo?v=1');
  ok('data URI ⇒ 200 بالبايتات نفسها', img.status === 200 && img.buf.equals(JPEG), `(${img.status} ${img.buf.length})`);
  ok('Content-Type من نوع الملف', img.headers.get('content-type') === 'image/jpeg', img.headers.get('content-type'));
  ok('X-Content-Type-Options: nosniff', img.headers.get('x-content-type-options') === 'nosniff');
  ok('Cache-Control: public, max-age=300', img.headers.get('cache-control') === 'public, max-age=300');
  ok('Accept-Ranges: bytes', img.headers.get('accept-ranges') === 'bytes');
  const img2 = await getBin('/settings/public/login-tribute/photo');
  ok('الطلب الثاني (من الذاكرة) بالبايتات نفسها', img2.status === 200 && img2.buf.equals(JPEG));

  await put({ enabled: true, photo: { mediaId: remote.id } });
  const redir = await getBin('/settings/public/login-tribute/photo');
  ok('رابط https ⇒ 302 إليه', redir.status === 302 &&
    redir.headers.get('location') === 'https://cdn.example.com/star.png', `(${redir.status} ${redir.headers.get('location')})`);

  // إعداد مكتوب مباشرة في القاعدة يشير إلى SVG: الخادم يعيد الفحص عند القراءة.
  await Setting.update({ value: JSON.stringify({ enabled: true, photo: { mediaId: svg.id } }) },
    { where: { key: 'login_tribute' } });
  const svgPub = await pub();
  ok('SVG في الإعداد ⇒ photoUrl=null', svgPub.status === 200 && svgPub.body.data.photoUrl === null);
  ok('SVG لا يُخدم ⇒ 404', (await getBin('/settings/public/login-tribute/photo')).status === 404);
  await Setting.update({ value: JSON.stringify({ enabled: true, photo: { mediaId: pdf.id } }) },
    { where: { key: 'login_tribute' } });
  ok('PDF في الإعداد لا يُخدم ⇒ 404', (await getBin('/settings/public/login-tribute/photo')).status === 404);

  // ══════════════════════════════════════════════════════════════════════
  section('خدمة الصوت مع Range (Safari/iOS)');
  const withAudio = await put({ enabled: true, photo: { mediaId: jpeg.id }, audio: { mediaId: mp3.id } });
  ok('صوت MP3 ⇒ 200', withAudio.status === 200, `(${withAudio.status} ${withAudio.body?.message})`);
  ok('audioUrl يظهر', /^\/settings\/public\/login-tribute\/audio\?v=\d+$/.test(withAudio.body.data.audioUrl || ''),
    withAudio.body.data.audioUrl);
  const A = '/settings/public/login-tribute/audio';
  const fullA = await getBin(A);
  ok('بلا Range ⇒ 200 كامل', fullA.status === 200 && fullA.buf.equals(MP3));
  ok('  … مع Accept-Ranges وطول المحتوى',
    fullA.headers.get('accept-ranges') === 'bytes' && fullA.headers.get('content-length') === '1000');
  ok('  … ونوع audio/mpeg', fullA.headers.get('content-type') === 'audio/mpeg');
  const r1 = await getBin(A, { Range: 'bytes=0-99' });
  ok('bytes=0-99 ⇒ 206 بالشريحة الصحيحة', r1.status === 206 && r1.buf.equals(MP3.subarray(0, 100)),
    `(${r1.status} ${r1.buf.length})`);
  ok('  … Content-Range: bytes 0-99/1000', r1.headers.get('content-range') === 'bytes 0-99/1000');
  ok('  … Content-Length: 100', r1.headers.get('content-length') === '100');
  const probe = await getBin(A, { Range: 'bytes=0-1' });
  ok('مسبار Safari bytes=0-1 ⇒ بايتان', probe.status === 206 && probe.buf.equals(MP3.subarray(0, 2)));
  const r2 = await getBin(A, { Range: 'bytes=900-' });
  ok('bytes=900- ⇒ آخر 100', r2.status === 206 && r2.buf.equals(MP3.subarray(900)) &&
    r2.headers.get('content-range') === 'bytes 900-999/1000');
  const r3 = await getBin(A, { Range: 'bytes=-50' });
  ok('bytes=-50 ⇒ آخر 50', r3.status === 206 && r3.buf.equals(MP3.subarray(950)) &&
    r3.headers.get('content-range') === 'bytes 950-999/1000');
  const r4 = await getBin(A, { Range: 'bytes=500-99999' });
  ok('نهاية بعد الملف تُقص', r4.status === 206 && r4.headers.get('content-range') === 'bytes 500-999/1000' &&
    r4.buf.equals(MP3.subarray(500)));
  const bad = await getBin(A, { Range: 'bytes=5000-6000' });
  ok('نطاق خارج الملف ⇒ 416', bad.status === 416 && bad.headers.get('content-range') === 'bytes */1000',
    `(${bad.status} ${bad.headers.get('content-range')})`);
  ok('بداية بعد النهاية ⇒ 416', (await getBin(A, { Range: 'bytes=50-10' })).status === 416);
  ok('لاحقة صفرية ⇒ 416', (await getBin(A, { Range: 'bytes=-0' })).status === 416);
  const junk = await getBin(A, { Range: 'bytes=abc' });
  ok('صيغة غير مفهومة ⇒ تُتجاهل (200 كامل)', junk.status === 200 && junk.buf.equals(MP3));
  const multi = await getBin(A, { Range: 'bytes=0-1,5-6' });
  ok('نطاقات متعددة ⇒ 200 كامل', multi.status === 200 && multi.buf.length === 1000);
  const head = await getBin(A, {}, 'HEAD');
  ok('HEAD ⇒ 200 بلا جسم مع الطول', head.status === 200 && head.buf.length === 0 &&
    head.headers.get('content-length') === '1000');

  // ══════════════════════════════════════════════════════════════════════
  section('ملف محذوف بعد الحفظ');
  const gone = await mkMedia('image/png', dataUri('image/png', bytes(20, 9)), 'gone.png');
  await put({ enabled: true, photo: { mediaId: gone.id } });
  ok('قبل الحذف يُخدم', (await getBin('/settings/public/login-tribute/photo')).status === 200);
  await gone.destroy();
  ok('بعد الحذف photoUrl=null', (await pub()).body.data.photoUrl === null);
  ok('بعد الحذف ⇒ 404', (await getBin('/settings/public/login-tribute/photo')).status === 404);

  // ══════════════════════════════════════════════════════════════════════
  section('قيمة تالفة في القاعدة لا تُسقط صفحة الدخول');
  const writeRaw = (value) => Setting.update({ value }, { where: { key: 'login_tribute' } });
  await writeRaw('{not json');
  const c1 = await pub();
  ok('JSON معطوب ⇒ 200 و enabled=false',
    c1.status === 200 && same(c1.body.data, { enabled: false, photoUrl: null, audioUrl: null }), JSON.stringify(c1.body));
  ok('JSON معطوب ⇒ الصورة 404 لا 500', (await getBin('/settings/public/login-tribute/photo')).status === 404);
  await writeRaw('[1,2,3]');
  ok('مصفوفة بدل كائن ⇒ enabled=false', (await pub()).body.data.enabled === false);
  await writeRaw('null');
  ok('null ⇒ enabled=false', (await pub()).status === 200);
  await writeRaw(JSON.stringify({
    enabled: 'yes', badge: { main: 5, sub: 'سليم' }, poem: 'x', meter: 7,
    photo: { mediaId: 'abc', crown: { x: 'a', y: 500 } }, effects: { stars: 'no', hearts: false },
    updatedAt: 'ليس تاريخاً',
  }));
  const c2 = await pub();
  const d2 = c2.body.data;
  ok('أنواع خاطئة ⇒ 200 والحقول التالفة تُسقط بصمت',
    c2.status === 200 && d2.enabled === false && same(d2.badge, { sub: 'سليم' }) && !('poem' in d2) &&
    !('meter' in d2) && same(d2.photo, { crown: { y: 100 } }) && same(d2.effects, { hearts: false }) &&
    !('updatedAt' in d2) && d2.photoUrl === null, JSON.stringify(d2));
  await writeRaw(null);
  ok('قيمة فارغة ⇒ enabled=false', same((await pub()).body.data, { enabled: false, photoUrl: null, audioUrl: null }));

  // ══════════════════════════════════════════════════════════════════════
  section('المسار العام POST /settings لا يتجاوز التحقق');
  const before = (await storedRow()).value;
  const gen = await call('POST', '/settings', {
    token: adminT, body: { key: 'login_tribute', value: '{"enabled":true,"photo":{"mediaId":' + svg.id + '}}' },
  });
  ok('key=login_tribute ⇒ 400 برسالة عربية', gen.status === 400 && isArabic(gen.body?.message), `(${gen.status})`);
  ok('  … تشير إلى المسار المخصص', (gen.body?.message || '').includes('/settings/login-tribute'));
  const gen2 = await call('POST', '/settings', { token: adminT, body: { key: ' LOGIN_TRIBUTE ', value: '{}' } });
  ok('صيغة مختلفة الحالة/المسافات ⇒ 400', gen2.status === 400);
  ok('القيمة المحفوظة لم تتغير', (await storedRow()).value === before);
  const other = await call('POST', '/settings', { token: adminT, body: { key: 'site_name', value: 'صحتي' } });
  ok('مفتاح عادي ما زال يُحفظ', other.status === 200);
  const getOther = await call('GET', '/settings/site_name', { token: adminT });
  ok('GET /settings/:key ما زال يعمل', getOther.status === 200 && getOther.body.data.value === 'صحتي');

  // ══════════════════════════════════════════════════════════════════════
  section('رفع ملف صوتي إلى مكتبة الوسائط');
  const upload = async (buf, type, name) => {
    const fd = new FormData();
    fd.append('file', new Blob([buf], { type }), name);
    fd.append('category', 'tribute');
    const res = await fetch(`${B}/media/upload`, { method: 'POST', body: fd });
    let json = null;
    try { json = await res.json(); } catch { /* غير JSON */ }
    return { status: res.status, body: json };
  };
  const SONG = bytes(4096, 11);
  const up = await upload(SONG, 'audio/mpeg', 'shela-new.mp3');
  ok('MP3 (audio/mpeg) ⇒ 201', up.status === 201, `(${up.status} ${JSON.stringify(up.body)?.slice(0, 200)})`);
  ok('  … محفوظ كـ data URI بنوعه', up.body?.data?.mime_type === 'audio/mpeg' &&
    String(up.body?.data?.url).startsWith('data:audio/mpeg;base64,'));
  const upM4a = await upload(bytes(100, 2), 'audio/x-m4a', 'clip.m4a');
  ok('M4A (audio/x-m4a) ⇒ 201', upM4a.status === 201);
  const upZip = await upload(bytes(100, 2), 'application/zip', 'x.zip');
  ok('ZIP ما زال مرفوضاً برسالة تذكر الصيغ الصوتية', upZip.status !== 201 &&
    /MP3/.test(upZip.body?.message || ''), `(${upZip.status})`);
  if (up.body?.data?.id) {
    const useUp = await put({ enabled: true, audio: { mediaId: up.body.data.id } });
    ok('الملف المرفوع يُستخدم كشيلة ⇒ 200', useUp.status === 200);
    const served = await getBin(A, { Range: 'bytes=0-' });
    ok('ويُخدم بالبايتات نفسها (206 bytes=0-)', served.status === 206 && served.buf.equals(SONG) &&
      served.headers.get('content-range') === 'bytes 0-4095/4096');
  }

  // ══════════════════════════════════════════════════════════════════════
  section('وحدات مساعدة');
  ok('parseRange بلا ترويسة ⇒ null', tribute.parseRange(undefined, 10) === null);
  ok('parseRange على ملف فارغ ⇒ 416', tribute.parseRange('bytes=0-', 0) === tribute.UNSATISFIABLE);
  ok('parseRange لاحقة أكبر من الملف ⇒ كامل', same(tribute.parseRange('bytes=-50', 10), { start: 0, end: 9 }));
  ok('decodeDataUri بلا base64 ⇒ null', tribute.decodeDataUri('data:text/plain,hello') === null);
  ok('decodeDataUri base64', tribute.decodeDataUri('data:image/png;base64,AAEC').buffer.equals(Buffer.from([0, 1, 2])));
  ok('sanitize lenient على قيمة غير كائن ⇒ {}', same(tribute.sanitize('x'), {}));
  let threw = null;
  try { tribute.sanitize({ hint: 3 }, { strict: true }); } catch (e) { threw = e; }
  ok('sanitize strict يرمي TributeValidationError بالحقل',
    threw instanceof tribute.TributeValidationError && threw.field === 'hint');

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
