// ───────────────────────────────────────────────────────────────────────────
// «التكريم الملكي» في صفحة الدخول — التحقق من الإعدادات وخدمة الوسائط.
//
// الإعداد يُحفظ في جدول Settings تحت المفتاح login_tribute كنص JSON. نحفظ ما
// أرسله المشرف فقط بعد التحقق؛ الواجهة (seha.sa-main/src/config/loginTribute.js)
// تكمل أي حقل ناقص من قيمها الافتراضية، فالحدود هنا يجب أن تطابق TRIBUTE_LIMITS
// هناك.
//
// sanitize له وضعان:
//   strict  — للحفظ (PUT): حقل معروف بنوع خاطئ يرمي TributeValidationError ⇒ 400.
//   lenient — للقراءة: الحقل التالف يُسقط بصمت، فإعداد قديم أو معطوب لا يُسقط
//             صفحة الدخول.
//
// الوسائط تُخدم من الإعداد المحفوظ فقط (لا من رقم يرسله الزائر)، فالمسار العام
// لا يكشف أي ملف آخر في مكتبة الوسائط.
// ───────────────────────────────────────────────────────────────────────────

const { fn, col } = require("sequelize");
const Setting = require("../models/settings.model");
const Media = require("../models/media.model");

const SETTING_KEY = "login_tribute";
const SETTING_DESCRIPTION = "إعدادات التكريم الملكي في صفحة الدخول";
const PUBLIC_PATH = "/settings/public/login-tribute";

const LIMITS = {
  text: 200,
  listItems: 12,
  poemLines: 4,
  position: { min: 0, max: 100 },
  size: { min: 5, max: 60 },
};

// أكبر قيمة لعمود INTEGER في PostgreSQL — رقم أكبر يُفشل الاستعلام نفسه.
const MAX_MEDIA_ID = 2147483647;

const PHOTO_MIMES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
const AUDIO_MIMES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
  "audio/ogg",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
];

const MEDIA_KINDS = {
  photo: {
    mimes: new Set(PHOTO_MIMES),
    label: "الصورة",
    allowedText: "صورة بصيغة JPG أو PNG أو WebP أو GIF",
  },
  audio: {
    mimes: new Set(AUDIO_MIMES),
    label: "الشيلة الصوتية",
    allowedText: "ملفاً صوتياً بصيغة MP3 أو M4A أو AAC أو OGG أو WAV أو WebM",
  },
};

// أسماء بديلة غير قياسية تُخدم باسمها المعتمد (Safari أدق من غيره في هذا).
const CANONICAL_MIME = {
  "image/jpg": "image/jpeg",
  "audio/mp3": "audio/mpeg",
};

const EFFECT_KEYS = ["stars", "confetti", "crown", "sunglasses", "fireworks", "hearts"];

// ── مخطط الحقول ────────────────────────────────────────────────────────────
// قيمة نصية = نوع الحقل، مصفوفة = قائمة نصوص بحدّها، كائن = حقول متداخلة.
const SPOT = { x: "position", y: "position", size: "size" };

const SCHEMA = {
  enabled: "bool",
  badge: { main: "text", sub: "text" },
  poem: ["list", LIMITS.poemLines],
  hint: "text",
  kashkha: "text",
  meter: { enabled: "bool", loading: "text", lines: ["list", LIMITS.listItems] },
  shela: { enabled: "bool", lyrics: ["list", LIMITS.listItems] },
  effects: Object.fromEntries(EFFECT_KEYS.map((k) => [k, "bool"])),
  photo: { mediaId: "mediaId", crown: SPOT, glasses: SPOT },
  audio: { mediaId: "mediaId" },
};

const FIELD_LABELS = {
  enabled: "إظهار التكريم",
  badge: "الشارة",
  "badge.main": "العنوان الرئيسي للشارة",
  "badge.sub": "العنوان الفرعي للشارة",
  poem: "أبيات الشعر",
  hint: "تلميح الصورة",
  kashkha: "عبارة الكشخة",
  meter: "مقياس الهيبة",
  "meter.enabled": "تفعيل مقياس الهيبة",
  "meter.loading": "نص تحميل المقياس",
  "meter.lines": "عبارات المقياس",
  shela: "الشيلة",
  "shela.enabled": "تفعيل الشيلة",
  "shela.lyrics": "كلمات الشيلة",
  effects: "المؤثرات",
  "effects.stars": "مؤثر النجوم",
  "effects.confetti": "مؤثر القصاصات الملوّنة",
  "effects.crown": "مؤثر التاج",
  "effects.sunglasses": "مؤثر النظارة",
  "effects.fireworks": "مؤثر الألعاب النارية",
  "effects.hearts": "مؤثر القلوب",
  photo: "الصورة",
  "photo.mediaId": "ملف الصورة",
  "photo.crown": "موضع التاج",
  "photo.crown.x": "الموضع الأفقي للتاج",
  "photo.crown.y": "الموضع العمودي للتاج",
  "photo.crown.size": "حجم التاج",
  "photo.glasses": "موضع النظارة",
  "photo.glasses.x": "الموضع الأفقي للنظارة",
  "photo.glasses.y": "الموضع العمودي للنظارة",
  "photo.glasses.size": "حجم النظارة",
  audio: "الصوت",
  "audio.mediaId": "ملف الشيلة الصوتي",
};

const EXPECTED = {
  object: "مجموعة حقول (كائن JSON)",
  bool: "true أو false",
  text: "نصاً",
  list: "قائمة نصوص",
  number: "رقماً",
  mediaId: "رقم ملف صحيحاً موجباً أو null",
};

class TributeValidationError extends Error {
  constructor(field, expected) {
    const label = FIELD_LABELS[field];
    super(
      field
        ? `قيمة غير صالحة في «${label || field}» (${field}): يجب أن تكون ${expected}.`
        : `بيانات التكريم يجب أن تكون ${expected}.`
    );
    this.name = "TributeValidationError";
    this.field = field || null;
    this.status = 400;
  }
}

const isPlainObject = (v) =>
  v !== null && typeof v === "object" && !Array.isArray(v) &&
  (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);

/** يقص النص بعد التشذيب دون أن يشطر رمزاً تعبيرياً (زوج UTF-16) من منتصفه. */
function cutText(value, max = LIMITS.text) {
  let text = value.trim();
  if (text.length > max) {
    text = text.slice(0, max);
    const last = text.charCodeAt(text.length - 1);
    if (last >= 0xd800 && last <= 0xdbff) text = text.slice(0, -1);
    text = text.trimEnd();
  }
  return text;
}

const clamp = (v, { min, max }) => Math.min(max, Math.max(min, v));

const isMediaId = (v) => Number.isInteger(v) && v > 0 && v <= MAX_MEDIA_ID;

const SKIP = Symbol("skip");

function readField(rule, value, path, bad) {
  if (Array.isArray(rule)) {
    // القائمة: النصوص فقط، مشذّبة ومقصوصة، بلا أسطر فارغة، وبحدّ أقصى للعدد.
    if (!Array.isArray(value)) return bad(path, EXPECTED.list);
    return value
      .filter((item) => typeof item === "string")
      .map((item) => cutText(item))
      .filter(Boolean)
      .slice(0, rule[1]);
  }
  switch (rule) {
    case "bool":
      return typeof value === "boolean" ? value : bad(path, EXPECTED.bool);
    case "text":
      return typeof value === "string" ? cutText(value) : bad(path, EXPECTED.text);
    case "position":
    case "size":
      return typeof value === "number" && Number.isFinite(value)
        ? clamp(value, LIMITS[rule])
        : bad(path, EXPECTED.number);
    case "mediaId":
      if (value === null) return null;
      return isMediaId(value) ? value : bad(path, EXPECTED.mediaId);
    default:
      return SKIP;
  }
}

function walk(schema, input, path, bad) {
  const out = {};
  for (const [key, rule] of Object.entries(schema)) {
    if (!Object.prototype.hasOwnProperty.call(input, key) || input[key] === undefined) continue;
    const fieldPath = path ? `${path}.${key}` : key;
    const value = input[key];
    let result;
    if (isPlainObject(rule)) {
      if (!isPlainObject(value)) {
        bad(fieldPath, EXPECTED.object);
        continue;
      }
      result = walk(rule, value, fieldPath, bad);
      // كائن بلا أي حقل صالح لا يُحفظ — الواجهة تكمله من الافتراضي.
      if (!Object.keys(result).length) continue;
    } else {
      result = readField(rule, value, fieldPath, bad);
    }
    if (result !== SKIP) out[key] = result;
  }
  return out;
}

/**
 * ينظّف إعداد التكريم وفق المخطط. المفاتيح غير المعروفة تُسقط دائماً، والحقول
 * الغائبة تبقى غائبة (الحفظ الجزئي يحفظ ما أُرسل فقط).
 * @param {unknown} input
 * @param {{ strict?: boolean }} [options]
 * @returns {object}
 * @throws {TributeValidationError} في الوضع الصارم فقط
 */
function sanitize(input, { strict = false } = {}) {
  const bad = (field, expected) => {
    if (strict) throw new TributeValidationError(field, expected);
    return SKIP;
  };
  if (!isPlainObject(input)) {
    bad(null, EXPECTED.object);
    return {};
  }
  return walk(SCHEMA, input, "", bad);
}

/**
 * يحوّل القيمة الخام المخزّنة إلى إعداد نظيف. أي تلف (لا قيمة، JSON معطوب،
 * ليس كائناً) يعني «التكريم مخفي» بدل خطأ 500 في صفحة الدخول.
 */
function parseStored(raw) {
  if (typeof raw !== "string" || !raw.trim()) return { enabled: false };
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { enabled: false };
  }
  if (!isPlainObject(parsed)) return { enabled: false };
  const config = sanitize(parsed, { strict: false });
  if (typeof parsed.updatedAt === "string" && Number.isFinite(Date.parse(parsed.updatedAt))) {
    config.updatedAt = parsed.updatedAt;
  }
  return config;
}

async function readConfig() {
  const row = await Setting.findOne({ where: { key: SETTING_KEY }, attributes: ["value"] });
  return parseStored(row ? row.value : null);
}

async function saveConfig(config) {
  const updatedAt = new Date().toISOString();
  const stored = { ...config, updatedAt };
  const value = JSON.stringify(stored);
  const row = await Setting.findOne({ where: { key: SETTING_KEY } });
  if (row) {
    row.value = value;
    row.description = SETTING_DESCRIPTION;
    await row.save();
  } else {
    await Setting.create({ key: SETTING_KEY, value, description: SETTING_DESCRIPTION });
  }
  return stored;
}

// ── الوسائط ────────────────────────────────────────────────────────────────

const normalizeMime = (mime) =>
  typeof mime === "string" ? mime.split(";")[0].trim().toLowerCase() : "";

const isAllowedMime = (kind, mime) =>
  Boolean(MEDIA_KINDS[kind]) && MEDIA_KINDS[kind].mimes.has(normalizeMime(mime));

/** 'remote' لرابط http(s)، و'data' لـ data URI، وnull لأي شيء لا نستطيع خدمته. */
function urlKind(url) {
  if (typeof url !== "string") return null;
  if (/^https?:\/\//i.test(url)) return "remote";
  if (/^data:/i.test(url)) return "data";
  return null;
}

/**
 * يفحص ملفاً من مكتبة الوسائط لاستخدامه كصورة/صوت التكريم دون جلب عمود url
 * كاملاً (قد يكون data URI بحجم عدة ميغابايت) — أول حروفه تكفي لمعرفة نوعه.
 * @returns {Promise<{ ok: true, meta: { id, mime, updatedAt } } | { ok: false, reason, message }>}
 */
async function inspectMedia(kind, id) {
  const spec = MEDIA_KINDS[kind];
  if (!spec || !isMediaId(id)) {
    return { ok: false, reason: "missing", message: `ملف ${spec ? spec.label : ""} غير محدد` };
  }
  const row = await Media.findByPk(id, {
    attributes: ["id", "mime_type", "updatedAt", [fn("substr", col("url"), 1, 16), "url_head"]],
    raw: true,
  });
  if (!row) {
    return { ok: false, reason: "missing", message: `ملف ${spec.label} رقم ${id} غير موجود في مكتبة الوسائط` };
  }
  if (!isAllowedMime(kind, row.mime_type)) {
    return { ok: false, reason: "mime", message: `الملف رقم ${id} لا يصلح لـ${spec.label}: يجب أن يكون ${spec.allowedText}` };
  }
  if (!urlKind(row.url_head)) {
    return { ok: false, reason: "url", message: `الملف رقم ${id} لا يمكن عرضه (رابطه غير مدعوم)، أعد رفعه من مكتبة الوسائط` };
  }
  const mime = normalizeMime(row.mime_type);
  return { ok: true, meta: { id: row.id, mime: CANONICAL_MIME[mime] || mime, updatedAt: row.updatedAt } };
}

/** رقم الإصدار في رابط الوسائط: يتغير مع كل حفظ فيكسر ذاكرة المتصفح. */
function mediaVersion(config, id) {
  const t = Date.parse(config.updatedAt);
  return Number.isFinite(t) ? t : id;
}

/** شكل الرد العام: الإعداد المحفوظ + رابطا الصورة والصوت إن كانا صالحين. */
async function publicView(config) {
  const urlFor = async (kind) => {
    const id = config[kind] && config[kind].mediaId;
    if (!id) return null;
    const check = await inspectMedia(kind, id);
    return check.ok ? `${PUBLIC_PATH}/${kind}?v=${mediaVersion(config, id)}` : null;
  };
  const [photoUrl, audioUrl] = await Promise.all([urlFor("photo"), urlFor("audio")]);
  return { enabled: false, ...config, photoUrl, audioUrl };
}

/**
 * يفك data URI بترميز base64 إلى بايتات. غير ذلك ⇒ null.
 * @returns {{ mime: string, buffer: Buffer } | null}
 */
function decodeDataUri(uri) {
  if (typeof uri !== "string" || !/^data:/i.test(uri)) return null;
  const comma = uri.indexOf(",");
  if (comma < 0) return null;
  const params = uri.slice(5, comma).split(";").map((p) => p.trim().toLowerCase());
  if (!params.includes("base64")) return null;
  return { mime: params[0] || "", buffer: Buffer.from(uri.slice(comma + 1), "base64") };
}

const UNSATISFIABLE = "unsatisfiable";

/**
 * يحلّل ترويسة Range لنطاق واحد (bytes=a-b أو bytes=a- أو bytes=-n).
 * @returns {null | { start: number, end: number } | 'unsatisfiable'}
 *   null ⇐ لا ترويسة أو صيغة لا ندعمها (نطاقات متعددة مثلاً) فيُرد الملف كاملاً
 *   كما يسمح المعيار؛ 'unsatisfiable' ⇐ 416.
 */
function parseRange(header, size) {
  if (typeof header !== "string") return null;
  const m = /^\s*bytes\s*=\s*(\d*)\s*-\s*(\d*)\s*$/i.exec(header);
  if (!m || (m[1] === "" && m[2] === "")) return null;
  if (m[1] === "") {
    const suffix = Number(m[2]);
    if (!(suffix > 0) || size <= 0) return UNSATISFIABLE;
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }
  const start = Number(m[1]);
  const end = m[2] === "" ? size - 1 : Number(m[2]);
  if (start >= size || start > end) return UNSATISFIABLE;
  return { start, end: Math.min(end, size - 1) };
}

// Safari يطلب الصوت على دفعات Range متتالية؛ نحتفظ بآخر ملف مفكوك لكل نوع حتى
// لا نجلب ونفك عدة ميغابايت من base64 مع كل دفعة. المفتاح يتغير مع الملف.
const bodyCache = new Map();

/**
 * يجهّز الملف المرتبط بالإعداد المحفوظ للنوع المطلوب.
 * @returns {Promise<null | { redirect: string } | { buffer: Buffer, mime: string }>}
 */
async function loadMediaBody(kind) {
  if (!MEDIA_KINDS[kind]) return null;
  const config = await readConfig();
  const id = config[kind] && config[kind].mediaId;
  if (!id) return null;
  const check = await inspectMedia(kind, id);
  if (!check.ok) return null;
  const { meta } = check;

  const cacheKey = `${meta.id}:${new Date(meta.updatedAt).getTime()}:${meta.mime}`;
  const cached = bodyCache.get(kind);
  if (cached && cached.key === cacheKey) return cached.body;

  const media = await Media.findByPk(meta.id, { attributes: ["url"], raw: true });
  if (!media) return null;

  let body = null;
  const type = urlKind(media.url);
  if (type === "remote") {
    body = { redirect: media.url };
  } else if (type === "data") {
    const decoded = decodeDataUri(media.url);
    if (decoded && decoded.buffer.length) body = { buffer: decoded.buffer, mime: meta.mime };
  }
  if (body) bodyCache.set(kind, { key: cacheKey, body });
  return body;
}

/** يرسل البايتات مع دعم Range (iOS لا يشغّل <audio> بدونه). */
function sendMediaBytes(req, res, buffer, mime) {
  const size = buffer.length;
  res.set({
    "Content-Type": mime,
    "Cache-Control": "public, max-age=300",
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
  });

  const range = parseRange(req.get("Range"), size);
  if (range === UNSATISFIABLE) {
    res.set("Content-Range", `bytes */${size}`);
    return res.status(416).end();
  }
  if (range) {
    res.status(206).set({
      "Content-Range": `bytes ${range.start}-${range.end}/${size}`,
      "Content-Length": String(range.end - range.start + 1),
    });
    return res.end(buffer.subarray(range.start, range.end + 1));
  }
  res.status(200).set("Content-Length", String(size));
  return res.end(buffer);
}

module.exports = {
  SETTING_KEY,
  SETTING_DESCRIPTION,
  PUBLIC_PATH,
  LIMITS,
  PHOTO_MIMES,
  AUDIO_MIMES,
  MEDIA_KINDS,
  EFFECT_KEYS,
  TributeValidationError,
  sanitize,
  parseStored,
  readConfig,
  saveConfig,
  normalizeMime,
  isAllowedMime,
  inspectMedia,
  publicView,
  decodeDataUri,
  parseRange,
  UNSATISFIABLE,
  loadMediaBody,
  sendMediaBytes,
};
