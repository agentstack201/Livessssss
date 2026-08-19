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
import CompanionSickLeavePDFOriginal from '../components/CompanionSickLeavePDFOriginal'
import SickLeaveEnhancedPDFTemplate5 from '../components/SickLeaveEnhancedPDFTemplate5'
import { calcWaitingPeriod } from '../utils/documentFormat'
import {
  TEMPLATE5_ID,
  TEMPLATE5_NAME_AR,
  TEMPLATE5_NAME_EN,
  TEMPLATE5_MOCKUP_NOTICE,
} from '../templates/template5'

export const DOC_SICK_LEAVE = 'sick_leave'
export const DOC_COMPANION = 'companion_visit'
export const DOC_VISIT_STATEMENT = 'visit_statement'
export const DOC_COMPANION_SICK_LEAVE = 'companion_sick_leave'
// القالب الخامس — نموذج تصميم مستقل، معرّفه يأتي من وحدة القالب نفسها حتى
// لا يوجد للمعرّف مصدران يمكن أن يختلفا.
export const DOC_SICK_LEAVE_ENHANCED = TEMPLATE5_ID

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


// حقول صفحة الاستعلام العامة (المشهد الذي يفتحه رمز الـ QR). يصفها كل قالب
// بنفسه بدل سلسلة شروط في الصفحة — فأي قالب جديد يعرض حقوله الصحيحة تلقائياً.
const dateTime = (date, time) => [date, time].filter(Boolean).join(' - ')
const waitingAr = (r) => calcWaitingPeriod(
  r.admission_date_en, r.admission_time, r.discharge_date_en, r.discharge_time
).ar

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
    inquiryFields: (r) => [
      { label: 'الاسم', value: r.name_ar },
      { label: 'تاريخ اصدار تقرير الاجازة', value: r.issue_date },
      { label: 'تبدأ من', value: r.admission_date_en },
      { label: 'وحتى', value: r.discharge_date_en },
      { label: 'المدة بالأيام', value: r.leave_days },
      { label: 'اسم الطبيب', value: r.physician_name_ar },
      { label: 'المسمى الوظيفي', value: r.position_ar },
    ],
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
    inquiryFields: (r) => [
      { label: 'اسم المرافق', value: r.name_ar },
      { label: 'تاريخ اصدار التقرير', value: r.issue_date },
      { label: 'تاريخ / وقت الدخول', value: dateTime(r.admission_date_en, r.admission_time) },
      { label: 'تاريخ / وقت الخروج', value: dateTime(r.discharge_date_en, r.discharge_time) },
      { label: 'فترة الانتظار', value: waitingAr(r) },
      { label: 'اسم الممارس الصحي', value: r.physician_name_ar },
      { label: 'المسمى الوظيفي', value: r.position_ar },
      { label: 'نوع الزيارة', value: r.visit_type_ar },
    ],
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

  // ── تقرير مرافقة مريض ─────────────────────────────────────────────────────
  // إجازة مرضية لمرافق المريض: يجمع «مدة الإجازة» من الإجازة المرضية مع
  // «صلة القرابة» من قالب المرافق — وهو ما تصفه القدرات أدناه بالضبط.
  [DOC_COMPANION_SICK_LEAVE]: {
    key: DOC_COMPANION_SICK_LEAVE,
    optionLabel: 'تقرير مرافقة مريض',
    titleAr: 'تقرير مرافقة مريض',
    titleEn: 'Companion Sick Leave Report',
    icon: '🤝',
    description: 'إجازة مرضية لمرافق المريض، بمدة الإجازة وتاريخي الدخول والخروج وصلة القرابة.',
    accent: '#b45309',
    previewComponent: CompanionSickLeavePDFOriginal,
    previewTitle: 'معاينة تقرير مرافقة مريض',
    features: {
      times: false,
      relation: true,
      visitType: false,
      leaveDuration: true,
    },
    labels: {
      pageTitle: 'تقرير مرافقة مريض',
      docLabel: 'تقرير مرافقة مريض',
      deleteLabel: 'حذف تقرير المرافقة',
      nameEn: 'اسم المرافق (بالإنجليزية) *',
      nameAr: 'اسم المرافق (بالعربية) *',
      admissionDate: 'تاريخ الدخول *',
      dischargeDate: 'تاريخ الخروج *',
      practitionerEn: 'اسم الممارس (بالإنجليزية) *',
      practitionerAr: 'اسم الممارس (بالعربية) *',
      facilityAr: 'اسم المنشأة الصحية (بالعربية) *',
      facilityEn: 'اسم المنشأة الصحية (بالإنجليزية) *',
      positionEn: 'المسمى الوظيفي (بالإنجليزية) *',
      positionAr: 'المسمى الوظيفي (بالعربية) *',
    },
    inquiryFields: (r) => [
      { label: 'اسم المرافق', value: r.name_ar },
      { label: 'تاريخ اصدار التقرير', value: r.issue_date },
      { label: 'تبدأ من', value: r.admission_date_en },
      { label: 'وحتى', value: r.discharge_date_en },
      { label: 'المدة بالأيام', value: r.leave_days },
      { label: 'صلة القرابة', value: r.relation_ar },
      { label: 'اسم الممارس', value: r.physician_name_ar },
      { label: 'المسمى الوظيفي', value: r.position_ar },
    ],
    requiredFields: {
      ...SHARED_REQUIRED,
      name: 'اسم المرافق بالإنجليزية مطلوب',
      nameArabic: 'اسم المرافق بالعربية مطلوب',
      physicianPosition: 'المسمى الوظيفي بالإنجليزية مطلوب',
      physicianPositionArabic: 'المسمى الوظيفي بالعربية مطلوب',
      startDate: 'تاريخ بداية الإجازة مطلوب',
      endDate: 'تاريخ نهاية الإجازة مطلوب',
      doctorName: 'اسم الممارس بالإنجليزية مطلوب',
      doctorNameArabic: 'اسم الممارس بالعربية مطلوب',
      relationArabic: 'صلة القرابة بالعربية مطلوبة',
      relationEnglish: 'صلة القرابة بالإنجليزية مطلوبة',
      hospitalNameArabic: 'اسم المنشأة الصحية بالعربية مطلوب',
      hospitalNameEnglish: 'اسم المنشأة الصحية بالإنجليزية مطلوب',
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
    inquiryFields: (r) => [
      { label: 'الاسم', value: r.name_ar },
      { label: 'تاريخ اصدار التقرير', value: r.issue_date },
      { label: 'تاريخ الدخول', value: dateTime(r.admission_date_en, r.admission_time) },
      { label: 'تاريخ الخروج', value: dateTime(r.discharge_date_en, r.discharge_time) },
      { label: 'فترة الانتظار', value: waitingAr(r) },
      { label: 'اسم الممارس', value: r.physician_name_ar },
      { label: 'المسمى الوظيفي', value: r.position_ar },
      { label: 'نوع الزيارة', value: r.visit_type_ar },
    ],
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

  // ── القالب الخامس: «تقرير إجازة مرضية - محسن» ─────────────────────────────
  // نموذج تصميم قابل للتحرير (mockup) مستقلٌّ تماماً عن قالب «تقرير إجازة
  // مرضية» أعلاه: مكوّن معاينة خاص، ووحدة تخطيط/تنسيق/تصيير خاصة
  // (src/templates/template5)، ومولّد PDF خاص في الخادم. لا يشترك معه في أي
  // ملف، فتعديل أحدهما لا يمسّ الآخر إطلاقاً.
  //
  // لا يحوي هذا القالب رمز QR ولا رابط تحقّق: هو نموذج عرض للتخطيط والبيانات
  // لا مولّد مستندات موثّقة، وواجهة التطبيق تصرّح بذلك عبر isMockup.
  [DOC_SICK_LEAVE_ENHANCED]: {
    key: DOC_SICK_LEAVE_ENHANCED,
    optionLabel: TEMPLATE5_NAME_AR,
    titleAr: TEMPLATE5_NAME_AR,
    titleEn: TEMPLATE5_NAME_EN,
    icon: '🧩',
    description: 'نموذج تصميم قابل للتحرير بتخطيط مرجعي: جدول واحد بأحد عشر حقلاً، وتذييل بمنطقتين يفصلهما خط رأسي واحد.',
    accent: '#2c3e77',
    previewComponent: SickLeaveEnhancedPDFTemplate5,
    previewTitle: `معاينة ${TEMPLATE5_NAME_AR}`,
    // يميّز الواجهة: بطاقة القالب وترويسة المعاينة ونموذج الإدخال تعرض تنبيهاً
    // بأن المخرَج نموذج تصميم لا مستند رسمي.
    isMockup: true,
    mockupNotice: TEMPLATE5_MOCKUP_NOTICE,
    features: {
      times: false,
      relation: false,
      visitType: false,
      leaveDuration: true,
    },
    labels: {
      pageTitle: TEMPLATE5_NAME_AR,
      docLabel: 'نموذج التقرير المحسّن',
      deleteLabel: 'حذف نموذج التقرير المحسّن',
      nameEn: 'الاسم (بالإنجليزية) *',
      nameAr: 'الاسم (بالعربية) *',
      admissionDate: 'تاريخ الدخول *',
      dischargeDate: 'تاريخ الخروج *',
      practitionerEn: 'اسم الممارس (بالإنجليزية) *',
      practitionerAr: 'اسم الممارس (بالعربية) *',
      facilityAr: 'اسم المنشأة (بالعربية) *',
      facilityEn: 'اسم المنشأة (بالإنجليزية) *',
      positionEn: 'المسمى الوظيفي (بالإنجليزية) *',
      positionAr: 'المسمى الوظيفي (بالعربية) *',
    },
    inquiryFields: (r) => [
      { label: 'الاسم', value: r.name_ar },
      { label: 'تاريخ إصدار التقرير', value: r.issue_date },
      { label: 'تبدأ من', value: r.admission_date_en },
      { label: 'وحتى', value: r.discharge_date_en },
      { label: 'المدة بالأيام', value: r.leave_days },
      { label: 'اسم الممارس', value: r.physician_name_ar },
      { label: 'المسمى الوظيفي', value: r.position_ar },
    ],
    requiredFields: {
      ...SHARED_REQUIRED,
      name: 'الاسم بالإنجليزية مطلوب',
      nameArabic: 'الاسم بالعربية مطلوب',
      physicianPosition: 'المسمى الوظيفي بالإنجليزية مطلوب',
      physicianPositionArabic: 'المسمى الوظيفي بالعربية مطلوب',
      startDate: 'تاريخ بداية الإجازة مطلوب',
      endDate: 'تاريخ نهاية الإجازة مطلوب',
      doctorName: 'اسم الممارس بالإنجليزية مطلوب',
      doctorNameArabic: 'اسم الممارس بالعربية مطلوب',
      hospitalNameArabic: 'اسم المنشأة بالعربية مطلوب',
      hospitalNameEnglish: 'اسم المنشأة بالإنجليزية مطلوب',
    },
  },
}

// ترتيب عرض القوالب في القوائم وصفحة القوالب.
export const DOCUMENT_TYPE_LIST = [
  DOCUMENT_TYPES[DOC_SICK_LEAVE],
  DOCUMENT_TYPES[DOC_COMPANION],
  DOCUMENT_TYPES[DOC_COMPANION_SICK_LEAVE],
  DOCUMENT_TYPES[DOC_VISIT_STATEMENT],
  DOCUMENT_TYPES[DOC_SICK_LEAVE_ENHANCED],
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
