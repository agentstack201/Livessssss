// ───────────────────────────────────────────────────────────────────────────
// نظام الخطوط المركزي للمستندات الورقية.
//
// لماذا هذه الخطوط بالذات؟ فُحصت المستندات الأصلية أولاً (لا اختيار حسب
// الشهرة): ملفّا Word المرفقان يستخدمان «Times New Roman» في كل الأحرف
// (‎208 و‎9 مرجعاً على التوالي، بمقاسات 12pt و14pt)، وويندوز يستبدل الأحرف
// العربية فيها بخط «Traditional Arabic» الناسخي. وصور التقارير الورقية تتوزّع
// بين وجهين: ناسخي (خالد المتميز، الملك فهد العام، حقل) وسانس حديث (المدينة
// الوطني، مدينة الملك فهد الطبية).
//
// فاختيرت أقرب خمسة بدائل حرة بصرياً لهذين الوجهين:
//   • Noto Naskh Arabic  → أقرب بديل حرّ لـ Traditional Arabic (نفس بنية
//     الناسخ: نفس ميل الحروف، سماكة رفيعة، عيون صغيرة).
//   • Tinos              → متوافق مترياً مع Times New Roman حرفاً بحرف،
//     فالأسطر اللاتينية تأخذ نفس العرض تماماً كما في الأصل.
//   • Amiri / Noto Sans Arabic → الخطّان المستخدمان فعلاً في قوالب صحة
//     الحالية، ويبقيان كما هما حتى لا يتغيّر أي قالب معتمد.
//   • IBM Plex Sans Arabic / Cairo → للوجه السانس الحديث في صور المستشفيات.
//
// ── الفكرة المعمارية المهمة ─────────────────────────────────────────────────
// كل خيار خطّ يُسنَد إلى نفس اسمَي العائلة في الـ CSS: DocArabic و DocLatin.
// فالقالب يكتب دائماً font-family: DocArabic / DocLatin، وتغيير الخط يبدّل
// الملفات خلف الاسمين فقط. لا قاعدة تخطيط واحدة تتغيّر، فلا تنهار المسافات
// ولا الجداول ولا الهوامش ولا المحاذاة مهما اختير الخط.
// ───────────────────────────────────────────────────────────────────────────
const fs = require('fs');
const path = require('path');

const FONTS_DIR = path.join(__dirname, '..', 'public', 'fonts');

// اسما العائلتين الثابتان اللذان تستخدمهما كل القوالب.
const AR_FAMILY = 'DocArabic';
const LATIN_FAMILY = 'DocLatin';

const FONT_OPTIONS = {
  // الأقرب للمستندات الأصلية (Times New Roman + Traditional Arabic) — الافتراضي
  // للقوالب الورقية الجديدة.
  naskh_times: {
    id: 'naskh_times',
    label_ar: 'ناسخ رسمي (الأقرب للأصل)',
    label_en: 'Naskh + Times metric',
    arabic: { 400: 'NotoNaskhArabic-Regular.woff2', 700: 'NotoNaskhArabic-Bold.woff2' },
    latin: { 400: 'Tinos-Regular.woff2', 700: 'Tinos-Bold.woff2' },
  },
  // الاقتران المستخدم فعلاً في قوالب صحة الحالية — الافتراضي لها حتى لا
  // يتغيّر شكلها إطلاقاً.
  seha_official: {
    id: 'seha_official',
    label_ar: 'صحة الرسمي (الحالي)',
    label_en: 'Seha official (current)',
    arabic: { 400: 'NotoSansArabic-Regular.ttf', 700: 'NotoSansArabic-Bold.ttf' },
    latin: { 400: 'Amiri-Regular.ttf', 700: 'Amiri-Bold.ttf' },
  },
  amiri_naskh: {
    id: 'amiri_naskh',
    label_ar: 'أميري ناسخي',
    label_en: 'Amiri Naskh',
    arabic: { 400: 'Amiri-Regular.ttf', 700: 'Amiri-Bold.ttf' },
    latin: { 400: 'Amiri-Regular.ttf', 700: 'Amiri-Bold.ttf' },
  },
  plex_official: {
    id: 'plex_official',
    label_ar: 'IBM Plex عربي',
    label_en: 'IBM Plex Sans Arabic',
    arabic: { 400: 'IBMPlexSansArabic-Regular.woff2', 700: 'IBMPlexSansArabic-Bold.woff2' },
    latin: { 400: 'Tinos-Regular.woff2', 700: 'Tinos-Bold.woff2' },
  },
  cairo_modern: {
    id: 'cairo_modern',
    label_ar: 'القاهرة الحديث',
    label_en: 'Cairo',
    arabic: { 400: 'Cairo-Regular.woff2', 700: 'Cairo-Bold.woff2' },
    latin: { 400: 'Tinos-Regular.woff2', 700: 'Tinos-Bold.woff2' },
  },
};

// الافتراضي للقوالب الورقية الجديدة: الأقرب بصرياً للمستندات الأصلية.
const DEFAULT_FONT = 'naskh_times';
// الافتراضي لقوالب صحة القائمة: اقترانها الحالي بحذافيره.
const SEHA_FONT = 'seha_official';

function normalizeFont(value) {
  const key = typeof value === 'string' ? value.trim() : '';
  return Object.prototype.hasOwnProperty.call(FONT_OPTIONS, key) ? key : DEFAULT_FONT;
}

// قراءة ملف خطّ وتحويله إلى data URI مضمّن — مرة واحدة لكل ملف طوال عمر
// العملية. التضمين شرط: صفحة الطباعة يجب ألا تُصدر أي طلب شبكة.
const _cache = new Map();
const MIME = { '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf' };
const FORMAT = { '.woff2': 'woff2', '.woff': 'woff', '.ttf': 'truetype' };

function fontDataUri(file) {
  if (_cache.has(file)) return _cache.get(file);
  let uri = '';
  try {
    const ext = path.extname(file).toLowerCase();
    const buf = fs.readFileSync(path.join(FONTS_DIR, file));
    uri = `data:${MIME[ext] || 'font/ttf'};base64,${buf.toString('base64')}`;
  } catch (e) {
    console.warn('⚠️ Could not inline font:', file, e.message);
  }
  _cache.set(file, uri);
  return uri;
}

/**
 * قواعد @font-face للخيار المطلوب، مُسنَدة إلى DocArabic و DocLatin.
 * تُبنى مرة واحدة لكل خيار وتُخزَّن.
 */
const _cssCache = new Map();
function fontFaceCssFor(fontId) {
  const id = normalizeFont(fontId);
  if (_cssCache.has(id)) return _cssCache.get(id);

  const opt = FONT_OPTIONS[id];
  const face = (family, file, weight) => {
    const uri = fontDataUri(file);
    if (!uri) return '';
    const fmt = FORMAT[path.extname(file).toLowerCase()] || 'truetype';
    return `@font-face{font-family:'${family}';src:url('${uri}') format('${fmt}');font-weight:${weight};font-style:normal;font-display:block;}`;
  };

  const css = [
    face(AR_FAMILY, opt.arabic[400], 400),
    face(AR_FAMILY, opt.arabic[700], 700),
    face(LATIN_FAMILY, opt.latin[400], 400),
    face(LATIN_FAMILY, opt.latin[700], 700),
  ].filter(Boolean).join('\n');

  _cssCache.set(id, css);
  return css;
}

module.exports = {
  FONT_OPTIONS,
  DEFAULT_FONT,
  SEHA_FONT,
  AR_FAMILY,
  LATIN_FAMILY,
  normalizeFont,
  fontFaceCssFor,
};
