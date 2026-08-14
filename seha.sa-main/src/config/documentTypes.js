// ───────────────────────────────────────────────────────────────────────────
// سجلّ القوالب (أنواع المستندات) — المصدر الوحيد للحقيقة في الواجهة.
//
// كانت الواجهة تتعامل مع نوع المستند عبر راية ثنائية واحدة (isCompanion)
// منتشرة في ثلاثين موضعاً داخل SickLeaveForm.jsx، ومقارنات نصية مباشرة
// (=== 'companion_visit') في لوحة التحكم وصفحة التوليد وصفحة الاستعلام.
// مع قالب ثالث كان أي موضع يُنسى يعرض القالب الخطأ بصمت.
//
// الحل: يصف كل قالب نفسه هنا — عنوانه، مسمّياته، الحقول التي يحتاجها،
// ومكوّن المعاينة الخاص به — وتقرأ بقية الصفحات من هذا السجلّ فقط.
// إضافة قالب جديد = كائن واحد هنا + مكوّن معاينة + مولّد PDF في الخادم.
//
// المفاتيح هنا مطابقة تماماً لـ seha-app-server-main/config/documentTypes.js.
// ───────────────────────────────────────────────────────────────────────────
import SickLeavePDFOriginal from '../components/SickLeavePDFOriginal'
import CompanionVisitPDFOriginal from '../components/CompanionVisitPDFOriginal'
import VisitStatementPDFOriginal from '../components/VisitStatementPDFOriginal'

export const DOC_SICK_LEAVE = 'sick_leave'
export const DOC_COMPANION = 'companion_visit'
export const DOC_VISIT_STATEMENT = 'visit_statement'

export const DEFAULT_DOCUMENT_TYPE = DOC_SICK_LEAVE

// الحقول المشتركة المطلوبة في كل القوالب (تُدمج مع الخاصة بكل قالب).
const SHARED_REQUIRED = {
  serviceNum: 'رقم الخدمة مطلوب',
  nationalID: 'رقم الهوية مطلوب',
  leaveId: 'رقم الإجازة مطلوب',
  nationality: 'الجنسية مطلوبة',
  issueDate: 'تاريخ إصدار التقرير مطلوب',
  admissionDate: 'تاريخ الدخول مطلوب',
  dischargeDate: 'تاريخ الخروج مطلوب',
}

// الحقول المشتركة بين قالبَي «مشهد المراجعة» (بوقت دخول/خروج ونوع زيارة).
const VISIT_SHARED_REQUIRED = {
  ...SHARED_REQUIRED,
  admissionTime: 'وقت الدخول مطلوب',
  dischargeTime: 'وقت الخروج مطلوب',
  visitTypeArabic: 'نوع الزيارة بالعربية مطلوب',
  visitTypeEnglish: 'نوع الزيارة بالإنجليزية مطلوب',
  hospitalNameArabic: 'اسم المنشأة الصحية بالعربية مطلوب',
  hospitalNameEnglish: 'اسم المنشأة الصحية بالإنجليزية مطلوب',
}

export const DOCUMENT_TYPES = {
  // ── تقرير الإجازة المرضية — السلوك الأصلي للنظام بحذافيره ─────────────────
  [DOC_SICK_LEAVE]: {
    key: DOC_SICK_LEAVE,
    optionLabel: 'إجازة مرضية',
    titleAr: 'تقرير إجازة مرضية',
    titleEn: 'Sick Leave Report',
    icon: '🏥',
    description: 'تقرير الإجازة المرضية المعتمد، بمدة الإجازة وتاريخي بدايتها ونهايتها.',
    accent: '#2f6db4',
    previewComponent: SickLeavePDFOriginal,
    previewTitle: 'معاينة تقرير الإجازة المرضية',
    // القدرات: أي حقول يعرضها النموذج ويرسلها للخادم.
    features: {
      times: false,        // وقت الدخول/الخروج
      relation: false,     // صلة القرابة
      visitType: false,    // نوع الزيارة
      leaveDuration: true, // مدة الإجازة + تاريخا البداية والنهاية
    },
    // مسمّيات الحقول التي تختلف بين القوالب.
    labels: {
      pageTitle: 'الإجازات المرضية',
      docLabel: 'الإجازة المرضية',
      deleteLabel: 'حذف الإجازة المرضية',
      nameEn: 'الاسم (بالإنجليزية) *',
      nameAr: 'الاسم (بالعربية) *',
      admissionDate: 'تاريخ الدخول للمستشفى *',
      dischargeDate: 'تاريخ الخروج من المستشفى *',
      practitionerEn: 'اسم الطبيب (بالإنجليزية) *',
      practitionerAr: 'اسم الطبيب (بالعربية) *',
      facilityAr: 'اسم المستشفى (بالعربية) *',
      facilityEn: 'اسم المستشفى (بالإنجليزية) *',
      positionEn: 'منصب/تخصص الطبيب (بالإنجليزية) *',
      positionAr: 'منصب/تخصص الطبيب (بالعربية) *',
    },
    requiredFields: {
      ...SHARED_REQUIRED,
      name: 'الاسم بالإنجليزية مطلوب',
      nameArabic: 'الاسم بالعربية مطلوب',
      physicianPosition: 'منصب الطبيب بالإنجليزية مطلوب',
      physicianPositionArabic: 'منصب الطبيب بالعربية مطلوب',
      startDate: 'تاريخ بداية الإجازة مطلوب',
      endDate: 'تاريخ نهاية الإجازة مطلوب',
      doctorName: 'اسم الطبيب بالإنجليزية مطلوب',
      doctorNameArabic: 'اسم الطبيب بالعربية مطلوب',
      hospitalNameArabic: 'اسم المستشفى بالعربية مطلوب',
      hospitalNameEnglish: 'اسم المستشفى بالإنجليزية مطلوب',
    },
  },

  // ── مشهد مراجعة لمرافق ────────────────────────────────────────────────────
  [DOC_COMPANION]: {
    key: DOC_COMPANION,
    optionLabel: 'مشهد مراجعة لمرافق',
    titleAr: 'مشهد مراجعة لمرافق',
    titleEn: 'Companion Statement of Visit',
    icon: '👥',
    description: 'مشهد مراجعة لمرافق المريض، بوقت الدخول والخروج وفترة الانتظار وصلة القرابة.',
    accent: '#6d28d9',
    previewComponent: CompanionVisitPDFOriginal,
    previewTitle: 'معاينة مشهد مراجعة لمرافق',
    features: {
      times: true,
      relation: true,
      visitType: true,
      leaveDuration: false,
    },
    labels: {
      pageTitle: 'مشهد مراجعة لمرافق',
      docLabel: 'مشهد المراجعة للمرافق',
      deleteLabel: 'حذف مشهد المراجعة',
      nameEn: 'اسم المرافق (بالإنجليزية) *',
      nameAr: 'اسم المرافق (بالعربية) *',
      admissionDate: 'تاريخ الدخول *',
      dischargeDate: 'تاريخ الخروج *',
      practitionerEn: 'اسم الممارس الصحي (بالإنجليزية) *',
      practitionerAr: 'اسم الممارس الصحي (بالعربية) *',
      facilityAr: 'اسم المنشأة الصحية (بالعربية) *',
      facilityEn: 'اسم المنشأة الصحية (بالإنجليزية) *',
      positionEn: 'المسمى الوظيفي (بالإنجليزية) *',
      positionAr: 'المسمى الوظيفي (بالعربية) *',
    },
    requiredFields: {
      ...VISIT_SHARED_REQUIRED,
      name: 'اسم المرافق بالإنجليزية مطلوب',
      nameArabic: 'اسم المرافق بالعربية مطلوب',
      physicianPosition: 'المسمى الوظيفي بالإنجليزية مطلوب',
      physicianPositionArabic: 'المسمى الوظيفي بالعربية مطلوب',
      doctorName: 'اسم الممارس الصحي بالإنجليزية مطلوب',
      doctorNameArabic: 'اسم الممارس الصحي بالعربية مطلوب',
      relationArabic: 'صلة القرابة بالعربية مطلوبة',
      relationEnglish: 'صلة القرابة بالإنجليزية مطلوبة',
    },
  },

  // ── مشهد مراجعة (للمريض نفسه) — القالب المضاف حديثاً ──────────────────────
  [DOC_VISIT_STATEMENT]: {
    key: DOC_VISIT_STATEMENT,
    optionLabel: 'مشهد مراجعة',
    titleAr: 'مشهد مراجعة',
    titleEn: 'Statement of Visit',
    icon: '📋',
    description: 'مشهد مراجعة للمريض، بوقت الدخول والخروج وفترة الانتظار ونوع الزيارة.',
    accent: '#0f766e',
    previewComponent: VisitStatementPDFOriginal,
    previewTitle: 'معاينة مشهد مراجعة',
    features: {
      times: true,
      relation: false, // الفرق الوحيد عن قالب المرافق
      visitType: true,
      leaveDuration: false,
    },
    labels: {
      pageTitle: 'مشهد مراجعة',
      docLabel: 'مشهد المراجعة',
      deleteLabel: 'حذف مشهد المراجعة',
      nameEn: 'الاسم (بالإنجليزية) *',
      nameAr: 'الاسم (بالعربية) *',
      admissionDate: 'تاريخ الدخول *',
      dischargeDate: 'تاريخ الخروج *',
      practitionerEn: 'اسم الممارس (بالإنجليزية) *',
      practitionerAr: 'اسم الممارس (بالعربية) *',
      facilityAr: 'اسم المنشأة الصحية (بالعربية) *',
      facilityEn: 'اسم المنشأة الصحية (بالإنجليزية) *',
      positionEn: 'المسمى الوظيفي (بالإنجليزية) *',
      positionAr: 'المسمى الوظيفي (بالعربية) *',
    },
    requiredFields: {
      ...VISIT_SHARED_REQUIRED,
      name: 'الاسم بالإنجليزية مطلوب',
      nameArabic: 'الاسم بالعربية مطلوب',
      physicianPosition: 'المسمى الوظيفي بالإنجليزية مطلوب',
      physicianPositionArabic: 'المسمى الوظيفي بالعربية مطلوب',
      doctorName: 'اسم الممارس بالإنجليزية مطلوب',
      doctorNameArabic: 'اسم الممارس بالعربية مطلوب',
    },
  },
}

// ترتيب عرض القوالب في القوائم وصفحة القوالب.
export const DOCUMENT_TYPE_LIST = [
  DOCUMENT_TYPES[DOC_SICK_LEAVE],
  DOCUMENT_TYPES[DOC_COMPANION],
  DOCUMENT_TYPES[DOC_VISIT_STATEMENT],
]

/** أي قيمة (من الخادم أو من الرابط) → مفتاح قالب مدعوم. */
export function normalizeDocumentType(value) {
  const key = typeof value === 'string' ? value.trim() : ''
  return Object.prototype.hasOwnProperty.call(DOCUMENT_TYPES, key) ? key : DEFAULT_DOCUMENT_TYPE
}

/** أي قيمة → كائن وصف القالب كاملاً (لا يعيد undefined أبداً). */
export function getDocumentType(value) {
  return DOCUMENT_TYPES[normalizeDocumentType(value)]
}

/** مكوّن المعاينة المناسب لسجلٍ محفوظ. */
export function getPreviewComponent(value) {
  return getDocumentType(value).previewComponent
}
