// ───────────────────────────────────────────────────────────────────────────
// القالب الخامس — «تقرير إجازة مرضية - محسن»
//
// هذا القالب ليس تصميماً جديداً ولا محاكاةً بـ HTML/CSS. الملف الأصلي
// (master.pdf) هو القالب نفسه، وهذه الوحدة تربط البيانات به: تستبدل أوامر
// النصّ الخاصة بالحقول المتغيّرة فقط داخل مجرى محتوى الصفحة، وتترك كل بايت
// آخر في الملف كما هو — الجدول وحدوده وألوانه وارتفاعات صفوفه وعروض أعمدته
// والحشو والمحاذاة والصور والشعارات والمسمّيات والتذييل والخط الرأسي.
//
// • الخطوط: النصّ اللاتيني يُكتب بمرجعَي الخط نفسيهما في الملف
//   (F1 = Times-Roman، F2 = Times-Bold)، والعربي بنفس محرف الملف
//   (Noto Sans Arabic) مضمَّناً كمجموعة جزئية جديدة. لا تبديل خطوط ولا أوزان.
// • النصّ يبقى متجهاً (vector) قابلاً للنسخ والبحث — لا تنقيط ولا صور.
// • الأسماء: التفاف نهم (greedy) يملأ السطر الأول إلى آخره ثم ينتقل للثاني،
//   وهو نفس ما يظهر في الملف الأصلي؛ بلا اختصار ولا إعادة ترتيب ولا تصغير.
//
// إضافة أو نقل حقل = تعديل سطرٍ في fieldMap.js فقط.
// ───────────────────────────────────────────────────────────────────────────
const fs = require('fs');
const path = require('path');

const { loadTemplate, writeIncremental, streamObject } = require('./pdfTemplate');
const { ArabicFonts } = require('./arabicText');
const { latinWidth, latinLiteral } = require('./timesMetrics');
const { FIELDS } = require('./fieldMap');

const TEMPLATE5_ID = 'sick_leave_enhanced';
const TEMPLATE5_NAME_AR = 'تقرير إجازة مرضية - محسن';
const TEMPLATE5_NAME_EN = 'Sick Leave Report — Enhanced Template';
const TEMPLATE5_MOCKUP_NOTICE = 'نموذج تصميم قابل للتحرير — ليس مستنداً رسمياً';

const MASTER_PATH = path.join(__dirname, 'master.pdf');
const FONTS_DIR = path.join(__dirname, '..', '..', 'public', 'fonts');

// القالب يُحلَّل مرة واحدة لعمر العملية؛ التحليل قراءةٌ محضة فيصلح لإعادة
// الاستخدام عبر كل الطلبات.
let _template = null;
function template() {
  if (!_template) _template = loadTemplate(fs.readFileSync(MASTER_PATH));
  return _template;
}

const arabicFonts = new ArabicFonts({
  regular: path.join(FONTS_DIR, 'NotoSansArabic-Regular.ttf'),
  bold: path.join(FONTS_DIR, 'NotoSansArabic-Bold.ttf'),
});

// ── تنسيق القيم (نفس صياغة الملف الأصلي) ──────────────────────────────────

const padTwo = (v) => String(v).padStart(2, '0');

/** تاريخ ميلادي YYYY-MM-DD → DD-MM-YYYY */
function formatDate(value) {
  if (!value) return '';
  const parts = String(value).split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${padTwo(day)}-${padTwo(month)}-${year}`;
  }
  return String(value);
}

/** تاريخ هجري (DD-MM-YYYY كما يحفظه النظام) → أرقام بخانتين */
function formatHijri(value) {
  if (!value) return '';
  const delimiter = String(value).includes('/') ? '/' : '-';
  const parts = String(value).split(delimiter);
  if (parts.length >= 3) {
    return parts.map((p) => (isNaN(p) ? p : padTwo(p))).join(delimiter);
  }
  return String(value);
}

function computeLeaveDays(data, fallback) {
  if (data && data.date_mode === 'issue_date' && data.leave_days) {
    return parseInt(data.leave_days, 10) || 0;
  }
  const parsed = parseInt(fallback, 10);
  if (!isNaN(parsed) && parsed > 0) return parsed;
  if (!data || !data.admission_date_en) return 0;
  const start = new Date(data.admission_date_en);
  const end = data.discharge_date_en ? new Date(data.discharge_date_en) : new Date();
  if (isNaN(start) || isNaN(end)) return 0;
  return Math.ceil(Math.abs(end - start) / 86400000) + 1;
}

/**
 * نموذج البيانات: سجلّ من قاعدة البيانات → قيمة كل حقل في القالب.
 * لا يقرأ باقي الوحدة من السجلّ مباشرةً — كل ما يُطبع يمرّ من هنا.
 */
function mapRecordToFields(data, options) {
  const record = data || {};
  const opts = options || {};
  const days = computeLeaveDays(record, opts.leaveDays);
  const country = opts.country || record.country || null;

  const admissionEn = formatDate(record.admission_date_en);
  const dischargeEn = formatDate(record.discharge_date_en);
  const admissionAr = formatHijri(record.admission_date_ar);
  const dischargeAr = formatHijri(record.discharge_date_ar);

  const nationalityAr = (country && country.country_name_ar) || record.nationality || '';
  const nationalityEn = (country && country.country_name_en)
    || (nationalityAr === 'سعودي' || nationalityAr === 'السعودية' ? 'Saudi Arabia' : nationalityAr);

  const licenseNumber = record.show_license_number === false ? '' : (record.license_number || '');

  return {
    leaveId: record.leave_id || '',
    durationEn: `${days} ${days > 1 ? 'days' : 'day'} ( ${admissionEn} to ${dischargeEn} )`,
    // مقاطع مرتّبة بصرياً من اليسار إلى اليمين — نفس تركيب الملف الأصلي.
    durationAr: [
      { kind: 'latin', fontRef: 'F1', text: `(${admissionAr} ` },
      { kind: 'arabic', weight: 'regular', text: 'الى' },
      { kind: 'latin', fontRef: 'F1', text: ` ${dischargeAr})` },
      { kind: 'arabic', weight: 'regular', text: ' ' },
      { kind: 'arabic', weight: 'regular', text: days > 1 ? 'أيام' : 'يوم' },
      { kind: 'latin', fontRef: 'F1', text: ` ${days}` },
    ],
    admissionEn,
    admissionAr,
    dischargeEn,
    dischargeAr,
    issueDate: formatDate(record.issue_date),
    nameEn: String(record.name_en || '').toUpperCase(),
    nameAr: record.name_ar || '',
    nationalId: record.national_id || '',
    nationalityEn,
    nationalityAr,
    employerEn: record.employer_en || '',
    employerAr: record.employer_ar || '',
    practitionerEn: String(record.physician_name_en || '').toUpperCase(),
    practitionerAr: record.physician_name_ar || '',
    positionEn: record.position_en || '',
    positionAr: record.position_ar || '',
    facilityAr: record.hospital_name_ar || '',
    facilityEn: record.hospital_name_en || '',
    license: licenseNumber
      ? [
        { kind: 'latin', fontRef: 'F2', text: `${licenseNumber}   ` },
        { kind: 'arabic', weight: 'bold', text: ': ', direction: 'ltr' },
        { kind: 'arabic', weight: 'bold', text: 'رقم الترخيص' },
      ]
      : null,
    stampTime: record.report_time || opts.reportTime || '',
    stampDate: record.report_date || opts.reportDate || '',
  };
}

// ── توليد أوامر النصّ ──────────────────────────────────────────────────────

// أرقام مجرى المحتوى: بلا أصفار زائدة، بدقّة كافية لتطابق مواضع الأصل.
const num = (v) => String(Math.round(v * 1000) / 1000);

/**
 * التفاف نهم على حدود الكلمات: يملأ السطر إلى آخر ما يتّسع ثم ينتقل.
 * هذا بالضبط ما يظهر في الملف الأصلي («ASMAHAN HAMOUD MOHAMMED» ثم
 * «ALGHAMDI») — لا موازنة بين الأسطر ولا إعادة ترتيب للكلمات، والكلمة التي
 * تفوق عرض الخانة تبقى كما هي بلا كسر ولا تصغير.
 */
function greedyWrap(text, maxWidth, measure) {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines = [];
  let line = words[0];
  for (let i = 1; i < words.length; i++) {
    const candidate = `${line} ${words[i]}`;
    if (measure(candidate) <= maxWidth) line = candidate;
    else { lines.push(line); line = words[i]; }
  }
  lines.push(line);
  return lines;
}

/**
 * خطوط الأساس لعدد أسطر، موسَّطة رأسياً على خط أساس الأصل.
 * سطرٌ واحد يقع على خط الأصل نفسه، وسطران على خطَّي الأصل نفسيهما بالضبط.
 * إن تجاوز عدد الأسطر ما يتّسع له الصفّ (حدوده رسمٌ ثابت في الملف)، تُضيَّق
 * المسافة بين الأسطر وحدها — بلا أي مساس بحجم الخط أو وزنه أو نصّه.
 */
function baselines(anchor, leading, count, maxHeight) {
  let step = leading;
  if (maxHeight && count > 1 && (count - 1) * leading > maxHeight - leading) {
    step = Math.min(leading, maxHeight / count);
  }
  return Array.from({ length: count }, (_, i) => anchor + ((count - 1) / 2) * step - i * step);
}

/** كتلة نصّ لاتيني (سطر أو أكثر) بنفس مرجع الخط واللون الموجودَين في الأصل. */
function emitLatin(spec, lines) {
  if (!lines.length) return '';
  const ys = baselines(spec.baseline, spec.leading, lines.length, spec.maxHeight);
  const out = ['BT', `/${spec.fontRef} ${num(spec.size)} Tf`];
  let prevX = 0;
  let prevY = 0;
  lines.forEach((line, i) => {
    const width = latinWidth(spec.fontRef, line, spec.size);
    const x = spec.align === 'center' ? spec.x - width / 2 : spec.x;
    const y = ys[i];
    out.push(`${num(x - prevX)} ${num(y - prevY)} Td`);
    if (i === 0 && spec.color) out.push(`${spec.color} rg`);
    out.push(`${latinLiteral(spec.fontRef, line)}Tj`);
    prevX = x;
    prevY = y;
  });
  out.push('ET');
  return out.join('\n');
}

const hex4 = (n) => n.toString(16).toUpperCase().padStart(4, '0');

/**
 * ضمّ الأحرف المتتالية التي يضعها التشكيل بالتتابع الطبيعي (بلا إزاحة، وبتقدّم
 * يساوي عرضها المعلَن) في أمر رسم واحد. الأحرف ذات الإزاحة — النقاط والهمزات
 * التي يضعها GPOS — تبقى بأمرها المستقل بموضعها المضبوط.
 * النتيجة: نفس الشكل تماماً، ونصٌّ يُستخرج بمقاطع كاملة لا حرفاً حرفاً.
 */
function groupGlyphs(glyphs) {
  const runs = [];
  let run = null;
  let expected = 0;
  for (const glyph of glyphs) {
    const continues = run && glyph.joinable && glyph.y === run.y
      && Math.abs(glyph.x - expected) < 0.001;
    if (continues) {
      run.gids.push(glyph.gid);
    } else {
      run = { x: glyph.x, y: glyph.y, gids: [glyph.gid] };
      runs.push(run);
    }
    expected = glyph.x + glyph.w;
  }
  return runs;
}

/** كتلة نصّ عربي مشكَّل: كل مقطع بموضعه المطلق، فالشكل قطعيٌّ لا يعتمد على العروض. */
function emitArabic(spec, session, lines) {
  if (!lines.length) return '';
  const weight = spec.weight || 'regular';
  const shapedLines = lines.map((line) => session.shape(weight, line, spec.direction || 'rtl'));
  const ref = session.ref(weight);
  const ys = baselines(spec.baseline, spec.leading, lines.length, spec.maxHeight);
  const out = ['BT', `/${ref} ${num(spec.size)} Tf`];
  let prevX = 0;
  let prevY = 0;
  let colorDone = false;

  shapedLines.forEach((shaped, li) => {
    const scale = spec.size / shaped.unitsPerEm;
    const width = shaped.width * scale;
    const originX = spec.align === 'center' ? spec.x - width / 2 : spec.x;
    const originY = ys[li];
    // /ReversedChars: نفس وسم الأصل — يخبر قارئ المستند أن الأحرف مرتّبة
    // بصرياً (لا منطقياً) فيستخرج النصّ العربي بترتيبه الصحيح.
    out.push('/ReversedChars BMC');
    for (const run of groupGlyphs(shaped.glyphs)) {
      const x = originX + run.x * scale;
      const y = originY + run.y * scale;
      out.push(`${num(x - prevX)} ${num(y - prevY)} Td`);
      if (!colorDone && spec.color) { out.push(`${spec.color} rg`); colorDone = true; }
      out.push(`<${run.gids.map(hex4).join('')}>Tj`);
      prevX = x;
      prevY = y;
    }
    out.push('EMC');
  });

  out.push('ET');
  return out.join('\n');
}

/**
 * سطرٌ مركّب من مقاطع بخطوط مختلفة (مدة الإجازة بالعربية، وسطر الترخيص):
 * تُقاس المقاطع كلها ثم تُرصف من اليسار إلى اليمين، والمجموع موسَّط على مركز
 * الخانة — تماماً كما رُكِّبت في الملف الأصلي.
 */
function emitComposite(spec, session, segments) {
  const measured = segments.map((seg) => {
    if (seg.kind === 'latin') {
      return { seg, width: latinWidth(seg.fontRef, seg.text, spec.size) };
    }
    const shaped = session.shape(seg.weight || 'regular', seg.text, seg.direction || 'rtl');
    return { seg, shaped, width: (shaped.width * spec.size) / shaped.unitsPerEm };
  });

  const total = measured.reduce((sum, m) => sum + m.width, 0);
  if (!total) return '';
  let cursor = spec.align === 'center' ? spec.x - total / 2 : spec.x;

  const parts = [];
  for (const m of measured) {
    if (m.seg.kind === 'latin') {
      parts.push(emitLatin(
        { ...spec, fontRef: m.seg.fontRef, align: 'left', x: cursor, leading: 0 },
        [m.seg.text],
      ));
    } else {
      parts.push(emitArabic(
        { ...spec, weight: m.seg.weight || 'regular', direction: m.seg.direction, align: 'left', x: cursor, leading: 0 },
        session,
        [m.seg.text],
      ));
    }
    cursor += m.width;
  }
  return parts.filter(Boolean).join('\n');
}

// ── التوليد ────────────────────────────────────────────────────────────────

/**
 * سجلّ → ملف PDF مبنيٌّ على القالب الأصلي نفسه.
 * @returns {Buffer}
 */
function renderTemplate5Pdf(options) {
  const opts = options || {};
  const tpl = template();
  const session = arabicFonts.session();
  const values = mapRecordToFields(opts.data, opts);

  // 1) توليد النصّ الجديد لكل حقل — وتفريغ الكتل الفائضة التي كان يشغلها.
  const replacements = new Map();
  for (const spec of FIELDS) {
    const value = values[spec.id];
    let text = '';
    if (spec.type === 'composite') {
      text = Array.isArray(value) ? emitComposite(spec, session, value) : '';
    } else if (spec.type === 'arabic') {
      const measure = (s) => session.measure(spec.weight || 'regular', s, spec.size);
      text = emitArabic(spec, session, greedyWrap(value || '', spec.maxWidth, measure));
    } else {
      const measure = (s) => latinWidth(spec.fontRef, s, spec.size);
      text = emitLatin(spec, greedyWrap(value || '', spec.maxWidth, measure));
    }
    replacements.set(spec.blocks[0], text);
    for (let i = 1; i < spec.blocks.length; i++) replacements.set(spec.blocks[i], '');
  }

  // 2) خياطة مجرى المحتوى: الكتل المستبدَلة فقط، وكل بايت آخر كما هو.
  let content = '';
  let cursor = 0;
  tpl.blocks.forEach((block, index) => {
    if (!replacements.has(index)) return;
    content += tpl.content.slice(cursor, block.start) + replacements.get(index);
    cursor = block.end;
  });
  content += tpl.content.slice(cursor);

  // 3) كائنات الخطوط العربية الجديدة، ثم قاموس الصفحة بمراجعها مضافةً إليه.
  const { objects: fontObjects, resources } = session.buildObjects(tpl.trailer.Size, streamObject);

  const fontRefs = Object.entries(resources).map(([ref, objNum]) => `/${ref} ${objNum} 0 R`).join('');
  const pageDict = fontRefs
    ? tpl.pageDictText.replace(/(\/Font\s*<<[\s\S]*?)>>/, `$1${fontRefs}>>`)
    : tpl.pageDictText;

  const objects = [
    { num: tpl.pageNum, body: Buffer.from(pageDict, 'latin1') },
    streamObject(tpl.contentNum, '', Buffer.from(content, 'latin1')),
    ...fontObjects,
  ];

  return writeIncremental(tpl, objects);
}

module.exports = {
  TEMPLATE5_ID,
  TEMPLATE5_NAME_AR,
  TEMPLATE5_NAME_EN,
  TEMPLATE5_MOCKUP_NOTICE,
  MASTER_PATH,
  renderTemplate5Pdf,
  mapRecordToFields,
  formatDate,
  formatHijri,
  computeLeaveDays,
};
