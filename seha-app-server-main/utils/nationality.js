// ───────────────────────────────────────────────────────────────────────────
// توحيد قيمة الجنسية على مستوى البيانات.
//
// النظام كان يقبل «سعودي» و«السعودية» كقيمتين مختلفتين لنفس الجنسية — من
// الإدخال اليدوي، ومن قائمة الدول المزروعة، ومن استخراج الذكاء الاصطناعي.
// القيمة المعتمدة الآن هي «السعودية» وحدها.
//
// يُستدعى هذا التوحيد عند *الكتابة* (إنشاء/تعديل سجل، ونتيجة الاستخراج) وعند
// *القراءة للطباعة* — فأي مصدر للقيمة ينتهي إلى الصيغة المعتمدة، لا في العرض
// وحده بل في ما يُحفظ فعلاً.
// ───────────────────────────────────────────────────────────────────────────

// الصيغة المعتمدة.
const CANONICAL_AR = 'السعودية';
const CANONICAL_EN = 'Saudi Arabia';

// كل ما يعني «سعودي» بأي رسم أو لغة. تُوحَّد الهمزات والتاء المربوطة والألف
// المقصورة قبل المطابقة، فتُغطّى الصيغ غير المدرجة حرفياً.
const SAUDI_FORMS = new Set([
  'سعودي', 'سعوديه', 'سعودية', 'السعودي', 'السعوديه', 'السعودية',
  'المملكه العربيه السعوديه', 'المملكة العربية السعودية',
  'saudi', 'saudia', 'saudi arabia', 'saudian', 'ksa',
]);

const foldArabic = (value) => String(value == null ? '' : value)
  .trim()
  .toLowerCase()
  .replace(/[ً-ْٰ]/g, '')   // تشكيل
  .replace(/[أإآٱ]/g, 'ا')
  .replace(/ى/g, 'ي')
  .replace(/\s+/g, ' ');

/** هل هذه القيمة تعني «سعودي» بأي صيغة؟ */
function isSaudi(value) {
  const folded = foldArabic(value);
  if (!folded) return false;
  return SAUDI_FORMS.has(folded) || SAUDI_FORMS.has(folded.replace(/ه$/, 'ة'));
}

/**
 * أي قيمة جنسية → الصيغة المعتمدة.
 * القيمة الفارغة → «السعودية» (الافتراضي)، و«سعودي» بأي رسم → «السعودية»،
 * وأي جنسية أخرى تبقى كما أدخلها المستخدم بلا مساس.
 */
function normalizeNationality(value) {
  const text = String(value == null ? '' : value).trim();
  if (!text) return CANONICAL_AR;
  return isSaudi(text) ? CANONICAL_AR : text;
}

/** الاسم الإنجليزي المقابل، حين لا يوفّره سجل الدولة. */
function nationalityEnglish(arabicValue, fallback) {
  if (isSaudi(arabicValue)) return CANONICAL_EN;
  return fallback || arabicValue || '';
}

module.exports = {
  CANONICAL_AR,
  CANONICAL_EN,
  isSaudi,
  normalizeNationality,
  nationalityEnglish,
};
