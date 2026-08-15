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
 * تحويل رقم جوال إلى JID واتساب. يقبل الصيغ الشائعة محلياً:
 * 05xxxxxxxx / 5xxxxxxxx / 9665xxxxxxxx / +966 5x xxx xxxx
 */
function toJid(number) {
  let digits = String(number || '').replace(/\D+/g, '');
  if (!digits) throw new Error('رقم الجوال غير صالح');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = `966${digits.slice(1)}`;
  else if (digits.length === 9 && digits.startsWith('5')) digits = `966${digits}`;
  if (digits.length < 10) throw new Error('رقم الجوال غير مكتمل');
  return `${digits}@s.whatsapp.net`;
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
let _connecting = null;
let _qrDataUrl = null;      // آخر رمز QR للإقران (يُمسح فور نجاح الاتصال)
let _connected = false;
let _lastError = null;

async function connect() {
  if (!isEnabled()) throw new Error('خدمة إرسال واتساب معطّلة (WHATSAPP_SENDER_ENABLED)');
  if (_sock && _connected) return _sock;
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
        try { _qrDataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 320 }); }
        catch { _qrDataUrl = null; }
        console.log('📱 WhatsApp: امسح رمز QR من صفحة الإعدادات لإتمام الإقران');
      }
      if (connection === 'open') {
        _connected = true; _qrDataUrl = null; _lastError = null;
        console.log('✅ WhatsApp connected as', sock.user?.id);
      }
      if (connection === 'close') {
        _connected = false;
        const status = lastDisconnect?.error?.output?.statusCode;
        _lastError = lastDisconnect?.error?.message || null;
        _sock = null; _connecting = null;
        if (status === DisconnectReason.loggedOut) {
          console.warn('⚠️ WhatsApp: تم تسجيل الخروج — يلزم إقران جديد');
          _qrDataUrl = null;
        } else {
          console.warn('⚠️ WhatsApp: انقطع الاتصال، إعادة المحاولة بعد 5 ثوانٍ:', _lastError);
          setTimeout(() => { connect().catch(() => {}); }, 5000);
        }
      }
    });

    _sock = sock;
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
    lastError: _lastError,
    defaultTarget: process.env.WHATSAPP_SELF_NUMBER || null,
  };
}

/** فصل الجلسة ومسح حالتها من قاعدة البيانات (يلزم بعدها إقران جديد). */
async function logout() {
  try { await _sock?.logout(); } catch { /* تجاهل */ }
  _sock = null; _connected = false; _qrDataUrl = null;
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
  if (!_connected) throw new Error('واتساب غير متصل — أكمل الإقران أولاً');
  const jid = toJid(to);

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

module.exports = { isEnabled, connect, status, logout, sendDocument, toJid };
