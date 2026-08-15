// ───────────────────────────────────────────────────────────────────────────
// طبقة إرسال واتساب (Baileys) — المكان الوحيد الذي يمكن فيه التحكّم في صورة
// معاينة المستند.
//
// الخلفية الهندسية (مُثبتة بالتجربة لا بالافتراض):
// واتساب يتجاهل أي معاينة مخزّنة داخل الـ PDF. الصورة التي تظهر في المحادثة هي
// حقل مستقل في الرسالة نفسها: DocumentMessage.jpegThumbnail. ومن يبني الرسالة
// هو من يحدّد ذلك الحقل. عند المشاركة عبر navigator.share يبني واتساب الرسالة
// بنفسه فيولّد معاينة حادّة ولا سبيل للتدخّل؛ ولذلك يُرسل الخادم الرسالة بنفسه
// هنا، فيمرّر:
//
//     document      = بايتات الـ PDF كما هي تماماً (لا تُقرأ ولا تُعدَّل هنا)
//     jpegThumbnail = صورة صغيرة مموّهة نبنيها في middlewares/whatsappThumbnail
//
// النتيجة: المعاينة في المحادثة غائمة، والملف عند فتحه أصلي وحادّ 100% من
// اللحظة الأولى — لأن الملف لم يُمسّ إطلاقاً.
//
// ملاحظة موثّقة عن Baileys: التوليد التلقائي للمصغّرة يجري للصور والفيديو فقط
// (Utils/messages.js)، أما المستندات فلا تُولَّد لها مصغّرة أبداً، والقيمة التي
// نمرّرها تُنسخ كما هي داخل DocumentMessage. فلا خطر أن «يستبدلها» شيء.
//
// حالة الجلسة (creds/keys) تُحفظ في جدول الإعدادات الموجود أصلاً بمفاتيح
// مسبوقة بـ wa_auth: — لأن قرص Render مؤقّت وتُمحى الملفات عند كل نشر، فتُفقد
// الجلسة ويُطلب مسح QR من جديد. لا جدول جديد ولا هجرة (migration).
//
// الميزة معطّلة افتراضياً: WHATSAPP_SENDER_ENABLED=true لتشغيلها.
//
// ⚠️ تنبيه إداري: هذا بروتوكول واتساب-ويب غير الرسمي، واستخدامه مخالف لشروط
// خدمة واتساب وقد يُعرّض الرقم للحظر. استخدم رقماً مخصّصاً لهذا الغرض، وأبقِ
// معدّل الإرسال منخفضاً (الوضع الافتراضي هنا يرسل إلى رقمنا نحن فقط، ثم يُعاد
// التوجيه يدوياً للزبون — وهو الأقل خطراً).
// ───────────────────────────────────────────────────────────────────────────

const { Op } = require('sequelize');
const Setting = require('../models/settings.model');

const AUTH_PREFIX = 'wa_auth:';

// مسجّل صامت — Baileys يطلب logger بواجهة pino؛ لا نريد إغراق سجلّ الخادم.
const silentLogger = {
  level: 'silent',
  child: () => silentLogger,
  trace: () => {}, debug: () => {}, info: () => {},
  warn: () => {}, error: () => {}, fatal: () => {},
};

const isEnabled = () =>
  String(process.env.WHATSAPP_SENDER_ENABLED || '').trim().toLowerCase() === 'true';

/**
 * توحيد رقم الجوال إلى صيغة دولية بالأرقام فقط (بلا + ولا أصفار بادئة).
 * يقبل الصيغ الشائعة محلياً: 05xxxxxxxx / 5xxxxxxxx / 9665xxxxxxxx / +966 5x xxx xxxx
 * والأرقام الدولية تُترك كما هي (مثال: 967xxxxxxxxx يبقى كذلك ولا يُحوَّل للسعودية).
 */
function normalizeMsisdn(number) {
  let digits = String(number || '').replace(/\D+/g, '');
  if (!digits) throw new Error('رقم الجوال غير صالح');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = `966${digits.slice(1)}`;
  else if (digits.length === 9 && digits.startsWith('5')) digits = `966${digits}`;
  if (digits.length < 10) throw new Error('رقم الجوال غير مكتمل');
  // الحدّ الأعلى في معيار E.164 خمس عشرة خانة. كان الفحص على الحدّ الأدنى فقط،
  // فيمرّ رقم مشوّه مثل 96773527236680 (١٤ خانة) بلا اعتراض.
  if (digits.length > 15) throw new Error('رقم الجوال أطول من المسموح (١٥ خانة كحدّ أقصى)');
  return digits;
}

/** تحويل رقم جوال إلى JID واتساب. */
function toJid(number) {
  return `${normalizeMsisdn(number)}@s.whatsapp.net`;
}

// ── حالة الجلسة داخل جدول الإعدادات ────────────────────────────────────────
async function useSettingsAuthState() {
  const { initAuthCreds, BufferJSON, proto } = await import('@whiskeysockets/baileys');

  const read = async (key) => {
    const row = await Setting.findOne({ where: { key: AUTH_PREFIX + key } });
    if (!row || row.value == null) return null;
    try { return JSON.parse(row.value, BufferJSON.reviver); } catch { return null; }
  };
  const write = async (key, value) => {
    const payload = JSON.stringify(value, BufferJSON.replacer);
    const row = await Setting.findOne({ where: { key: AUTH_PREFIX + key } });
    if (row) await row.update({ value: payload });
    else await Setting.create({ key: AUTH_PREFIX + key, value: payload, description: 'WhatsApp session state' });
  };
  const remove = (key) => Setting.destroy({ where: { key: AUTH_PREFIX + key } });

  const creds = (await read('creds')) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          await Promise.all(ids.map(async (id) => {
            let value = await read(`${type}-${id}`);
            if (type === 'app-state-sync-key' && value) {
              value = proto.Message.AppStateSyncKeyData.fromObject(value);
            }
            data[id] = value;
          }));
          return data;
        },
        set: async (data) => {
          const jobs = [];
          for (const type of Object.keys(data)) {
            for (const id of Object.keys(data[type])) {
              const value = data[type][id];
              jobs.push(value ? write(`${type}-${id}`, value) : remove(`${type}-${id}`));
            }
          }
          await Promise.all(jobs);
        },
      },
    },
    saveCreds: () => write('creds', creds),
    clearAll: () => Setting.destroy({ where: { key: { [Op.like]: `${AUTH_PREFIX}%` } } }),
  };
}

// ── الاتصال ────────────────────────────────────────────────────────────────
let _sock = null;
let _sockState = null;      // حالة المصادقة المرافقة للمقبس الحالي (creds/keys)
let _connecting = null;
let _qrDataUrl = null;      // آخر رمز QR للإقران (يُمسح فور نجاح الاتصال)
let _connected = false;
let _lastError = null;
let _needsPairing = false;  // ظهر رمز QR ⇒ الرقم غير مقترن بعد

// ── الإقران برقم الهاتف (بديل مسح QR) ──────────────────────────────────────
// واتساب يتيح طريقتين لربط جهاز: مسح رمز QR، أو إدخال رقم الحساب على الخادم ثم
// كتابة رمز من ٨ خانات في الهاتف. الثانية أنسب هنا لأن المستخدم يفتح الإعدادات
// على الهاتف نفسه فلا توجد شاشة ثانية يمسح منها.
//
// تصحيح لما كان مكتوباً هنا سابقاً: الرمز **لا يصدره خادم واتساب**. تسكّه مكتبة
// Baileys محلياً ثم تسجّله لدى واتساب (التفصيل والدليل فوق maybeRequestPairingCode).
// ولذلك ظهور الرمز ليس دليلاً على صحّة الرقم؛ الدليل الوحيد هو بلوغ الحالة
// connection === 'open' بعد كتابة الرمز في الهاتف.
let _pairingNumber = null;   // الرقم المطلوب إقرانه (صيغة دولية، أرقام فقط)
let _pairingCode = null;     // رمز الإقران الحالي (تسكّه Baileys وتسجّله لدى واتساب)
let _pairingRequested = false;
let _pairingCodeAt = 0;      // وقت سكّ الرمز — الرمز يفقد صلاحيته بعد دقائق
// صلاحية رمز الإقران. بعدها لا يُقبل على الهاتف، فيجب سكّ رمز جديد بدل إبقاء
// رمز ميّت معروضاً في الواجهة.
const PAIRING_CODE_TTL_MS = Number(process.env.WHATSAPP_PAIRING_TTL_MS || 180000);

// مهلة انتظار اكتمال الاتصال قبل الإرسال. فتح الجلسة بعد إقلاع الخادم يستغرق
// عادةً ثانيتين إلى خمس.
const CONNECT_TIMEOUT_MS = Number(process.env.WHATSAPP_CONNECT_TIMEOUT_MS || 25000);

/**
 * ينتظر حتى تُفتح الجلسة فعلياً.
 *
 * لماذا؟ makeWASocket يعود فوراً، وحالة connection === 'open' تصل لاحقاً عبر
 * حدث. بدون هذا الانتظار كان أول إرسال بعد إقلاع الخادم يفشل برسالة «غير
 * متصل» رغم أن الجلسة سليمة وتُفتح بعد لحظة.
 */
async function waitForOpen(timeoutMs = CONNECT_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  while (!_connected) {
    if (_needsPairing) {
      throw new Error('الرقم غير مقترن — افتح الإعدادات ← ربط واتساب وأكمل الإقران');
    }
    if (Date.now() >= deadline) {
      throw new Error(`تعذّر الاتصال بواتساب خلال ${Math.round(timeoutMs / 1000)} ثانية${_lastError ? ` (${_lastError})` : ''}`);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
}

/**
 * يسكّ رمز إقران للرقم المُدخل ويسجّله لدى واتساب. يُستدعى عند وصول حدث QR فقط،
 * أي بعد أن يكون WebSocket مفتوحاً فعلاً مع خادم واتساب — الطلب قبل ذلك يفشل.
 *
 * ⚠️ توضيح جوهري عن البروتوكول (مصدره كود Baileys نفسه:
 * lib/Socket/socket.js سطر 597):
 *
 *     const pairingCode = customPairingCode ?? bytesToCrockford(randomBytes(5))
 *
 * الرمز **تسكّه المكتبة محلياً**، ثم تشتقّ منه مفتاحاً تُعمّي به مفتاحها العابر
 * وترسله لواتساب في وسم link_code_companion_reg. أي أن الرمز سرّ مشترك يختاره
 * الجهاز المرافق، لا قيمة يصدرها خادم واتساب — وهكذا صُمّم «الربط برقم الهاتف»
 * أصلاً، إذ يُستخدم الرمز مُدخلاً لاشتقاق المفتاح.
 *
 * ويترتّب على ذلك أمر يجب ألّا يُساء فهمه: `requestPairingCode` تستخدم
 * `sendNode` (إرسال بلا انتظار ردّ) لا `query`، وتعيد الرمز فوراً. فظهور الرمز
 * **لا يثبت** أن الرقم صحيح ولا أنه مسجّل في واتساب ولا أن واتساب قبِل التسجيل.
 * الدليل الوحيد على نجاح الإقران هو وصول connection === 'open' لاحقاً، بعد أن
 * يكتب المستخدم الرمز في هاتفه فيتمّ التبادل المُعمّى في messages-recv.js.
 */
async function maybeRequestPairingCode(sock, state) {
  if (!_pairingNumber || _connected) return;
  if (state?.creds?.registered) return;
  // الرمز يفقد صلاحيته بعد دقائق. كان الشرط `_pairingRequested` وحده يمنع أي
  // تجديد، فيبقى رمز ميّت معروضاً في الواجهة إلى ما لا نهاية رغم تكرار حدث QR.
  const fresh = _pairingCode && (Date.now() - _pairingCodeAt) < PAIRING_CODE_TTL_MS;
  if (_pairingRequested && fresh) return;
  _pairingRequested = true;
  try {
    const code = await sock.requestPairingCode(_pairingNumber);
    if (!code) throw new Error('لم تُعِد المكتبة أي رمز');
    _pairingCode = code;
    _pairingCodeAt = Date.now();
    _lastError = null;
    console.log(`📱 WhatsApp: رمز إقران الرقم ${_pairingNumber} → ${_pairingCode}`);
  } catch (err) {
    // لا رمز بديل ولا قيمة محليّة: عند الفشل لا يُعرض شيء إطلاقاً.
    _pairingRequested = false;
    _pairingCode = null;
    _pairingCodeAt = 0;
    _lastError = `تعذّر الحصول على رمز الربط من واتساب: ${err.message}`;
    console.warn('⚠️ WhatsApp:', _lastError);
  }
}

/**
 * فتح الجلسة. عند تمرير pairingNumber يُطلب رمز إقران لذلك الرقم بدل الاكتفاء
 * برمز QR (كلاهما يظلّ متاحاً في الحالة).
 */
async function connect({ pairingNumber } = {}) {
  if (!isEnabled()) throw new Error('خدمة إرسال واتساب معطّلة (WHATSAPP_SENDER_ENABLED)');

  if (pairingNumber) {
    const digits = normalizeMsisdn(pairingNumber);
    // رقم جديد ⇒ رمز جديد. الرمز مرتبط برقم بعينه ولا يصلح لغيره.
    if (digits !== _pairingNumber) {
      _pairingNumber = digits;
      _pairingCode = null;
      _pairingRequested = false;
      _pairingCodeAt = 0;
    }
  }

  // مهم: نعيد المقبس الموجود حتى لو لم يكتمل اتصاله بعد. الشرط السابق كان
  // (_sock && _connected) فيمرّ إلى إنشاء مقبس ثانٍ بينما الأول ما زال يتصل —
  // أي جلستان متوازيتان على نفس الرقم، وهو سبب معروف لفصل واتساب للجلسات.
  if (_sock) {
    // وصل رقم بعد أن فُتح المقبس (المستخدم ضغط «بدء الربط» ومقبس الإقلاع قائم):
    // نطلب الرمز على المقبس نفسه بدل إنشاء جلسة ثانية.
    if (_pairingNumber && !_pairingCode && !_connected) {
      maybeRequestPairingCode(_sock, _sockState).catch(() => {});
    }
    return _sock;
  }
  if (_connecting) return _connecting;

  _connecting = (async () => {
    const baileys = await import('@whiskeysockets/baileys');
    const makeWASocket = baileys.default || baileys.makeWASocket;
    const { DisconnectReason, fetchLatestBaileysVersion } = baileys;
    const QRCode = require('qrcode');

    const { state, saveCreds } = await useSettingsAuthState();
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      auth: state,
      logger: silentLogger,
      printQRInTerminal: false,
      browser: ['Seha Reports', 'Chrome', '1.0.0'],
      markOnlineOnConnect: false,     // لا نسرق الإشعارات من الهاتف المقترن
      syncFullHistory: false,
    });

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) {
        _needsPairing = true;
        try { _qrDataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 320 }); }
        catch { _qrDataUrl = null; }
        // إن كان المستخدم أدخل رقماً فالإقران بالرمز أولى؛ وإلا يبقى QR.
        await maybeRequestPairingCode(sock, state);
        console.log('📱 WhatsApp: أكمل الإقران من صفحة الإعدادات (رمز الرقم أو مسح QR)');
      }
      if (connection === 'open') {
        _connected = true; _qrDataUrl = null; _lastError = null; _needsPairing = false;
        _pairingCode = null; _pairingRequested = false; _pairingCodeAt = 0;
        console.log('✅ WhatsApp connected as', sock.user?.id);
      }
      if (connection === 'close') {
        _connected = false;
        const status = lastDisconnect?.error?.output?.statusCode;
        _lastError = lastDisconnect?.error?.message || null;
        _sock = null; _sockState = null; _connecting = null;
        // رمز الإقران يصلح لجلسة واحدة فقط — يُطلب رمز جديد بعد أي انقطاع.
        _pairingCode = null; _pairingRequested = false; _pairingCodeAt = 0;
        if (status === DisconnectReason.loggedOut) {
          console.warn('⚠️ WhatsApp: تم تسجيل الخروج — يلزم إقران جديد');
          _qrDataUrl = null;
          // تسجيل الخروج حالة متوقّعة لا عطل. إبقاء «Intentional Logout» في
          // lastError كان يعرضه في الواجهة بالأحمر وكأنه فشل، فيشوّش على الحكم
          // الذي صار معلّقاً على حالة «متصل» وحدها.
          _lastError = null;
        } else {
          console.warn('⚠️ WhatsApp: انقطع الاتصال، إعادة المحاولة بعد 5 ثوانٍ:', _lastError);
          setTimeout(() => { connect().catch(() => {}); }, 5000);
        }
      }
    });

    _sock = sock;
    _sockState = state;
    return sock;
  })();

  try { return await _connecting; }
  finally { _connecting = null; }
}

/** حالة الخدمة — تستخدمها صفحة الإعدادات لعرض QR أو حالة الاتصال. */
function status() {
  return {
    enabled: isEnabled(),
    connected: _connected,
    user: _sock?.user?.id || null,
    qr: _qrDataUrl,
    needsPairing: _needsPairing,
    // رمز الإقران المرتبط بالرقم المُدخل — تعرضه الواجهة ليُكتب في الهاتف.
    // يُحجب فور انتهاء صلاحيته كي لا تعرض الواجهة رمزاً ميّتاً.
    pairingCode: (_connected || !_pairingCode
      || Date.now() - _pairingCodeAt >= PAIRING_CODE_TTL_MS) ? null : _pairingCode,
    pairingNumber: _pairingNumber,
    pairingExpiresInMs: _pairingCode
      ? Math.max(0, PAIRING_CODE_TTL_MS - (Date.now() - _pairingCodeAt))
      : 0,
    lastError: _lastError,
    defaultTarget: process.env.WHATSAPP_SELF_NUMBER || null,
  };
}

/** فصل الجلسة ومسح حالتها من قاعدة البيانات (يلزم بعدها إقران جديد). */
async function logout() {
  try { await _sock?.logout(); } catch { /* تجاهل */ }
  _sock = null; _sockState = null; _connected = false; _qrDataUrl = null; _needsPairing = false;
  _pairingNumber = null; _pairingCode = null; _pairingRequested = false; _pairingCodeAt = 0;
  _lastError = null;
  const { clearAll } = await useSettingsAuthState();
  await clearAll();
}

/**
 * إرسال مستند PDF مع صورة معاينة مخصّصة.
 * بايتات الـ PDF تُمرَّر كما هي — لا تُقرأ ولا تُعدَّل في هذه الطبقة.
 *
 * @param {{to:string, pdfBuffer:Buffer, fileName:string, thumbnail?:Buffer, caption?:string}} args
 */
async function sendDocument({ to, pdfBuffer, fileName, thumbnail, caption }) {
  const sock = await connect();
  // الجلسة قد تكون في طور الفتح (خصوصاً أول إرسال بعد إقلاع الخادم) — ننتظرها
  // بدل رفض الطلب فوراً.
  if (!_connected) await waitForOpen();
  const jid = toJid(to);

  // تأكيد أن الرقم مسجّل في واتساب. بدونه يبتلع البروتوكول الرسالة بصمت عند
  // رقم خاطئ ويظن المستخدم أنها وصلت. فحص فاشل لا يمنع الإرسال (fail-open).
  try {
    const [info] = await sock.onWhatsApp(jid);
    if (info && info.exists === false) {
      throw new Error(`الرقم ${to} غير مسجّل في واتساب`);
    }
  } catch (err) {
    if (err.message.includes('غير مسجّل')) throw err;
    console.warn('⚠️ تعذّر التحقق من الرقم (سنتابع الإرسال):', err.message);
  }

  const content = {
    document: pdfBuffer,
    mimetype: 'application/pdf',
    fileName: fileName || 'sickLeaves.pdf',
  };
  // الحقل الذي تدور حوله المهمة كلها. غيابه يعني أن واتساب سيعرض معاينة
  // مولّدة عنده (حادّة) أو أيقونة عامة.
  if (thumbnail && thumbnail.length) content.jpegThumbnail = thumbnail;
  if (caption) content.caption = caption;

  const sent = await sock.sendMessage(jid, content);
  return { id: sent?.key?.id || null, to: jid };
}

module.exports = { isEnabled, connect, status, logout, sendDocument, toJid, normalizeMsisdn };
