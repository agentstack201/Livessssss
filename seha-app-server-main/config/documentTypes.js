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
  // مشهد مراجعة (للمريض نفسه).
  visit_statement: {
    key: 'visit_statement',
    label_ar: 'مشهد مراجعة',
    label_en: 'Statement of Visit',
    renderer: 'createVisitStatementPDF',
  },
  // القالب الخامس — «تقرير إجازة مرضية - محسن»: نموذج تصميم قابل للتحرير
  // (mockup) بمولّده الخاص ووحدة تخطيطه الخاصة (templates/template5)، مستقلٌّ
  // تماماً عن sick_leave أعلاه ولا يشترك معه في أي ملف.
  sick_leave_enhanced: {
    key: 'sick_leave_enhanced',
    label_ar: 'تقرير إجازة مرضية - محسن',
    label_en: 'Sick Leave Report — Enhanced Template',
    renderer: 'createSickLeaveEnhancedPDF',
  },
  // ── القوالب الورقية (تقارير المستشفيات) ──────────────────────────────────
  // كلها تمرّ على نفس المولّد العام، ويحدّد paperTemplate أي تصميم يُستخدم.
  khalid_sick_leave: {
    key: 'khalid_sick_leave',
    label_ar: 'تقرير بأجازة مرضية (ج) — خالد المتميز',
    label_en: 'Sick Leave Report (C) — Khalid Distinct',
    renderer: 'createPaperPDF',
    paperTemplate: 'khalid_sick_leave',
  },
  madina_sick_leave: {
    key: 'madina_sick_leave',
    label_ar: 'تقرير إجازة مرضية — المدينة الوطني',
    label_en: 'Sick Leave Report — Madina National',
    renderer: 'createPaperPDF',
    paperTemplate: 'madina_sick_leave',
  },
  kfmc_appointment: {
    key: 'kfmc_appointment',
    label_ar: 'إشعار موعد — مدينة الملك فهد الطبية',
    label_en: 'Appointment Notice — KFMC',
    renderer: 'createPaperPDF',
    paperTemplate: 'kfmc_appointment',
  },
  kfgh_medical_report: {
    key: 'kfgh_medical_report',
    label_ar: 'تقرير طبي — الملك فهد العام',
    label_en: 'Medical Report — King Fahad General',
    renderer: 'createPaperPDF',
    paperTemplate: 'kfgh_medical_report',
  },
  haql_sick_leave: {
    key: 'haql_sick_leave',
    label_ar: 'تقرير إجازة مرضية — حقل العام',
    label_en: 'Sick Leave Report — Haql General',
    renderer: 'createPaperPDF',
    paperTemplate: 'haql_sick_leave',
  },
  kfgh_sick_leave_form: {
    key: 'kfgh_sick_leave_form',
    label_ar: 'تقرير إجازة مرضية (نموذج) — الملك فهد العام',
    label_en: 'Sick Leave Form — King Fahad General',
    renderer: 'createPaperPDF',
    paperTemplate: 'kfgh_sick_leave_form',
  },
  ksmc_sick_leave: {
    key: 'ksmc_sick_leave',
    label_ar: 'تقرير إجازة مرضية — الملك سعود الطبية',
    label_en: 'Sick Leave Report — King Saud Medical City',
    renderer: 'createPaperPDF',
    paperTemplate: 'ksmc_sick_leave',
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

/** معرّف التصميم الورقي لهذا النوع (أو null إن لم يكن قالباً ورقياً). */
function paperTemplateFor(value) {
  return DOCUMENT_TYPES[normalizeDocumentType(value)].paperTemplate || null;
}

module.exports = {
  DOCUMENT_TYPES,
  DEFAULT_DOCUMENT_TYPE,
  normalizeDocumentType,
  rendererNameFor,
  paperTemplateFor,
};
