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
