// ───────────────────────────────────────────────────────────────────────────
// توحيد قيمة الجنسية في الواجهة — نسخة مطابقة لما في الخادم
// (seha-app-server-main/utils/nationality.js). القيمة المعتمدة «السعودية»،
// و«سعودي» بأي رسم (أو أي مرادف إنجليزي) تُحوَّل إليها تلقائياً.
//
// تُطبَّق على القيمة قبل حفظها وقبل عرضها، فلا يظهر «سعودي» في أي مسار:
// إدخال يدوي، اختيار من قائمة الدول، أو استخراج بالذكاء الاصطناعي.
// ───────────────────────────────────────────────────────────────────────────

export const NATIONALITY_AR = 'السعودية'
export const NATIONALITY_EN = 'Saudi Arabia'

const SAUDI_FORMS = new Set([
  'سعودي', 'سعوديه', 'سعودية', 'السعودي', 'السعوديه', 'السعودية',
  'المملكه العربيه السعوديه', 'المملكة العربية السعودية',
  'saudi', 'saudia', 'saudi arabia', 'saudian', 'ksa',
])

const foldArabic = (value) => String(value == null ? '' : value)
  .trim()
  .toLowerCase()
  .replace(/[ً-ْٰ]/g, '')
  .replace(/[أإآٱ]/g, 'ا')
  .replace(/ى/g, 'ي')
  .replace(/\s+/g, ' ')

/** هل هذه القيمة تعني «سعودي» بأي صيغة؟ */
export const isSaudiNationality = (value) => {
  const folded = foldArabic(value)
  if (!folded) return false
  return SAUDI_FORMS.has(folded) || SAUDI_FORMS.has(folded.replace(/ه$/, 'ة'))
}

/**
 * أي قيمة جنسية → الصيغة المعتمدة.
 * الفراغ → «السعودية»، و«سعودي» بأي رسم → «السعودية»، وأي جنسية أخرى تبقى
 * كما أدخلها المستخدم بلا مساس.
 */
export const normalizeNationality = (value) => {
  const text = String(value == null ? '' : value).trim()
  if (!text) return NATIONALITY_AR
  return isSaudiNationality(text) ? NATIONALITY_AR : text
}
