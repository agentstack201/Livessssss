// ───────────────────────────────────────────────────────────────────────────
// سجلّ القوالب الورقية.
//
// كل قالب يصف: عنوانه، خطّه الافتراضي، جسمه (HTML)، وأنماطه، وقائمة حقوله
// الخاصة. قائمة الحقول هي ما يبني نموذج الإدخال الديناميكي في الواجهة وما
// يوجّه استخراج الذكاء الاصطناعي — فلا تُكتب أسماء الحقول يدوياً في مكانين.
//
// التصميم يأتي دائماً من ملف القالب هنا، والبيانات من قاعدة البيانات أو من
// الملف المرفوع. هذا الفصل إلزامي: الملف المرفوع مصدر بيانات فقط، لا تصميم.
// ───────────────────────────────────────────────────────────────────────────
const { DEFAULT_FONT } = require('./documentFonts');

// أنواع الحقول المدعومة في نموذج الإدخال الديناميكي.
// text | textarea | date | time | number | checkbox | select | image
const T = (key, labelAr, opts = {}) => ({ key, labelAr, type: 'text', ...opts });

// حقول الترويسة والختم المشتركة بين كل التقارير الورقية.
const LETTERHEAD_FIELDS = [
  T('header_ar', 'ترويسة المنشأة (عربي)', { type: 'textarea', group: 'الترويسة', hint: 'سطر لكل معلومة' }),
  T('header_en', 'ترويسة المنشأة (إنجليزي)', { type: 'textarea', group: 'الترويسة', hint: 'One line per entry' }),
  T('facility_logo', 'شعار المنشأة', { type: 'image', group: 'الترويسة' }),
  T('stamp_image', 'صورة الختم', { type: 'image', group: 'التواقيع والأختام' }),
  T('signature_image', 'صورة التوقيع', { type: 'image', group: 'التواقيع والأختام' }),
];

const PAPER_TEMPLATES = {
  // ── تقرير بأجازة مرضية (ج) — مجمع خالد المتميز الطبي ────────────────────
  khalid_sick_leave: {
    id: 'khalid_sick_leave',
    titleAr: 'تقرير بأجازة مرضية (ج)',
    titleEn: 'Sick Leave Report ( C )',
    defaultFont: DEFAULT_FONT,
    module: './paper/khalidSickLeave',
    fields: [
      T('medical_record_no', 'رقم السجل الطبي', { group: 'بيانات المريض' }),
      T('sex', 'الجنس', { type: 'select', group: 'بيانات المريض', options: [
        { value: '', label: '—' }, { value: 'M', label: 'ذكر' }, { value: 'F', label: 'أنثى' },
      ] }),
      T('date_of_birth', 'تاريخ الميلاد', { group: 'بيانات المريض' }),
      T('occupation', 'المهنة', { group: 'بيانات المريض' }),
      T('visit_date', 'تاريخ المراجعة', { group: 'بيانات المريض' }),

      T('rec_sick_leave', 'منح إجازة مرضية', { type: 'checkbox', group: 'التوصيات', default: true }),
      T('leave_days_text', 'عدد أيام الإجازة (نص)', { group: 'التوصيات', hint: 'فارغ = يُحسب تلقائياً' }),
      T('leave_from', 'اعتباراً من (إنجليزي)', { group: 'التوصيات' }),
      T('leave_to', 'إلى (إنجليزي)', { group: 'التوصيات' }),
      T('leave_from_ar', 'اعتباراً من (عربي)', { group: 'التوصيات' }),
      T('leave_to_ar', 'إلى (عربي)', { group: 'التوصيات' }),
      T('rec_follow_up', 'مراجعة الطبيب قبل انتهاء الإجازة', { type: 'checkbox', group: 'التوصيات' }),
      T('rec_referral', 'إحالة إلى الهيئة الطبية العامة', { type: 'checkbox', group: 'التوصيات' }),
      T('rec_approval', 'اعتماد التقرير الطبي', { type: 'checkbox', group: 'التوصيات' }),
      T('rec_cannot_treat', 'من غير الممكن علاجه في المستشفى', { type: 'checkbox', group: 'التوصيات' }),
      T('rec_disability', 'عجز صحي جزئي أو قطعي', { type: 'checkbox', group: 'التوصيات' }),
      T('rec_others', 'أخرى', { type: 'checkbox', group: 'التوصيات' }),
      T('others_text', 'نص «أخرى» (التشخيص)', { group: 'التوصيات' }),

      T('badge_no', 'رقم الشارة (Badge No)', { group: 'الطبيب' }),
      T('director_title', 'سطر تصديق المدير', { group: 'الطبيب' }),

      T('addressee', 'سعادة (الجهة المرسل إليها)', { group: 'التذييل الإداري' }),
      T('referral_no', 'رقم الإحالة', { group: 'التذييل الإداري' }),
      T('referral_date', 'تاريخ الإحالة', { group: 'التذييل الإداري' }),
      T('director_line', 'سطر المدير في التذييل', { group: 'التذييل الإداري' }),
      ...LETTERHEAD_FIELDS,
    ],
  },

  // ── تقرير إجازة مرضية — مستشفى المدينة الوطني ───────────────────────────
  madina_sick_leave: {
    id: 'madina_sick_leave',
    titleAr: 'تقرير إجازة مرضية — المدينة الوطني',
    titleEn: 'Sick Leave Report — Madina National',
    defaultFont: DEFAULT_FONT,
    module: './paper/madinaSickLeave',
    fields: [
      T('report_no', 'رقم التقرير', { group: 'الترويسة' }),
      T('report_tel', 'هاتف التقرير', { group: 'الترويسة' }),
      T('facility_ar', 'اسم المنشأة (عربي)', { group: 'الترويسة' }),
      T('facility_en', 'اسم المنشأة (إنجليزي)', { group: 'الترويسة' }),
      T('nhic_logo', 'شعار المركز الوطني', { type: 'image', group: 'الترويسة' }),
      T('platform_logo', 'شعار المنصة (التذييل)', { type: 'image', group: 'الترويسة' }),
      T('platform_caption', 'نص التذييل', { group: 'الترويسة' }),

      T('medical_record_no', 'رقم السجل الطبي', { group: 'بيانات المريض' }),
      T('patient_tel', 'هاتف المريض', { group: 'بيانات المريض' }),
      T('vacation_date', 'تاريخ الإجازة', { group: 'بيانات المريض' }),
      T('gender_ar', 'الجنس (عربي)', { group: 'بيانات المريض' }),
      T('gender_en', 'الجنس (إنجليزي)', { group: 'بيانات المريض' }),
      T('date_of_birth', 'تاريخ الميلاد', { group: 'بيانات المريض' }),
      T('profession_ar', 'المهنة (عربي)', { group: 'بيانات المريض' }),
      T('profession_en', 'المهنة (إنجليزي)', { group: 'بيانات المريض' }),
      T('entry_date', 'تاريخ الدخول (كما يُطبع)', { group: 'بيانات المريض' }),
      T('exit_date', 'تاريخ الخروج (كما يُطبع)', { group: 'بيانات المريض' }),
      T('diagnosis_ar', 'التشخيص (عربي)', { group: 'بيانات المريض' }),
      T('diagnosis_en', 'التشخيص (إنجليزي)', { group: 'بيانات المريض' }),

      T('leave_from_ar', 'من تاريخ', { group: 'التوصيات' }),
      T('leave_to_ar', 'حتى تاريخ', { group: 'التوصيات' }),
      T('rec_follow_up', 'مراجعة الطبيب قبل انتهاء الإجازة', { type: 'checkbox', group: 'التوصيات', default: true }),

      T('alt_physician_ar', 'الطبيب المناوب (عربي)', { group: 'الطبيب' }),
      T('alt_physician_en', 'الطبيب المناوب (إنجليزي)', { group: 'الطبيب' }),
      T('alt_position_ar', 'مسمى المناوب (عربي)', { group: 'الطبيب' }),
      T('alt_position_en', 'مسمى المناوب (إنجليزي)', { group: 'الطبيب' }),
      ...LETTERHEAD_FIELDS,
    ],
  },

  // ── إشعار موعد — مدينة الملك فهد الطبية ─────────────────────────────────
  kfmc_appointment: {
    id: 'kfmc_appointment',
    titleAr: 'إشعار موعد',
    titleEn: 'Appointment Notice',
    defaultFont: DEFAULT_FONT,
    module: './paper/kfmcAppointment',
    fields: [
      T('doc_title', 'عنوان المستند', { group: 'الترويسة' }),
      T('country_line', 'سطر الدولة', { group: 'الترويسة' }),
      T('facility_ar', 'اسم المنشأة (عربي)', { group: 'الترويسة' }),
      T('facility_en', 'اسم المنشأة (إنجليزي)', { group: 'الترويسة' }),
      T('vision_logo', 'شعار رؤية 2030', { type: 'image', group: 'الترويسة' }),

      T('date_of_birth', 'تاريخ الميلاد', { group: 'بيانات المريض' }),
      T('occupation_ar', 'المهنة (عربي)', { group: 'بيانات المريض' }),
      T('occupation_en', 'المهنة (إنجليزي)', { group: 'بيانات المريض' }),
      T('medical_record_no', 'الرقم الصحي', { group: 'بيانات المريض' }),

      T('referred_by_ar', 'محول من (عربي)', { group: 'بيانات الموعد' }),
      T('referred_by_en', 'محول من (إنجليزي)', { group: 'بيانات الموعد' }),
      T('appt_type_ar', 'نوع الموعد (عربي)', { group: 'بيانات الموعد' }),
      T('appt_type_en', 'نوع الموعد (إنجليزي)', { group: 'بيانات الموعد' }),
      T('specialty_ar', 'الاختصاص (عربي)', { group: 'بيانات الموعد' }),
      T('specialty_en', 'الاختصاص (إنجليزي)', { group: 'بيانات الموعد' }),
      T('appt_location_ar', 'مكان الموعد (عربي)', { group: 'بيانات الموعد' }),
      T('appt_location_en', 'مكان الموعد (إنجليزي)', { group: 'بيانات الموعد' }),
      T('building_ar', 'المبنى (عربي)', { group: 'بيانات الموعد' }),
      T('building_en', 'المبنى (إنجليزي)', { group: 'بيانات الموعد' }),
      T('appt_date_ar', 'تاريخ الموعد (هجري)', { group: 'بيانات الموعد' }),
      T('appt_date_en', 'تاريخ الموعد (إنجليزي)', { group: 'بيانات الموعد' }),
      T('appt_time_ar', 'وقت الموعد (عربي)', { group: 'بيانات الموعد' }),
      T('appt_time_en', 'وقت الموعد (إنجليزي)', { group: 'بيانات الموعد' }),
      T('appt_gregorian', 'الموافق (ميلادي)', { group: 'بيانات الموعد' }),
      T('appt_phone', 'هاتف المواعيد', { group: 'بيانات الموعد' }),

      T('dept_name', 'اسم الإدارة', { group: 'التواقيع والأختام' }),
      T('clinic_box', 'مربّع العيادة/الطبيب', { group: 'التواقيع والأختام' }),
      T('doctor_name_ar', 'اسم الطبيب (عربي)', { group: 'التواقيع والأختام' }),
      T('doctor_name_en', 'اسم الطبيب (إنجليزي)', { group: 'التواقيع والأختام' }),

      T('notes_title', 'عنوان التعليمات', { group: 'التعليمات' }),
      T('notes_intro', 'مقدمة التعليمات', { group: 'التعليمات' }),
      T('note_1', 'التعليمة الأولى', { type: 'textarea', group: 'التعليمات' }),
      T('note_2', 'التعليمة الثانية', { type: 'textarea', group: 'التعليمات' }),
      T('address_line', 'سطر العنوان', { group: 'التعليمات' }),
      ...LETTERHEAD_FIELDS,
    ],
  },

  // ── تقرير طبي — مستشفى الملك فهد العام ──────────────────────────────────
  kfgh_medical_report: {
    id: 'kfgh_medical_report',
    titleAr: 'تقرير طبي — الملك فهد العام',
    titleEn: 'Medical Report — King Fahad General',
    defaultFont: DEFAULT_FONT,
    module: './paper/kfghMedicalReport',
    fields: [
      T('badge_title', 'نص المربّع', { group: 'الترويسة' }),
      T('title_en', 'العنوان الإنجليزي', { group: 'الترويسة' }),
      T('table_logo', 'شعار داخل الجدول', { type: 'image', group: 'الترويسة' }),
      T('watermark_image', 'العلامة المائية', { type: 'image', group: 'الترويسة' }),
      T('medical_record_no', 'رقم الملف الطبي', { group: 'بيانات المريض' }),
      T('date_of_birth', 'تاريخ الميلاد', { group: 'بيانات المريض' }),
      T('gender_ar', 'الجنس', { group: 'بيانات المريض' }),
      T('extra_label', 'تسمية صف إضافي', { group: 'بيانات المريض' }),
      T('extra_value', 'قيمة الصف الإضافي', { group: 'بيانات المريض' }),
      T('whom_line', 'سطر «إلى من يهمه الأمر»', { group: 'نص التقرير' }),
      T('report_body', 'نص التقرير', { type: 'textarea', group: 'نص التقرير' }),
      T('reco_title', 'عنوان التوصيات', { group: 'نص التقرير' }),
      T('reco_body', 'نص التوصيات', { type: 'textarea', group: 'نص التقرير' }),
      T('closing_line', 'سطر الختام', { type: 'textarea', group: 'نص التقرير' }),
      T('signer_title', 'صفة الموقّع', { group: 'التواقيع والأختام' }),
      T('stamp_label', 'تسمية الختم', { group: 'التواقيع والأختام' }),
      T('efoot_note', 'حاشية الوثيقة الإلكترونية', { type: 'textarea', group: 'التذييل' }),
      T('page_no', 'رقم الصفحة', { group: 'التذييل' }),
      ...LETTERHEAD_FIELDS,
    ],
  },

  // ── تقرير إجازة مرضية — مستشفى حقل العام ────────────────────────────────
  haql_sick_leave: {
    id: 'haql_sick_leave',
    titleAr: 'تقرير إجازة مرضية — حقل العام',
    titleEn: 'Sick Leave Report — Haql General',
    defaultFont: DEFAULT_FONT,
    module: './paper/haqlSickLeave',
    fields: [
      T('title_ar', 'العنوان (عربي)', { group: 'الترويسة' }),
      T('title_en', 'العنوان (إنجليزي)', { group: 'الترويسة' }),
      T('wave_image', 'الشريط الزخرفي', { type: 'image', group: 'الترويسة' }),
      T('medical_record_no', 'رقم السجل الطبي', { group: 'بيانات المريض' }),
      T('sex', 'الجنس', { type: 'select', group: 'بيانات المريض', options: [
        { value: '', label: '—' }, { value: 'M', label: 'ذكر' }, { value: 'F', label: 'أنثى' },
      ] }),
      T('date_of_birth', 'تاريخ الميلاد', { group: 'بيانات المريض' }),
      T('occupation_ar', 'المهنة (عربي)', { group: 'بيانات المريض' }),
      T('occupation_en', 'المهنة (إنجليزي)', { group: 'بيانات المريض' }),
      T('adm_date_ar', 'تاريخ الدخول (هجري)', { group: 'التواريخ' }),
      T('dis_date_ar', 'تاريخ الخروج (هجري)', { group: 'التواريخ' }),
      T('visit_date_ar', 'تاريخ المراجعة (هجري)', { group: 'التواريخ' }),
      T('visit_time', 'وقت المراجعة', { group: 'التواريخ' }),
      T('visit_tag_ar', 'وسم الزيارة (عربي)', { group: 'التواريخ' }),
      T('visit_tag_en', 'وسم الزيارة (إنجليزي)', { group: 'التواريخ' }),
      T('rec_sick_leave', 'منح إجازة مرضية', { type: 'checkbox', group: 'التوصيات', default: true }),
      T('leave_days_ar', 'مدة الإجازة (عربي)', { group: 'التوصيات' }),
      T('leave_days_en', 'مدة الإجازة (إنجليزي)', { group: 'التوصيات' }),
      T('leave_from_ar', 'اعتباراً من (هجري)', { group: 'التوصيات' }),
      T('leave_to_ar', 'إلى (هجري)', { group: 'التوصيات' }),
      T('leave_from_en', 'من (إنجليزي)', { group: 'التوصيات' }),
      T('leave_to_en', 'إلى (إنجليزي)', { group: 'التوصيات' }),
      T('rec_follow_up', 'مراجعة الطبيب قبل انتهاء الإجازة', { type: 'checkbox', group: 'التوصيات' }),
      T('rec_referral', 'إحالة للهيئة الطبية', { type: 'checkbox', group: 'التوصيات' }),
      T('rec_others', 'أخرى / التشخيص', { type: 'checkbox', group: 'التوصيات', default: true }),
      T('diagnosis_label', 'تسمية التشخيص', { group: 'التوصيات' }),
      T('diagnosis_ar', 'التشخيص', { group: 'التوصيات' }),
      T('sign1_title', 'الكتلة ١ — الصفة', { group: 'التواقيع والأختام' }),
      T('sign1_name', 'الكتلة ١ — الاسم', { group: 'التواقيع والأختام' }),
      T('license_box', 'مربّع الترخيص', { type: 'textarea', group: 'التواقيع والأختام' }),
      T('sign2_title', 'الكتلة ٢ — الصفة', { group: 'التواقيع والأختام' }),
      T('sign2_name', 'الكتلة ٢ — الاسم', { group: 'التواقيع والأختام' }),
      T('signature2_image', 'توقيع الكتلة ٢', { type: 'image', group: 'التواقيع والأختام' }),
      T('sign3_title', 'الكتلة ٣ — الصفة', { group: 'التواقيع والأختام' }),
      T('sign3_lines', 'الكتلة ٣ — الأسطر', { group: 'التواقيع والأختام' }),
      ...LETTERHEAD_FIELDS,
    ],
  },

  // ── تقرير إجازة مرضية (نموذج Word) — مستشفى الملك فهد العام ─────────────
  kfgh_sick_leave_form: {
    id: 'kfgh_sick_leave_form',
    titleAr: 'تقرير إجازة مرضية (نموذج) — الملك فهد العام',
    titleEn: 'Sick Leave Form — King Fahad General',
    defaultFont: DEFAULT_FONT,
    module: './paper/kfghSickLeaveForm',
    fields: [
      T('header_image', 'صورة الترويسة (بعرض الصفحة)', { type: 'image', group: 'الترويسة' }),
      T('medical_record_no', 'رقم الملف الطبي', { group: 'بيانات المريض' }),
      T('sex', 'الجنس', { type: 'select', group: 'بيانات المريض', options: [
        { value: '', label: '—' }, { value: 'M', label: 'ذكر' }, { value: 'F', label: 'أنثى' } ] }),
      T('age', 'العمر', { group: 'بيانات المريض' }),
      T('address', 'العنوان', { group: 'بيانات المريض' }),
      T('visit_date', 'تاريخ مراجعة العيادة', { group: 'بيانات المريض' }),
      T('adm_date_ar', 'تاريخ الدخول (عربي)', { group: 'بيانات المريض' }),
      T('dis_date_ar', 'تاريخ الخروج (عربي)', { group: 'بيانات المريض' }),
      T('diagnosis_ar', 'التشخيص (عربي)', { group: 'بيانات المريض' }),
      T('diagnosis_en', 'التشخيص (إنجليزي)', { group: 'بيانات المريض' }),
      T('followup_date', 'يراجع المستشفى في', { group: 'التوصيات' }),
      T('followup_en', 'سطر المراجعة (إنجليزي)', { group: 'التوصيات' }),
      T('leave_days_ar', 'مدة الإجازة (عربي)', { group: 'التوصيات' }),
      T('leave_days_en', 'مدة الإجازة (إنجليزي)', { group: 'التوصيات' }),
      T('leave_from_ar', 'اعتباراً من (عربي)', { group: 'التوصيات' }),
      T('leave_to_ar', 'إلى (عربي)', { group: 'التوصيات' }),
      T('leave_from_en', 'من (إنجليزي)', { group: 'التوصيات' }),
      T('leave_to_en', 'إلى (إنجليزي)', { group: 'التوصيات' }),
      T('physician1', 'الطبيب الأول', { group: 'الأطباء' }),
      T('physician2', 'الطبيب الثاني', { group: 'الأطباء' }),
      T('physician3', 'الطبيب الثالث', { group: 'الأطباء' }),
      T('signature2_image', 'توقيع الطبيب الثاني', { type: 'image', group: 'التواقيع والأختام' }),
      T('signature3_image', 'توقيع الطبيب الثالث', { type: 'image', group: 'التواقيع والأختام' }),
      T('seal2_image', 'الختم الثاني (the seal)', { type: 'image', group: 'التواقيع والأختام' }),
      T('efoot_note', 'حاشية الوثيقة الإلكترونية', { type: 'textarea', group: 'التذييل' }),
      ...LETTERHEAD_FIELDS,
    ],
  },

  // ── تقرير إجازة مرضية — مدينة الملك سعود الطبية ─────────────────────────
  ksmc_sick_leave: {
    id: 'ksmc_sick_leave',
    titleAr: 'تقرير إجازة مرضية — الملك سعود الطبية',
    titleEn: 'Sick Leave Report — King Saud Medical City',
    defaultFont: DEFAULT_FONT,
    module: './paper/ksmcSickLeave',
    fields: [
      T('header_image', 'صورة الترويسة (بعرض الصفحة)', { type: 'image', group: 'الترويسة' }),
      T('title_ar', 'العنوان (عربي)', { group: 'الترويسة' }),
      T('title_en', 'العنوان (إنجليزي)', { group: 'الترويسة' }),
      T('medical_record_no', 'رقم السجل الطبي', { group: 'بيانات المريض' }),
      T('sex_ar', 'الجنس (عربي)', { group: 'بيانات المريض' }),
      T('sex_en', 'الجنس (إنجليزي)', { group: 'بيانات المريض' }),
      T('date_of_birth', 'تاريخ الميلاد', { group: 'بيانات المريض' }),
      T('occupation_ar', 'المهنة (عربي)', { group: 'بيانات المريض' }),
      T('occupation_en', 'المهنة (إنجليزي)', { group: 'بيانات المريض' }),
      T('visit_date', 'تاريخ المراجعة', { group: 'بيانات المريض' }),
      T('adm_date_ar', 'تاريخ الدخول (عربي)', { group: 'بيانات المريض' }),
      T('dis_date_ar', 'تاريخ الخروج (عربي)', { group: 'بيانات المريض' }),
      T('rec_sick_leave', 'منح إجازة مرضية', { type: 'checkbox', group: 'التوصيات', default: true }),
      T('leave_days_ar', 'مدة الإجازة', { group: 'التوصيات' }),
      T('rec_period', 'سطر المدة والتاريخ', { type: 'checkbox', group: 'التوصيات' }),
      T('leave_days_num', 'المدة رقماً', { group: 'التوصيات' }),
      T('leave_to_ar', 'إلى تاريخ', { group: 'التوصيات' }),
      T('rec_follow_up', 'مراجعة الطبيب قبل انتهاء الإجازة', { type: 'checkbox', group: 'التوصيات' }),
      T('rec_referral', 'إحالة إلى الهيئة الطبية العامة', { type: 'checkbox', group: 'التوصيات' }),
      T('rec_approval', 'اعتماد التقرير الطبي', { type: 'checkbox', group: 'التوصيات' }),
      T('rec_cannot_treat', 'من غير الممكن علاجه في المشفى', { type: 'checkbox', group: 'التوصيات' }),
      T('rec_disability', 'عجز صحي جزئي أو قطعي', { type: 'checkbox', group: 'التوصيات' }),
      T('rec_others', 'أخرى', { type: 'checkbox', group: 'التوصيات' }),
      T('others_text', 'نص «أخرى»', { group: 'التوصيات' }),
      T('addressee', 'سعادة (المرسل إليه)', { group: 'الخطاب' }),
      T('salutation', 'التحية', { group: 'الخطاب' }),
      T('letter_line1', 'سطر الخطاب الأول', { type: 'textarea', group: 'الخطاب' }),
      T('letter_line2', 'سطر الخطاب الثاني', { type: 'textarea', group: 'الخطاب' }),
      T('signer_title', 'صفة الموقّع', { group: 'الخطاب' }),
      T('signer_name', 'اسم الموقّع', { group: 'الخطاب' }),
      ...LETTERHEAD_FIELDS,
    ],
  },
};

// تحميل كسول لوحدة القالب (جسم HTML + CSS) — تُحمَّل مرة واحدة عند أول طلب.
const _loaded = new Map();
function getPaperTemplate(id) {
  const key = Object.prototype.hasOwnProperty.call(PAPER_TEMPLATES, id) ? id : null;
  if (!key) throw new Error(`Unknown paper template: ${id}`);
  if (!_loaded.has(key)) {
    const meta = PAPER_TEMPLATES[key];
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const mod = require(`../middlewares/${meta.module.replace(/^\.\//, '')}`);
    _loaded.set(key, { ...meta, css: mod.css, body: mod.body });
  }
  return _loaded.get(key);
}

// وصف الحقول فقط (بلا تحميل وحدة القالب) — تستهلكه الواجهة والذكاء الاصطناعي.
function paperTemplateFields(id) {
  return PAPER_TEMPLATES[id] ? PAPER_TEMPLATES[id].fields : [];
}

module.exports = { PAPER_TEMPLATES, getPaperTemplate, paperTemplateFields, LETTERHEAD_FIELDS };
