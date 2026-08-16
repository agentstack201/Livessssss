// ───────────────────────────────────────────────────────────────────────────
// سجلّ أنواع المستندات (القوالب) — المصدر الوحيد للحقيقة في الخادم.
//
// قبل هذا الملف كان نوع المستند يُفلتر في كل موضع بثلاثية ثنائية:
//   document_type === 'companion_visit' ? 'companion_visit' : 'sick_leave'
// أي أن إضافة قالب ثالث كانت تُسقط قيمته بصمت إلى 'sick_leave' في الحفظ
// والتحديث، ويُطبع القالب الخطأ. الحل الهندسي: قائمة بيضاء واحدة هنا، وكل
// موضع آخر يمرّ عبر normalizeDocumentType() ويأخذ اسم المولّد من السجلّ.
//
// إضافة قالب جديد مستقبلاً = سطر واحد هنا + ملف مولّد PDF + تصديره في
// config/middlewares.js. لا تعديل في المتحكّم (controller) إطلاقاً.
//
// ملاحظة مقصودة: هذا الملف بيانات صرفة بلا أي require، حتى لا تنشأ حلقة
// اعتماد دائرية مع config/middlewares.js الذي يحمّل المولّدات نفسها.
// ───────────────────────────────────────────────────────────────────────────

// النوع الافتراضي — كل سجل قديم بلا قيمة يبقى إجازة مرضية كما كان بالضبط.
const DEFAULT_DOCUMENT_TYPE = 'sick_leave';

const DOCUMENT_TYPES = {
  // تقرير الإجازة المرضية — السلوك الأصلي للنظام.
  sick_leave: {
    key: 'sick_leave',
    label_ar: 'إجازة مرضية',
    label_en: 'Sick Leave Report',
    // اسم الدالة المُصدَّرة من config/middlewares.js التي تولّد الـ PDF.
    renderer: 'createPDF',
  },
  // مشهد مراجعة لمرافق.
  companion_visit: {
    key: 'companion_visit',
    label_ar: 'مشهد مراجعة لمرافق',
    label_en: 'Companion Statement of Visit',
    renderer: 'createCompanionPDF',
  },
  // تقرير مرافقة مريض — إجازة مرضية لمرافق المريض (مدة إجازة + صلة قرابة).
  companion_sick_leave: {
    key: 'companion_sick_leave',
    label_ar: 'تقرير مرافقة مريض',
    label_en: 'Companion Sick Leave Report',
    renderer: 'createCompanionSickLeavePDF',
  },
  // مشهد مراجعة (للمريض نفسه) — القالب المضاف حديثاً.
  visit_statement: {
    key: 'visit_statement',
    label_ar: 'مشهد مراجعة',
    label_en: 'Statement of Visit',
    renderer: 'createVisitStatementPDF',
  },
};

/**
 * يحوّل أي قيمة واردة من العميل إلى نوع مستند مدعوم.
 * أي قيمة مجهولة أو فارغة → النوع الافتراضي (إجازة مرضية)، فلا يمكن لطلب
 * خارجي أن يحقن نوعاً غير معروف في قاعدة البيانات.
 */
function normalizeDocumentType(value) {
  const key = typeof value === 'string' ? value.trim() : '';
  return Object.prototype.hasOwnProperty.call(DOCUMENT_TYPES, key)
    ? key
    : DEFAULT_DOCUMENT_TYPE;
}

/** اسم دالة توليد الـ PDF المناسبة لهذا النوع. */
function rendererNameFor(value) {
  return DOCUMENT_TYPES[normalizeDocumentType(value)].renderer;
}

module.exports = {
  DOCUMENT_TYPES,
  DEFAULT_DOCUMENT_TYPE,
  normalizeDocumentType,
  rendererNameFor,
};
