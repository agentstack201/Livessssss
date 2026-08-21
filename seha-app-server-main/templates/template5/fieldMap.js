// ───────────────────────────────────────────────────────────────────────────
// خريطة ربط البيانات بالقالب الأصلي.
//
// هذا هو «التحويل إلى قالب ديناميكي»: كل سطرٍ هنا يقول أي كتلة نصّ في
// master.pdf تخصّ أي حقل، وبأي خط وحجم ولون وخط أساس وتوسيط كُتبت في الأصل.
// كل القيم أدناه مقروءة من الملف الأصلي نفسه (من مجرى محتوى الصفحة ومن
// إحداثيات جدوله)، لا مُقدَّرة ولا مُعاد تصميمها.
//
// blocks : أرقام كتل BT…ET في مجرى المحتوى التي يملكها هذا الحقل. تُستبدل
//          الكتلة الأولى بالمحتوى الجديد كاملاً، وتُفرَّغ البقية (وهي محاطة
//          بـ q…Q فلا يترك تفريغها أثراً).
// كل ما عدا هذه الكتل — الحدود والخلفيات والصور والمسمّيات والعناوين
// والتذييل الثابت — لا يُمَسّ إطلاقاً.
// ───────────────────────────────────────────────────────────────────────────

// ألوان النصّ كما هي في الملف الأصلي (أوامر rg).
const VALUE_COLOR = '0.17255 0.24314 0.46667';   // نصّ القيم الأزرق الداكن
const WHITE = '1 1 1';                            // صف «مدة الإجازة»
const INHERIT = null;                             // التذييل: أسود موروث، بلا أمر لون

// هندسة الجدول مقروءة من رسومات الملف الأصلي (بوحدات PDF، الأصل أسفل يسار).
// حدود الأعمدة: 36 | 199 | 437.5 | 676 | 806
const COL_VALUE_EN = 318.25;    // مركز عمود القيمة الإنجليزية
const COL_VALUE_AR = 556.75;    // مركز عمود القيمة العربية
const COL_MERGED = 437.5;       // مركز العمودين معاً (رمز الإجازة، تاريخ الإصدار، الهوية)
// مراكز سطور التذييل الثلاثة كما هي في الملف الأصلي. تختلف بينها بأجزاء من
// النقطة لأن مولّد الملف الأصلي قرّب كل سطر على حدة — ونحن نعيد ما فيه بالضبط.
const FOOTER_CENTER_AR = 632.87;
const FOOTER_CENTER_EN = 633.13;
const FOOTER_CENTER_LICENSE = 632.68;
const FOOTER_LEFT = 38.25;      // بداية سطرَي التاريخ والوقت (محاذاة يسار)

// عرض المحتوى داخل الخانة = عرض العمود − الحدّ (0.75) − الحشو (7.42) من الجهتين.
const CELL_WIDTH = 222.16;
const MERGED_WIDTH = 460.66;
const FOOTER_WIDTH = 260;

// المسافة بين سطرَي الاسم في الملف الأصلي (719.44 − 703.92).
const LEADING = 15.52;

// ارتفاع صفّ الاسم الداخلي في الملف الأصلي. حدود الجدول رسومٌ ثابتة في الملف،
// فارتفاع الصفّ لا يتمدّد. اسمٌ يحتاج سطرين أو أقل — وهو ما يعرضه الملف
// الأصلي — يُرسم بمسافة الأسطر الأصلية بلا أي تغيير. أما اسمٌ يفيض عن ذلك
// فتُضيَّق المسافة بين أسطره وحدها ليبقى داخل صفّه: حجم الخط ووزنه وعرض
// النصّ وترتيب كلماته لا يتغيّر منها شيء إطلاقاً.
const NAME_ROW_HEIGHT = 42;

// ── التذييل الأيمن: كتلة المنشأة تتدفّق سطراً بعد سطر ────────────────────
// في الملف الأصلي ثلاثة سطور بخطوط أساس ثابتة. لو التفّ اسم المنشأة إلى سطرين
// تراكبت السطور. لذلك تُرسم الكتلة كتدفّق: السطر الأول على خط أساس الأصل
// نفسه، وكل سطر بعده يهبط بمقدار المسافة الأصلية بينهما. اسمٌ من سطر واحد
// ينتج الملف الأصلي بالضبط، واسمٌ أطول ينزل بلا أي تراكب.
const FACILITY_BLOCK = {
  firstBaseline: 329.55,   // خط أساس الاسم العربي في الأصل
  arLeading: 20.31,        // 329.55 − 309.24 (الفراغ بين العربي والإنجليزي)
  enLeading: 17.5,         // ارتفاع سطر إنجليزي عند 12.75 نقطة
  licenseGap: 21.28,       // 309.24 − 287.96
  // أدنى خط أساس مسموح: أعلى شعار المركز الوطني (250.5) مع هامش أمان.
  minBaseline: 262,
};

// ── رمز الاستجابة السريعة (الباركود) ─────────────────────────────────────
// الفراغ المحجوز له في الملف الأصلي: أعلى نصّ التحقّق في العمود الأيسر،
// وموسَّطٌ على نفس المحور الذي توسَّط عليه ذلك النصّ (226.63).
// يُرسم مربّعاتٍ متجهة لا صورةً نقطية، فيبقى حاداً عند أي تكبير.
const QR = {
  centerX: 226.63,
  bottom: 344,
  size: 95.5,              // 90 بكسل في مقاس الملف الأصلي
};

// ── شعار المنشأة في التذييل ──────────────────────────────────────────────
// نفس المربّع الذي يرسم فيه الملف الأصلي شعاره حرفياً (أمر cm في المحتوى).
// الشعار البديل يُركَّب داخله بنسبة أبعاده فلا يتشوّه ولا يتجاوز إطاره.
const FOOTER_LOGO_BOX = { x: 576.88, y: 350.83, width: 112.5, height: 112.5 };

const FIELDS = [
  { id: 'leaveId', blocks: [5], type: 'latin', fontRef: 'F1', size: 13.5, color: VALUE_COLOR,
    x: COL_MERGED, align: 'center', maxWidth: MERGED_WIDTH, baseline: 923.76, leading: LEADING },

  { id: 'durationEn', blocks: [8], type: 'latin', fontRef: 'F1', size: 13.5, color: WHITE,
    x: COL_VALUE_EN, align: 'center', maxWidth: CELL_WIDTH, baseline: 881, leading: LEADING },

  // العمود العربي لمدة الإجازة: مقاطع متتالية بصرياً من اليسار إلى اليمين،
  // أرقام بخط Times وكلمات بالخط العربي — تماماً كما رُكِّبت في الأصل.
  { id: 'durationAr', blocks: [9, 10, 11, 12, 13], type: 'composite', size: 13.5, color: WHITE,
    x: COL_VALUE_AR, align: 'center', baseline: 880.48 },

  { id: 'admissionEn', blocks: [16], type: 'latin', fontRef: 'F1', size: 13.5, color: VALUE_COLOR,
    x: COL_VALUE_EN, align: 'center', maxWidth: CELL_WIDTH, baseline: 838.99, leading: LEADING },
  { id: 'admissionAr', blocks: [17], type: 'latin', fontRef: 'F1', size: 13.5, color: VALUE_COLOR,
    x: COL_VALUE_AR, align: 'center', maxWidth: CELL_WIDTH, baseline: 838.99, leading: LEADING },

  { id: 'dischargeEn', blocks: [20], type: 'latin', fontRef: 'F1', size: 13.5, color: VALUE_COLOR,
    x: COL_VALUE_EN, align: 'center', maxWidth: CELL_WIDTH, baseline: 796.97, leading: LEADING },
  { id: 'dischargeAr', blocks: [21], type: 'latin', fontRef: 'F1', size: 13.5, color: VALUE_COLOR,
    x: COL_VALUE_AR, align: 'center', maxWidth: CELL_WIDTH, baseline: 796.97, leading: LEADING },

  { id: 'issueDate', blocks: [24], type: 'latin', fontRef: 'F1', size: 13.5, color: VALUE_COLOR,
    x: COL_MERGED, align: 'center', maxWidth: MERGED_WIDTH, baseline: 754.96, leading: LEADING },

  // الاسم الإنجليزي: سطران في الأصل. خط الأساس المرجعي هو منتصف السطرين
  // (711.68) وهو نفسه خط أساس السطر الواحد في هذا الصف — فاسمٌ من سطر واحد
  // يقع في مكانه الصحيح تماماً، ومن سطرين يقع حيث هو في الأصل بالضبط.
  { id: 'nameEn', blocks: [27, 28], type: 'latin', fontRef: 'F1', size: 13.5, color: VALUE_COLOR,
    x: COL_VALUE_EN, align: 'center', maxWidth: CELL_WIDTH, baseline: 711.68, leading: LEADING,
    maxHeight: NAME_ROW_HEIGHT },
  { id: 'nameAr', blocks: [29], type: 'arabic', weight: 'regular', size: 13.5, color: VALUE_COLOR,
    x: COL_VALUE_AR, align: 'center', maxWidth: CELL_WIDTH, baseline: 711.16, leading: LEADING,
    maxHeight: NAME_ROW_HEIGHT },

  { id: 'nationalId', blocks: [32], type: 'latin', fontRef: 'F1', size: 13.5, color: VALUE_COLOR,
    x: COL_MERGED, align: 'center', maxWidth: MERGED_WIDTH, baseline: 668.4, leading: LEADING },

  { id: 'nationalityEn', blocks: [37], type: 'latin', fontRef: 'F1', size: 13.5, color: VALUE_COLOR,
    x: COL_VALUE_EN, align: 'center', maxWidth: CELL_WIDTH, baseline: 626.39, leading: LEADING },
  { id: 'nationalityAr', blocks: [38], type: 'arabic', weight: 'regular', size: 13.5, color: VALUE_COLOR,
    x: COL_VALUE_AR, align: 'center', maxWidth: CELL_WIDTH, baseline: 625.87, leading: LEADING },

  { id: 'employerEn', blocks: [41], type: 'latin', fontRef: 'F1', size: 13.5, color: VALUE_COLOR,
    x: COL_VALUE_EN, align: 'center', maxWidth: CELL_WIDTH, baseline: 584.38, leading: LEADING },
  { id: 'employerAr', blocks: [42], type: 'arabic', weight: 'regular', size: 13.5, color: VALUE_COLOR,
    x: COL_VALUE_AR, align: 'center', maxWidth: CELL_WIDTH, baseline: 583.86, leading: LEADING },

  { id: 'practitionerEn', blocks: [45, 46], type: 'latin', fontRef: 'F1', size: 13.5, color: VALUE_COLOR,
    x: COL_VALUE_EN, align: 'center', maxWidth: CELL_WIDTH, baseline: 541.095, leading: LEADING,
    maxHeight: NAME_ROW_HEIGHT },
  { id: 'practitionerAr', blocks: [47], type: 'arabic', weight: 'regular', size: 13.5, color: VALUE_COLOR,
    x: COL_VALUE_AR, align: 'center', maxWidth: CELL_WIDTH, baseline: 540.58, leading: LEADING,
    maxHeight: NAME_ROW_HEIGHT },

  { id: 'positionEn', blocks: [50], type: 'latin', fontRef: 'F1', size: 13.5, color: VALUE_COLOR,
    x: COL_VALUE_EN, align: 'center', maxWidth: CELL_WIDTH, baseline: 497.81, leading: LEADING },
  { id: 'positionAr', blocks: [51], type: 'arabic', weight: 'regular', size: 13.5, color: VALUE_COLOR,
    x: COL_VALUE_AR, align: 'center', maxWidth: CELL_WIDTH, baseline: 497.3, leading: LEADING },

  // ── التذييل ──────────────────────────────────────────────────────────────
  { id: 'facilityAr', blocks: [61], type: 'arabic', weight: 'bold', size: 12.75, color: INHERIT,
    x: FOOTER_CENTER_AR, align: 'center', maxWidth: FOOTER_WIDTH, baseline: 329.55, leading: 20.31 },
  { id: 'facilityEn', blocks: [62], type: 'latin', fontRef: 'F2', size: 12.75, color: INHERIT,
    x: FOOTER_CENTER_EN, align: 'center', maxWidth: FOOTER_WIDTH, baseline: 309.24, leading: 17.5 },
  // سطر الترخيص: الرقم (Times عريض) ثم المسمّى العربي، والمجموع موسَّط — كما
  // في الأصل، حيث تتغيّر بداية السطر تبعاً لطول الرقم.
  { id: 'license', blocks: [63, 64], type: 'composite', size: 12.75, color: INHERIT,
    x: FOOTER_CENTER_LICENSE, align: 'center', baseline: 287.96 },

  { id: 'stampTime', blocks: [65], type: 'latin', fontRef: 'F2', size: 12.75, color: INHERIT,
    x: FOOTER_LEFT, align: 'left', maxWidth: 340, baseline: 224.59, leading: 17.5 },
  { id: 'stampDate', blocks: [66], type: 'latin', fontRef: 'F2', size: 12.75, color: INHERIT,
    x: FOOTER_LEFT, align: 'left', maxWidth: 340, baseline: 197.17, leading: 17.5 },
];

module.exports = {
  FIELDS,
  VALUE_COLOR,
  WHITE,
  INHERIT,
  FACILITY_BLOCK,
  QR,
  FOOTER_LOGO_BOX,
  FOOTER_WIDTH,
  FOOTER_CENTER_AR,
  FOOTER_CENTER_EN,
  FOOTER_CENTER_LICENSE,
};
