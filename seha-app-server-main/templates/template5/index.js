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
const QRCode = require('qrcode');

const { loadTemplate, writeIncremental, streamObject } = require('./pdfTemplate');
const { ArabicFonts } = require('./arabicText');
const { latinWidth, latinLiteral } = require('./timesMetrics');
const { decodeImage, buildImageObjects, containMatrix, imageFormat } = require('./imageEmbed');
const { FIELDS, FACILITY_BLOCK, QR, FOOTER_LOGO_BOX } = require('./fieldMap');
const { normalizeNationality, nationalityEnglish } = require('../../utils/nationality');

const TEMPLATE5_ID = 'sick_leave_enhanced';
const TEMPLATE5_NAME_AR = 'تقرير إجازة مرضية - محسن';
const TEMPLATE5_NAME_EN = 'Sick Leave Report — Enhanced Template';
const TEMPLATE5_MOCKUP_NOTICE = 'نموذج تصميم قابل للتحرير — ليس مستنداً رسمياً';

const MASTER_PATH = path.join(__dirname, 'master.pdf');
const FONTS_DIR = path.join(__dirname, '..', '..', 'public', 'fonts');

// الشعار الافتراضي في التذييل: شعار السيف والنخلة — نفس الشعار الافتراضي
// المستخدم في بقية مجموعة الملفات. يحلّ محلّ شعار الملف الأصلي دائماً، ولا
// يُستخدم إلا حين لا يختار المستخدم شعاراً من مكتبة الصور.
const DEFAULT_FOOTER_LOGO = 'images/1.png';

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

  // الجنسية تُوحَّد هنا أيضاً: سجل الدولة المرتبط قد يحمل «سعودي» من قائمة
  // الدول القديمة، فيُطبع «السعودية» على كل حال.
  const nationalityAr = normalizeNationality((country && country.country_name_ar) || record.nationality);
  const nationalityEn = nationalityEnglish(nationalityAr, country && country.country_name_en);

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
function baselines(anchor, leading, count, maxHeight, explicit) {
  // كتلة المنشأة في التذييل تحسب خطوط أساسها بنفسها (تدفّق يمنع التراكب).
  if (explicit && explicit.length) return explicit.slice(0, count);
  let step = leading;
  if (maxHeight && count > 1 && (count - 1) * leading > maxHeight - leading) {
    step = Math.min(leading, maxHeight / count);
  }
  return Array.from({ length: count }, (_, i) => anchor + ((count - 1) / 2) * step - i * step);
}

/** كتلة نصّ لاتيني (سطر أو أكثر) بنفس مرجع الخط واللون الموجودَين في الأصل. */
function emitLatin(spec, lines) {
  if (!lines.length) return '';
  const ys = baselines(spec.baseline, spec.leading, lines.length, spec.maxHeight, spec.explicitBaselines);
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
  const ys = baselines(spec.baseline, spec.leading, lines.length, spec.maxHeight, spec.explicitBaselines);
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

// ── الباركود (رمز الاستجابة السريعة) ──────────────────────────────────────

/**
 * يرسم الباركود مربّعاتٍ متجهة في الفراغ المحجوز له أعلى نصّ التحقّق.
 * لا صورة نقطية: الرمز يبقى حادّاً عند أي تكبير، ولا يزيد حجم الملف تقريباً.
 * يُرسم في نطاق q…Q مستقل فلا يمسّ حالة الرسم لأي عنصر آخر في الصفحة.
 */
function qrOperators(url) {
  const qr = QRCode.create(String(url), { errorCorrectionLevel: 'M' });
  const size = qr.modules.size;
  const bits = qr.modules.data;
  const margin = 1;                       // هامش صامت بمقدار وحدة — كما في بقية القوالب
  const unit = QR.size / (size + margin * 2);
  const left = QR.centerX - QR.size / 2;
  const bottom = QR.bottom;

  const rects = [];
  for (let row = 0; row < size; row++) {
    let run = 0;
    for (let col = 0; col <= size; col++) {
      const on = col < size && bits[row * size + col];
      if (on) { run += 1; continue; }
      if (run) {
        const x = left + (margin + col - run) * unit;
        // الصف صفر في الأعلى، ومحور الصفحة يصعد — فنقلب ترتيب الصفوف.
        const y = bottom + (margin + size - 1 - row) * unit;
        rects.push(`${num(x)} ${num(y)} ${num(run * unit)} ${num(unit)} re`);
        run = 0;
      }
    }
  }
  if (!rects.length) return '';
  return `\nq\n1 1 1 rg\n${num(left)} ${num(bottom)} ${num(QR.size)} ${num(QR.size)} re\nf\n`
    + `0 0 0 rg\n${rects.join('\n')}\nf\nQ`;
}

// ── شعار المنشأة ───────────────────────────────────────────────────────────
//
// مصدر الحقيقة الوحيد للشعار هو `record.footer_logo`. حين يكون فارغاً — ولا
// شيء غيره — يُستخدم الشعار الافتراضي. وما عدا ذلك يُرسم الشعار المختار نفسه
// أو يفشل التوليد برسالة تسمّي السبب.
//
// لماذا لا نتساهل؟ لأن هذا الملف يُبنى فوق master.pdf وفيه شعارٌ محفور أصلاً
// (شعار عيادة أسنان لا علاقة له بالمنشأة). أي «فشلٍ صامت» هنا لا يعني غياب
// الشعار، بل ظهور شعارٍ آخر تماماً في التقرير النهائي بينما تعرض الواجهة
// الشعار الذي اختاره المستخدم — وهو بالضبط ما كان يحدث. الصمت ممنوع.

/** يصف مصدر الشعار وصفاً قصيراً صالحاً لرسالة خطأ (بلا سرد base64 كامل). */
function describeSource(value) {
  if (value.startsWith('data:')) return `ملف مرفوع (${value.slice(5, value.indexOf(';')) || 'data'})`;
  return value.length > 120 ? `${value.slice(0, 117)}…` : value;
}

/**
 * مصدر الشعار (data URI أو رابط أو مسار داخل public) → بايتات الصورة.
 * يرمي استثناءً يسمّي السبب عند التعذّر — ولا يعيد بديلاً أبداً.
 */
async function loadLogoBytes(source) {
  const value = String(source || '').trim();
  if (!value) throw new Error('مصدر الشعار فارغ');

  if (value.startsWith('data:')) {
    const comma = value.indexOf(',');
    if (comma < 0) throw new Error('بيانات الشعار المرفوع غير صالحة');
    const isBase64 = /;base64/i.test(value.slice(0, comma));
    const payload = value.slice(comma + 1);
    const bytes = isBase64
      ? Buffer.from(payload, 'base64')
      : Buffer.from(decodeURIComponent(payload), 'latin1');
    if (!bytes.length) throw new Error('بيانات الشعار المرفوع فارغة');
    return bytes;
  }

  if (/^https?:\/\//i.test(value)) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(value, { signal: controller.signal });
      if (!response.ok) throw new Error(`ردّ المصدر بالحالة ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!bytes.length) throw new Error('المصدر أعاد ملفاً فارغاً');
      return bytes;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('انتهت مهلة جلب الصورة من المصدر');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  const clean = value.replace(/^\/?public\//i, '').replace(/^\//, '');
  return fs.readFileSync(path.join(__dirname, '..', '..', 'public', clean));
}

/**
 * الشعار الذي سيُرسم في التذييل: الشعار المختار في السجلّ، أو الافتراضي حين
 * لا يختار المستخدم شيئاً. يرمي استثناءً واضحاً بدل استبدال اختيار المستخدم.
 */
async function resolveFooterLogo(record) {
  const chosen = String(record.footer_logo || '').trim();
  const source = chosen || DEFAULT_FOOTER_LOGO;

  let bytes;
  try {
    bytes = await loadLogoBytes(source);
  } catch (error) {
    if (!chosen) {
      throw new Error(`تعذّر تحميل الشعار الافتراضي (${DEFAULT_FOOTER_LOGO}): ${error.message}`);
    }
    throw new Error(
      `تعذّر جلب الشعار المختار من مكتبة الوسائط: ${error.message}`
      + ` — المصدر: ${describeSource(chosen)}`,
    );
  }

  const image = decodeImage(bytes);
  if (!image) {
    const format = imageFormat(bytes);
    if (!chosen) {
      throw new Error(`تعذّر قراءة الشعار الافتراضي (${DEFAULT_FOOTER_LOGO}): صيغة ${format}`);
    }
    throw new Error(
      `صيغة الشعار المختار (${format}) غير مدعومة في التقرير المحسّن.`
      + ' اختر شعاراً بصيغة PNG أو JPG أو GIF من مكتبة الوسائط.',
    );
  }
  return image;
}

// ── كتلة المنشأة في التذييل ────────────────────────────────────────────────

/**
 * يحسب خطوط أساس أسطر كتلة المنشأة (اسم عربي، اسم إنجليزي، رقم الترخيص).
 * السطر الأول على خط أساس الملف الأصلي، وكل سطرٍ بعده يهبط بمقدار المسافة
 * الأصلية — فاسمٌ من سطر واحد يعيد إنتاج الأصل حرفياً، واسمٌ أطول ينزل بلا
 * أي تراكب. إن ضاقت المساحة تُضغط المسافات وحدها، بلا مساس بحجم الخط.
 */
function facilityBaselines(lineCounts) {
  const B = FACILITY_BLOCK;
  const steps = [];
  for (let i = 1; i < lineCounts.ar; i++) steps.push(B.arLeading);
  if (lineCounts.en) steps.push(B.arLeading);
  for (let i = 1; i < lineCounts.en; i++) steps.push(B.enLeading);
  if (lineCounts.license) steps.push(B.licenseGap);

  const total = steps.reduce((sum, step) => sum + step, 0);
  const available = B.firstBaseline - B.minBaseline;
  const squeeze = total > available && total > 0 ? available / total : 1;

  const baselines = [];
  let y = B.firstBaseline;
  baselines.push(y);
  for (const step of steps) {
    y -= step * squeeze;
    baselines.push(y);
  }
  return {
    ar: baselines.slice(0, lineCounts.ar),
    en: baselines.slice(lineCounts.ar, lineCounts.ar + lineCounts.en),
    license: baselines[lineCounts.ar + lineCounts.en],
  };
}

// ── التوليد ────────────────────────────────────────────────────────────────

/**
 * سجلّ → ملف PDF مبنيٌّ على القالب الأصلي نفسه.
 *
 * ما يتغيّر: نصوص الحقول، والباركود، ووجهة الرابط، وشعار المنشأة.
 * ما لا يتغيّر: كل شيء آخر — بايتات الملف الأصلي كما هي.
 *
 * @returns {Promise<Buffer>}
 */
async function renderTemplate5Pdf(options) {
  const opts = options || {};
  const tpl = template();
  const session = arabicFonts.session();
  const values = mapRecordToFields(opts.data, opts);
  const record = opts.data || {};

  // ── كتلة المنشأة: نلفّ أسطرها أولاً لنعرف عددها، ثم نوزّع خطوط الأساس
  //    توزيعاً متدفّقاً يمنع أي تراكب مهما طال الاسم.
  const specById = Object.fromEntries(FIELDS.map((f) => [f.id, f]));
  const facilityArLines = greedyWrap(values.facilityAr || '', specById.facilityAr.maxWidth,
    (line) => session.measure('bold', line, specById.facilityAr.size));
  const facilityEnLines = greedyWrap(values.facilityEn || '', specById.facilityEn.maxWidth,
    (line) => latinWidth(specById.facilityEn.fontRef, line, specById.facilityEn.size));
  const flow = facilityBaselines({
    ar: facilityArLines.length,
    en: facilityEnLines.length,
    license: values.license ? 1 : 0,
  });
  const explicitBaselines = {
    facilityAr: flow.ar,
    facilityEn: flow.en,
  };

  // ١) توليد النصّ الجديد لكل حقل — وتفريغ الكتل الفائضة التي كان يشغلها.
  const replacements = new Map();
  for (const base of FIELDS) {
    const spec = explicitBaselines[base.id]
      ? { ...base, explicitBaselines: explicitBaselines[base.id] }
      : (base.id === 'license' && flow.license != null ? { ...base, baseline: flow.license } : base);
    const value = values[spec.id];
    let text = '';
    if (spec.type === 'composite') {
      text = Array.isArray(value) ? emitComposite(spec, session, value) : '';
    } else if (spec.type === 'arabic') {
      const measure = (line) => session.measure(spec.weight || 'regular', line, spec.size);
      const lines = spec.id === 'facilityAr'
        ? facilityArLines
        : greedyWrap(value || '', spec.maxWidth, measure);
      text = emitArabic(spec, session, lines);
    } else {
      const measure = (line) => latinWidth(spec.fontRef, line, spec.size);
      const lines = spec.id === 'facilityEn'
        ? facilityEnLines
        : greedyWrap(value || '', spec.maxWidth, measure);
      text = emitLatin(spec, lines);
    }
    replacements.set(spec.blocks[0], text);
    for (let i = 1; i < spec.blocks.length; i++) replacements.set(spec.blocks[i], '');
  }

  // ٢) خياطة مجرى المحتوى: الكتل المستبدَلة فقط، وكل بايت آخر كما هو.
  let content = '';
  let cursor = 0;
  tpl.blocks.forEach((block, index) => {
    if (!replacements.has(index)) return;
    content += tpl.content.slice(cursor, block.start) + replacements.get(index);
    cursor = block.end;
  });
  content += tpl.content.slice(cursor);

  const objects = [];
  let nextNum = tpl.trailer.Size;
  const extraResources = [];

  // ٣) شعار المنشأة — يحلّ محلّ شعار القالب داخل مربّعه نفسه بلا تشويه:
  //    شعار المستخدم إن اختاره من مكتبة الصور، وإلا الشعار الافتراضي.
  //    يفشل مغلقاً: لا بديل صامت — إمّا الشعار المطلوب أو خطأ يسمّي السبب،
  //    فلا يظهر شعار القالب المحفور أبداً بدل اختيار المستخدم.
  const logoImage = await resolveFooterLogo(record);
  const built = buildImageObjects(logoImage, nextNum, streamObject);
  nextNum = built.nextNum;
  objects.push(...built.objects);
  extraResources.push({ kind: 'XObject', name: 'ImL', num: built.imageNum });
  const fit = containMatrix(FOOTER_LOGO_BOX, logoImage.width, logoImage.height);
  const drawnContent = content.replace(
    /112\.5 0 0 112\.5 576\.88 350\.83 cm\s*\/Im4 Do/,
    `${num(fit.width)} 0 0 ${num(fit.height)} ${num(fit.x)} ${num(fit.y)} cm\n/ImL Do`,
  );
  // حارسة: لو تغيّر master.pdf يوماً وما عاد أمر رسم شعاره مطابقاً، لَبقي
  // شعار القالب مرسوماً والشعار المختار مضافاً بلا أن يُرسم — أي «شعار آخر»
  // في التقرير النهائي. نكشف ذلك هنا بدل أن يخرج مستنداً خاطئاً.
  if (drawnContent === content) {
    throw new Error('تعذّر استبدال شعار القالب: لم يُعثر على أمر رسم الشعار في master.pdf');
  }
  content = drawnContent;

  // ٤) الباركود — مفعّل افتراضياً، ويُطفأ بـ add_qr = false كبقية القوالب.
  const verificationUrl = buildVerificationUrl(record, opts);
  if (record.add_qr !== false) content += qrOperators(verificationUrl);

  // ٥) وجهة الرابط في التذييل: رابط الاستعلام الخاص بنا، بلا تحريك مستطيله.
  if (tpl.linkActionNum) {
    objects.push({
      num: tpl.linkActionNum,
      body: Buffer.from(
        `<< /Type /Action /S /URI /IsMap false /URI ${pdfString(verificationUrl)} >>`, 'latin1'),
    });
  }

  // ٦) كائنات الخطوط العربية، ثم قاموس الصفحة بمراجعها ومرجع الشعار.
  const { objects: fontObjects, resources } = session.buildObjects(nextNum, streamObject);
  objects.push(...fontObjects);
  for (const [name, objNum] of Object.entries(resources)) {
    extraResources.push({ kind: 'Font', name, num: objNum });
  }

  let pageDict = tpl.pageDictText;
  for (const kind of ['Font', 'XObject']) {
    const refs = extraResources.filter((r) => r.kind === kind)
      .map((r) => `/${r.name} ${r.num} 0 R`).join('');
    if (refs) {
      pageDict = pageDict.replace(new RegExp(`(/${kind}\\s*<<[^>]*)>>`), `$1${refs}>>`);
    }
  }

  objects.push({ num: tpl.pageNum, body: Buffer.from(pageDict, 'latin1') });
  objects.push(streamObject(tpl.contentNum, '', Buffer.from(content, 'latin1')));

  return writeIncremental(tpl, objects);
}

/** رابط الاستعلام العام الذي يفتحه الباركود والرابط معاً. */
function buildVerificationUrl(record, opts) {
  const base = 'https://slenutglushuiry-seha-sa.vercel.app';
  return `${base}/inquiries/slenquiry`
    + `?service_num=${encodeURIComponent(record.service_num || '')}`
    + `&national_id=${encodeURIComponent(record.national_id || '')}`;
}

/** نصّ → سلسلة PDF حرفية مهرَّبة. */
function pdfString(value) {
  return `(${String(value).replace(/[\\()]/g, (ch) => `\\${ch}`)})`;
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
