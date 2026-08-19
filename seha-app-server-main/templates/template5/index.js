// ───────────────────────────────────────────────────────────────────────────
// القالب الخامس — «تقرير إجازة مرضية - محسن» (Template 5)
//
// قالبٌ مستقلٌّ تماماً، لا يشترك في سطرٍ واحد مع قالب «تقرير إجازة مرضية»
// القائم: له معرّفه الخاص (TEMPLATE5_ID)، وإعداد تخطيطه الخاص
// (TEMPLATE5_LAYOUT)، وربط بياناته الخاص (mapTemplate5Fields)، وإعداد تنسيقه
// الخاص (buildTemplate5Css)، وإعداد تصييره الخاص (buildTemplate5Body).
// تعديل أي رقم هنا لا يمسّ أي قالب آخر، وتعديل أي قالب آخر لا يمسّ هذا.
//
// ما هو هذا الملف بالضبط: نموذج تصميم قابل للتحرير (mockup/template) داخل
// التطبيق. ليس مستنداً رسمياً، ولا يولّد مستنداً «موثّقاً»: لا يوجد فيه رمز
// QR ولا رابط تحقّق ولا أي آلية تُوحي بأن المخرَج مستندٌ صادرٌ عن جهة. نصوص
// التذييل نصوصٌ افتراضية قابلة للتحرير من نموذج البيانات مثل بقية الحقول.
//
// ── من أين جاءت الأرقام ───────────────────────────────────────────────────
// أُخذت كل الإحداثيات من ملف المرجع البصري المرفوع بقياس صفحته (842×1190pt)
// ثم حُوِّلت إلى بكسلات A4 عند 96dpi (793.7×1122.5px) بمعامل 793.7/842.
// لذلك كل الأرقام أدناه بالبكسل على صفحة A4، وكلها مجموعة في كائن واحد
// (TEMPLATE5_LAYOUT) حتى يبقى التخطيط بياناتٍ قابلةً للتحرير لا HTML مبعثراً.
//
// ── لماذا التموضع المطلق ──────────────────────────────────────────────────
// الترويسة والتذييل مثبّتان بإحداثيات مطلقة داخل صفحة ثابتة المقاس. هذه هي
// الطريقة الوحيدة التي تضمن الشرط المطلوب: تغيير البيانات الديناميكية لا
// يزحزح التخطيط. اسمٌ يلتف على ثلاثة أسطر يوسّع خليّته وحدها ولا يدفع
// التذييل ولا يغيّر أي مسافة أخرى.
//
// ── قاعدة «مكوّن واحد لكل حقل» ────────────────────────────────────────────
// جدولٌ واحدٌ فقط في هذا القالب (TEMPLATE5_LAYOUT.table.rows)، وكل حقل صفٌّ
// واحد وخليّة واحدة لكل لغة. النص الطويل يلتف داخل خليّته (overflow-wrap)
// ولا يُنشأ له مكوّن ثانٍ أبداً.
//
// ⚠️ توجد نسختان متطابقتان من هذا الملف — واحدة في الواجهة
//    (seha.sa-main/src/templates/template5/index.js) وواحدة في الخادم
//    (seha-app-server-main/templates/template5/index.js) — لأن المشروعين
//    يُنشران منفصلين. أي تعديل يجب أن يُطبَّق على النسختين معاً، وإلا اختلفت
//    المعاينة عن الـ PDF المطبوع. الجسم أدناه متطابق حرفياً؛ لا يختلف إلا
//    سطر التصدير في نهاية الملف (ESM مقابل CommonJS).
// ───────────────────────────────────────────────────────────────────────────

// ── 1) هوية القالب ────────────────────────────────────────────────────────
const TEMPLATE5_ID = 'sick_leave_enhanced';
const TEMPLATE5_NAME_AR = 'تقرير إجازة مرضية - محسن';
const TEMPLATE5_NAME_EN = 'Sick Leave Report — Enhanced Template';
// تنبيه يُعرض في واجهة التطبيق (بطاقة القالب، ترويسة المعاينة، نموذج الإدخال).
const TEMPLATE5_MOCKUP_NOTICE = 'نموذج تصميم قابل للتحرير — ليس مستنداً رسمياً';

// ── 2) لوحة الألوان (إعداد التنسيق) ───────────────────────────────────────
const TEMPLATE5_PALETTE = {
  paper: '#ffffff',
  label: '#366fb5',        // نص عمودَي المسمّيات
  value: '#2c3e77',        // نص عمودَي القيم
  titleAr: '#306db5',
  titleEn: '#2c3e77',
  highlightBg: '#2c3e77',  // صف «مدة الإجازة»
  highlightText: '#ffffff',
  zebraBg: '#f7f7f7',      // الصفوف المتناوبة
  borderLabel: '#dddddd',  // حدود عمودَي المسمّيات (أفتح)
  borderValue: '#cccccc',  // حدود عمودَي القيم
  footerText: '#000000',
  footerLink: '#0000ff',
  divider: '#dddddd',
};

// ── 3) الخطوط (إعداد التنسيق) ─────────────────────────────────────────────
const TEMPLATE5_FONTS = {
  arabic: '"NotoSansArabic", "Segoe UI", sans-serif',
  latin: '"Amiri", "Times New Roman", Times, serif',
};

// ── 4) التخطيط: كل إحداثيات الصفحة بالبكسل على A4 @96dpi ─────────────────
const TEMPLATE5_LAYOUT = {
  page: { width: 793.7, height: 1122.5 },

  // الترويسة: ثلاثة شعارات + شعار الدولة وتحته سطر إنجليزي.
  header: {
    seha: { left: 5.2, top: 22.4, height: 83.6 },
    decor: { right: 33.9, top: 33.9, height: 100.8 },
    crest: { top: 58.8, width: 195 },
    crestCaption: { size: 16.26, lineHeight: 21.7, gap: -8.2 },
  },

  // عنوان المستند (عربي فوق إنجليزي).
  title: {
    top: 147.7,
    ar: { size: 21.2, lineHeight: 44.8 },
    gap: -3.3,
    en: { size: 17.6, lineHeight: 24.4 },
  },

  // الجدول — المكوّن الوحيد من نوعه في هذا القالب.
  table: {
    top: 226.9,
    left: 33.9,
    width: 725.8,
    radius: 8,
    borderWidth: 1,
    // نِسَب الأعمدة الأربعة من عرض الجدول: مسمّى إنجليزي | قيمة إنجليزية |
    // قيمة عربية | مسمّى عربي. مأخوذة من المرجع (163/238.5/238.5/130 من 770).
    columns: [21.169, 30.974, 30.974, 16.883],
    fontSize: 12.72,
    lineHeight: 1.18,
    paddingY: 5,
    paddingX: 7,
    // ارتفاع الصف الأدنى (border-box: يشمل الحشو والحدود). صفٌّ بسطر واحد
    // يساويه بالضبط؛ وصفٌّ بسطرين (اسم طويل) يتمدّد وحده إلى ~42px ولا
    // يزحزح التذييل ولا أي عنصر آخر لأن كليهما مثبّت بإحداثيات مطلقة.
    rowHeight: 39.6,
  },

  // التذييل: منطقة معلومات يسرى + فاصل رأسي واحد + منطقة معلومات يمنى.
  // كل الإزاحات الرأسية نسبةً إلى أعلى التذييل.
  footer: {
    top: 683.2,
    divider: { left: 410.0, width: 1.3, height: 200.5 },
    left: {
      width: 410,
      paddingLeft: 36,
      paddingRight: 19,
      note: { top: 119.0, size: 10.6, lineHeight: 21.9 },
      noteEn: { size: 10.6, lineHeight: 14.7, gap: -2.0 },
      link: { size: 10.6, lineHeight: 15.0, gap: 10.2 },
      stamp: { top: 214.2, size: 12.02, lineHeight: 16.7, gap: 9.1 },
    },
    right: {
      left: 411.4,
      logo: { top: 1.8, left: 120.5, width: 130, height: 106 },
      block: { top: 111.7, left: 55.5, width: 260 },
      facilityAr: { size: 12.02, lineHeight: 25.4 },
      facilityEn: { size: 12.02, lineHeight: 16.7, gap: -2.3 },
      license: { size: 12.02, lineHeight: 25.3, gap: -0.6 },
      centerLogo: { top: 192.2, right: 25.3, width: 161.1, height: 97.3 },
    },
  },
};

// ── 5) صفوف الجدول (إعداد التخطيط + ربط البيانات) ─────────────────────────
// كل عنصر = حقلٌ منطقيٌّ واحد = صفٌّ واحد = خليّة واحدة لكل لغة.
//   field   : مفتاح الحقل في نموذج البيانات المُشتق (mapTemplate5Fields)
//   merged  : القيمة تملأ عمودَي القيم معاً (خليّة واحدة بـ colspan=2)
//   variant : 'plain' | 'zebra' | 'highlight'
//   wrap    : 'name' (تجميع دلالي لأسماء الأشخاص) | 'text' | 'raw'
//   arFont  : 'latin' حين تكون قيمة العمود العربي رقمية (تاريخ هجري) — كما في
//             المرجع تماماً: الأرقام بخط لاتيني واتجاه LTR داخل عمودها.
const TEMPLATE5_ROWS = [
  { field: 'leaveId', labelEn: 'Leave ID', labelAr: 'رمز الإجازة', merged: true, variant: 'plain', wrap: 'text' },
  { field: 'leaveDuration', labelEn: 'Leave Duration', labelAr: 'مدة الإجازة', merged: false, variant: 'highlight', wrap: 'text' },
  { field: 'admissionDate', labelEn: 'Admission Date', labelAr: 'تاريخ الدخول', merged: false, variant: 'plain', wrap: 'text', arFont: 'latin' },
  { field: 'dischargeDate', labelEn: 'Discharge Date', labelAr: 'تاريخ الخروج', merged: false, variant: 'zebra', wrap: 'text', arFont: 'latin' },
  { field: 'issueDate', labelEn: 'Issue Date', labelAr: 'تاريخ إصدار التقرير', merged: true, variant: 'plain', wrap: 'text' },
  { field: 'name', labelEn: 'Name', labelAr: 'الاسم', merged: false, variant: 'zebra', wrap: 'name' },
  { field: 'nationalId', labelEn: 'National ID / Iqama', labelAr: 'رقم الهوية / الإقامة', merged: true, variant: 'plain', wrap: 'text' },
  { field: 'nationality', labelEn: 'Nationality', labelAr: 'الجنسية', merged: false, variant: 'zebra', wrap: 'text' },
  { field: 'employer', labelEn: 'Employer', labelAr: 'جهة العمل', merged: false, variant: 'plain', wrap: 'text' },
  { field: 'practitionerName', labelEn: 'Practitioner Name', labelAr: 'اسم الممارس', merged: false, variant: 'zebra', wrap: 'name' },
  { field: 'position', labelEn: 'Position', labelAr: 'المسمى الوظيفى', merged: false, variant: 'plain', wrap: 'text' },
];

// ── 6) النصوص الثابتة القابلة للتحرير ─────────────────────────────────────
// كلها قابلة للتجاوز من السجل (نموذج البيانات) — انظر mapTemplate5Fields.
const TEMPLATE5_TEXT = {
  headingAr: 'تقرير إجازة مرضية',
  headingEn: 'Sick Leave Report',
  crestCaption: 'Kingdom of Saudi Arabia',
  footerNoteAr: 'نموذج عرض تجريبي لبيانات التقرير داخل منصة القوالب',
  footerNoteEn: 'Sample template preview — not an issued document',
  footerLabel: 'template-preview / mockup',
  facilityAr: 'اسم المنشأة',
  facilityEn: 'FACILITY NAME',
  licenseLabel: 'رقم الترخيص',
};

// ── 7) أدوات مساعدة ───────────────────────────────────────────────────────
const padTwo = (value) => String(value).padStart(2, '0');

/** تاريخ ميلادي YYYY-MM-DD → DD-MM-YYYY */
function t5FormatDate(value) {
  if (!value) return '';
  const parts = String(value).split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${padTwo(day)}-${padTwo(month)}-${year}`;
  }
  return String(value);
}

/** تاريخ هجري → أرقام بخانتين مع الحفاظ على الفاصل */
function t5FormatHijri(value) {
  if (!value) return '';
  const delimiter = String(value).includes('/') ? '/' : '-';
  const parts = String(value).split(delimiter);
  if (parts.length >= 3) {
    return parts.map((part) => (isNaN(part) ? part : padTwo(part))).join(delimiter);
  }
  return String(value);
}

/**
 * مدة الإجازة بالأيام. القيمة المحفوظة أولاً (وضع «يبدأ من تاريخ الإصدار»
 * يحفظها مستقلّة)، وإلا فالفرق بين التاريخين شاملاً الطرفين.
 */
function computeTemplate5LeaveDays(data, fallback) {
  if (data && data.date_mode === 'issue_date' && data.leave_days) {
    return parseInt(data.leave_days, 10) || 0;
  }
  if (fallback !== undefined && fallback !== null && fallback !== '') {
    const parsed = parseInt(fallback, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  if (!data || !data.admission_date_en) return 0;
  const start = new Date(data.admission_date_en);
  const end = data.discharge_date_en ? new Date(data.discharge_date_en) : new Date();
  if (isNaN(start) || isNaN(end)) return 0;
  return Math.ceil(Math.abs(end - start) / 86400000) + 1;
}

// ── 8) ربط البيانات: سجلٌّ من قاعدة البيانات → حقول القالب ────────────────
// المخرَج كائنٌ واحدٌ لكل حقلٍ منطقي، بقيمة إنجليزية وأخرى عربية. لا يقرأ
// باقي القالب من `data` مباشرةً إطلاقاً — كل ما يُعرض يمرّ من هنا.
function mapTemplate5Fields(data, options) {
  const record = data || {};
  const opts = options || {};
  const days = computeTemplate5LeaveDays(record, opts.leaveDays);
  const country = opts.country || record.country || null;

  const admissionEn = t5FormatDate(record.admission_date_en);
  const dischargeEn = t5FormatDate(record.discharge_date_en);
  const admissionAr = t5FormatHijri(record.admission_date_ar);
  const dischargeAr = t5FormatHijri(record.discharge_date_ar);

  const nationalityAr = (country && country.country_name_ar) || record.nationality || '';
  const nationalityEn = (country && country.country_name_en)
    || (nationalityAr === 'سعودي' || nationalityAr === 'السعودية' ? 'Saudi Arabia' : nationalityAr);

  return {
    leaveId: { en: record.leave_id || '', ar: '' },
    leaveDuration: {
      en: `${days} ${days > 1 ? 'days' : 'day'} ( ${admissionEn} to ${dischargeEn} )`,
      // العمود العربي مقاطع: الأرقام بخط لاتيني واتجاه LTR، والكلمات عربية —
      // فتُقرأ «١ يوم (تاريخ الى تاريخ)» بترتيبها الصحيح داخل خليّة RTL واحدة.
      arParts: [
        { t: String(days), latin: true },
        { t: ` ${days > 1 ? 'أيام' : 'يوم'} (` },
        { t: admissionAr, latin: true },
        { t: ' الى ' },
        { t: dischargeAr, latin: true },
        { t: ')' },
      ],
      arDir: 'rtl',
    },
    admissionDate: { en: admissionEn, ar: admissionAr },
    dischargeDate: { en: dischargeEn, ar: dischargeAr },
    issueDate: { en: t5FormatDate(record.issue_date), ar: '' },
    name: { en: String(record.name_en || '').toUpperCase(), ar: record.name_ar || '' },
    nationalId: { en: record.national_id || '', ar: '' },
    nationality: { en: nationalityEn, ar: nationalityAr },
    employer: { en: record.employer_en || '', ar: record.employer_ar || '' },
    practitionerName: {
      en: String(record.physician_name_en || '').toUpperCase(),
      ar: record.physician_name_ar || '',
    },
    position: { en: record.position_en || '', ar: record.position_ar || '' },
  };
}

/** نصوص الترويسة والتذييل — افتراضاتٌ قابلة للتجاوز من السجل نفسه. */
function mapTemplate5Chrome(data, options) {
  const record = data || {};
  const opts = options || {};
  return {
    headingAr: record.template_heading_ar || TEMPLATE5_TEXT.headingAr,
    headingEn: record.template_heading_en || TEMPLATE5_TEXT.headingEn,
    crestCaption: record.template_crest_caption || TEMPLATE5_TEXT.crestCaption,
    noteAr: record.template_note_ar || TEMPLATE5_TEXT.footerNoteAr,
    noteEn: record.template_note_en || TEMPLATE5_TEXT.footerNoteEn,
    label: record.template_footer_label || TEMPLATE5_TEXT.footerLabel,
    facilityAr: record.hospital_name_ar || TEMPLATE5_TEXT.facilityAr,
    facilityEn: record.hospital_name_en || TEMPLATE5_TEXT.facilityEn,
    licenseLabel: TEMPLATE5_TEXT.licenseLabel,
    licenseNumber: record.show_license_number === false ? '' : (record.license_number || ''),
    stampTime: record.report_time || opts.reportTime || '',
    stampDate: record.report_date || opts.reportDate || '',
  };
}

// ── 9) إعداد التنسيق: كل الـ CSS مشتقٌّ من الكائنات أعلاه ─────────────────
function buildTemplate5Css(options) {
  const opts = options || {};
  const L = TEMPLATE5_LAYOUT;
  const C = TEMPLATE5_PALETTE;
  const F = TEMPLATE5_FONTS;
  const T = L.table;
  const FT = L.footer;
  const px = (n) => `${Math.round(n * 1000) / 1000}px`;

  return `
${opts.fontFaceCss || ''}

.t5-root {
  position: relative;
  box-sizing: border-box;
  width: ${px(L.page.width)};
  height: ${px(L.page.height)};
  margin: 0 auto;
  overflow: hidden;
  background: ${C.paper};
  color: ${C.footerText};
  direction: ltr;
  font-family: ${F.arabic};
  -webkit-font-smoothing: antialiased;
}
.t5-root * { box-sizing: border-box; }
.t5-root p { margin: 0; }
.t5-en { font-family: ${F.latin}; }
.t5-ar { font-family: ${F.arabic}; }

/* ── الترويسة ───────────────────────────────────────────────────────────── */
.t5-logo-seha  { position: absolute; left: ${px(L.header.seha.left)};  top: ${px(L.header.seha.top)};  height: ${px(L.header.seha.height)};  width: auto; }
.t5-logo-decor { position: absolute; right: ${px(L.header.decor.right)}; top: ${px(L.header.decor.top)}; height: ${px(L.header.decor.height)}; width: auto; }
.t5-crest      { position: absolute; left: 0; right: 0; top: ${px(L.header.crest.top)}; text-align: center; }
.t5-crest img  { display: block; margin: 0 auto; width: ${px(L.header.crest.width)}; height: auto; }
.t5-crest-caption {
  font-family: ${F.latin};
  font-size: ${px(L.header.crestCaption.size)};
  line-height: ${px(L.header.crestCaption.lineHeight)};
  margin-top: ${px(L.header.crestCaption.gap)};
  color: ${C.footerText};
}

/* ── العنوان ────────────────────────────────────────────────────────────── */
.t5-title { position: absolute; left: 0; right: 0; top: ${px(L.title.top)}; text-align: center; }
.t5-title-ar {
  font-family: ${F.arabic};
  font-size: ${px(L.title.ar.size)};
  line-height: ${px(L.title.ar.lineHeight)};
  font-weight: 700;
  color: ${C.titleAr};
  margin: 0 0 ${px(L.title.gap)};
}
.t5-title-en {
  font-family: ${F.latin};
  font-size: ${px(L.title.en.size)};
  line-height: ${px(L.title.en.lineHeight)};
  font-weight: 700;
  color: ${C.titleEn};
}

/* ── الجدول (المكوّن الجدولي الوحيد في القالب) ──────────────────────────── */
.t5-table {
  position: absolute;
  /* البيانات فوق الزخرفة: لو تمدّد صفٌّ باسمٍ طويل جداً حتى لامس نطاق التذييل،
     يرسم الجدول (بخلفيته المصمتة) فوقه بدل أن تتداخل الصورة مع النص. لا يزحزح
     هذا شيئاً — كلاهما مثبّت بإحداثيات مطلقة — وإنما يحدّد أيّهما يعلو. */
  z-index: 2;
  top: ${px(T.top)};
  left: ${px(T.left)};
  width: ${px(T.width)};
  border-collapse: separate;
  border-spacing: 0;
  border: ${px(T.borderWidth)} solid ${C.borderLabel};
  border-radius: ${px(T.radius)};
  overflow: hidden;
  background: ${C.paper};
  table-layout: fixed;
}
.t5-table col:nth-child(1) { width: ${T.columns[0]}%; }
.t5-table col:nth-child(2) { width: ${T.columns[1]}%; }
.t5-table col:nth-child(3) { width: ${T.columns[2]}%; }
.t5-table col:nth-child(4) { width: ${T.columns[3]}%; }
.t5-table td {
  height: ${px(T.rowHeight)};
  padding: ${px(T.paddingY)} ${px(T.paddingX)};
  font-size: ${px(T.fontSize)};
  line-height: ${T.lineHeight};
  text-align: center;
  vertical-align: middle;
  background: ${C.paper};
  border: ${px(T.borderWidth)} solid ${C.borderValue};
  /* النص الطويل يلتف داخل خليّته هو — لا خليّة إضافية ولا خروج عن الحدّ. */
  overflow-wrap: break-word;
  word-break: normal;
}
.t5-cell-label {
  color: ${C.label};
  font-weight: 700;
  border-color: ${C.borderLabel};
}
.t5-cell-value { color: ${C.value}; font-weight: 400; }
.t5-row-zebra td { background: ${C.zebraBg}; }
.t5-row-highlight td { background: ${C.highlightBg}; color: ${C.highlightText}; }
.t5-row-highlight .t5-cell-label { color: ${C.highlightText}; }
/* توزيع متوازن لأسطر الاسم داخل الخليّة نفسها (لا يغيّر ارتفاع الجدول). */
.t5-name { text-wrap: pretty; text-wrap: balance; }
/* وحدة اسم لا تنكسر (يبنيها wrapName) وكلمة أطول من أي عمود. */
.t5-root .nb { white-space: nowrap; }
.t5-root .brk { overflow-wrap: anywhere; }

/* ── التذييل: منطقة يسرى + فاصل رأسي واحد + منطقة يمنى ─────────────────── */
.t5-footer { position: absolute; z-index: 1; left: 0; right: 0; top: ${px(FT.top)}; bottom: 0; }
.t5-footer-divider {
  position: absolute;
  left: ${px(FT.divider.left)};
  top: 0;
  width: ${px(FT.divider.width)};
  height: ${px(FT.divider.height)};
  background: ${C.divider};
}
.t5-footer-left {
  position: absolute;
  left: 0;
  top: 0;
  width: ${px(FT.left.width)};
  padding-left: ${px(FT.left.paddingLeft)};
  padding-right: ${px(FT.left.paddingRight)};
  text-align: center;
}
.t5-note { position: absolute; left: ${px(FT.left.paddingLeft)}; top: ${px(FT.left.note.top)}; width: ${px(FT.left.width - FT.left.paddingLeft - FT.left.paddingRight)}; text-align: center; }
.t5-note-ar { font-family: ${F.arabic}; font-size: ${px(FT.left.note.size)}; line-height: ${px(FT.left.note.lineHeight)}; font-weight: 700; }
.t5-note-en { font-family: ${F.latin}; font-size: ${px(FT.left.noteEn.size)}; line-height: ${px(FT.left.noteEn.lineHeight)}; font-weight: 700; margin-top: ${px(FT.left.noteEn.gap)}; }
.t5-note-label { font-family: ${F.latin}; font-size: ${px(FT.left.link.size)}; line-height: ${px(FT.left.link.lineHeight)}; font-weight: 700; margin-top: ${px(FT.left.link.gap)}; color: ${C.footerLink}; text-decoration: underline; }
.t5-stamp { position: absolute; left: ${px(FT.left.paddingLeft)}; top: ${px(FT.left.stamp.top)}; text-align: left; font-family: ${F.latin}; font-size: ${px(FT.left.stamp.size)}; line-height: ${px(FT.left.stamp.lineHeight)}; font-weight: 700; }
.t5-stamp p + p { margin-top: ${px(FT.left.stamp.gap)}; }

.t5-footer-right { position: absolute; left: ${px(FT.right.left)}; right: 0; top: 0; bottom: 0; }
.t5-facility-logo {
  position: absolute;
  left: ${px(FT.right.logo.left)};
  top: ${px(FT.right.logo.top)};
  width: ${px(FT.right.logo.width)};
  height: ${px(FT.right.logo.height)};
  object-fit: contain;
  object-position: center;
}
.t5-facility {
  position: absolute;
  left: ${px(FT.right.block.left)};
  top: ${px(FT.right.block.top)};
  width: ${px(FT.right.block.width)};
  text-align: center;
}
.t5-facility-ar { font-family: ${F.arabic}; font-size: ${px(FT.right.facilityAr.size)}; line-height: ${px(FT.right.facilityAr.lineHeight)}; font-weight: 700; }
.t5-facility-en { font-family: ${F.latin}; font-size: ${px(FT.right.facilityEn.size)}; line-height: ${px(FT.right.facilityEn.lineHeight)}; font-weight: 700; margin-top: ${px(FT.right.facilityEn.gap)}; }
.t5-facility-license { font-family: ${F.arabic}; font-size: ${px(FT.right.license.size)}; line-height: ${px(FT.right.license.lineHeight)}; font-weight: 700; margin-top: ${px(FT.right.license.gap)}; direction: rtl; }
.t5-center-logo {
  position: absolute;
  right: ${px(FT.right.centerLogo.right)};
  top: ${px(FT.right.centerLogo.top)};
  width: ${px(FT.right.centerLogo.width)};
  height: ${px(FT.right.centerLogo.height)};
  object-fit: contain;
}
`;
}

// ── 10) إعداد التصيير: الحقول + التخطيط → HTML ────────────────────────────
function buildTemplate5Body(options) {
  const opts = options || {};
  const fields = opts.fields || {};
  const chrome = opts.chrome || {};
  const assets = opts.assets || {};
  const helpers = opts.helpers || {};
  const esc = helpers.escapeHtml || ((v) => String(v == null ? '' : v));
  const wrapName = helpers.wrapName || esc;
  const wrapText = helpers.wrapText || esc;

  const render = (value, mode) => {
    if (mode === 'name') return wrapName(value);
    return wrapText(value);
  };

  // قيمة عربية مركّبة من مقاطع (تاريخ هجري + كلمات) داخل خليّة واحدة.
  const renderParts = (parts) => parts
    .map((part) => (part.latin
      ? `<span class="t5-en" dir="ltr">${esc(part.t)}</span>`
      : esc(part.t)))
    .join('');

  const img = (src, cls, alt) => (src ? `<img class="${cls}" src="${esc(src)}" alt="${esc(alt)}">` : '');

  const rows = TEMPLATE5_ROWS.map((row) => {
    const value = fields[row.field] || { en: '', ar: '' };
    const rowClass = row.variant === 'zebra'
      ? ' class="t5-row-zebra"'
      : (row.variant === 'highlight' ? ' class="t5-row-highlight"' : '');
    const nameClass = row.wrap === 'name' ? ' t5-name' : '';
    const arDir = value.arDir ? ` dir="${esc(value.arDir)}"` : '';

    const arClass = row.arFont === 'latin' ? 't5-en' : 't5-ar';
    const arContent = value.arParts ? renderParts(value.arParts) : render(value.ar, row.wrap);

    const valueCells = row.merged
      ? `<td class="t5-cell-value t5-en${nameClass}" colspan="2">${render(value.en, row.wrap)}</td>`
      : `<td class="t5-cell-value t5-en${nameClass}">${render(value.en, row.wrap)}</td>`
        + `<td class="t5-cell-value ${arClass}${nameClass}"${arDir}>${arContent}</td>`;

    return `      <tr${rowClass}>`
      + `<td class="t5-cell-label t5-en">${esc(row.labelEn)}</td>`
      + valueCells
      + `<td class="t5-cell-label t5-ar">${esc(row.labelAr)}</td>`
      + `</tr>`;
  }).join('\n');

  const licenseLine = chrome.licenseNumber
    ? `<p class="t5-facility-license">${esc(chrome.licenseLabel)} : `
      + `<span class="t5-en" dir="ltr">${wrapText(chrome.licenseNumber)}</span></p>`
    : '';

  return `<div class="t5-root" data-template-id="${esc(TEMPLATE5_ID)}" data-template-role="mockup">
  <header class="t5-header">
    ${img(assets.seha, 't5-logo-seha', 'Seha')}
    <div class="t5-crest">
      ${img(assets.crest, '', 'Crest')}
      <div class="t5-crest-caption">${esc(chrome.crestCaption)}</div>
    </div>
    ${img(assets.decor, 't5-logo-decor', '')}
  </header>

  <div class="t5-title">
    <p class="t5-title-ar">${esc(chrome.headingAr)}</p>
    <p class="t5-title-en">${esc(chrome.headingEn)}</p>
  </div>

  <table class="t5-table">
    <colgroup><col><col><col><col></colgroup>
    <tbody>
${rows}
    </tbody>
  </table>

  <footer class="t5-footer">
    <div class="t5-footer-left">
      <div class="t5-note">
        <p class="t5-note-ar">${esc(chrome.noteAr)}</p>
        <p class="t5-note-en">${esc(chrome.noteEn)}</p>
        <p class="t5-note-label">${esc(chrome.label)}</p>
      </div>
      <div class="t5-stamp">
        <p>${esc(chrome.stampTime)}</p>
        <p>${esc(chrome.stampDate)}</p>
      </div>
    </div>

    <div class="t5-footer-divider"></div>

    <div class="t5-footer-right">
      ${img(assets.facilityLogo, 't5-facility-logo', '')}
      <div class="t5-facility">
        <p class="t5-facility-ar">${wrapText(chrome.facilityAr)}</p>
        <p class="t5-facility-en">${wrapText(chrome.facilityEn)}</p>
        ${licenseLine}
      </div>
      ${img(assets.centerLogo, 't5-center-logo', '')}
    </div>
  </footer>
</div>`;
}

/**
 * المدخل الوحيد للقالب: سجلٌّ + أصولٌ + أدوات → { css, html }.
 * تستدعيه المعاينة في الواجهة ومولّد الـ PDF في الخادم بنفس الوسائط تماماً،
 * فما يُعرض على الشاشة هو ما يُطبع حرفاً بحرف.
 */
function renderTemplate5(options) {
  const opts = options || {};
  const fields = mapTemplate5Fields(opts.data, opts);
  const chrome = mapTemplate5Chrome(opts.data, opts);
  return {
    fields: fields,
    chrome: chrome,
    css: buildTemplate5Css({ fontFaceCss: opts.fontFaceCss }),
    html: buildTemplate5Body({
      fields: fields,
      chrome: chrome,
      assets: opts.assets,
      helpers: opts.helpers,
    }),
  };
}

// ── التصدير (CommonJS — نسخة الخادم) ─────────────────────────────────────
module.exports = {
  TEMPLATE5_ID,
  TEMPLATE5_NAME_AR,
  TEMPLATE5_NAME_EN,
  TEMPLATE5_MOCKUP_NOTICE,
  TEMPLATE5_PALETTE,
  TEMPLATE5_FONTS,
  TEMPLATE5_LAYOUT,
  TEMPLATE5_ROWS,
  TEMPLATE5_TEXT,
  t5FormatDate,
  t5FormatHijri,
  computeTemplate5LeaveDays,
  mapTemplate5Fields,
  mapTemplate5Chrome,
  buildTemplate5Css,
  buildTemplate5Body,
  renderTemplate5,
};
