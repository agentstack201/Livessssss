// ───────────────────────────────────────────────────────────────────────────
// مولّد عام للقوالب الورقية (تقارير المستشفيات).
//
// كل قالب ورقي يصف جسمه فقط في middlewares/paper/<id>.js، وهذا الملف يتكفّل
// بكل ما هو مشترك: المتصفح المشترك، تضمين الخطوط من config/documentFonts.js،
// تضمين الصور base64، مقاس A4، ورمز الـ QR، وتطبيع طبقة ToUnicode العربية.
//
// الفصل مقصود: التصميم يعيش في ملف القالب وحده، والبنية التحتية هنا. فإضافة
// تقرير ورقي جديد = ملف جسم واحد، بلا نسخ أي شيء من هذا الملف.
// ───────────────────────────────────────────────────────────────────────────
const normalizeArabicToUnicode = require('./normalizeArabicToUnicode');
const QRCode = require('qrcode');
const { _internals } = require('./generatePdf');
const { dataUriFromPublic, resolveFooterLogo, getBrowser } = _internals;
const { fontFaceCssFor, normalizeFont, AR_FAMILY, LATIN_FAMILY } = require('../config/documentFonts');
const { getPaperTemplate } = require('../config/paperTemplates');
const { escapeHtml } = require('./documentFormat');

/**
 * يولّد PDF لقالب ورقي.
 * @param {string} templateId معرّف القالب في config/paperTemplates.js
 */
module.exports = async (templateId, data, leave_days, DateObj, country) => {
  let page;
  const tpl = getPaperTemplate(templateId);

  try {
    console.log(`🚀 Starting paper PDF generation: ${tpl.id} ...`);

    // خيار الخط: ما اختاره المستخدم، وإلا افتراضي القالب.
    const fontId = normalizeFont(data.document_font || tpl.defaultFont);
    const fontFaceCss = fontFaceCssFor(fontId);

    // رابط التحقق على نطاق موقعنا نحن — لا نطاق أي جهة أخرى.
    const frontendUrl = 'https://slenuglushuiry-seha-sa.vercel.app';
    const verificationUrl = `${frontendUrl}/inquiries/slenquiry?service_num=${encodeURIComponent(data.service_num || '')}&national_id=${encodeURIComponent(data.national_id || '')}`;

    let qrDataUri = '';
    try {
      qrDataUri = await QRCode.toDataURL(verificationUrl, { margin: 1, width: 150, errorCorrectionLevel: 'M' });
    } catch (qrErr) {
      console.warn('⚠️ QR generation failed (continuing without QR):', qrErr.message);
    }

    const html = buildHtml(tpl, fontFaceCss, data, leave_days, DateObj, country, qrDataUri, verificationUrl);

    const browser = await getBrowser();
    page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'load', timeout: 30000 });

    try {
      await page.evaluateHandle('document.fonts.ready');
    } catch (fontErr) {
      console.warn('⚠️ document.fonts.ready wait failed (continuing):', fontErr.message);
    }

    const pdfBuffer = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      format: 'A4',
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
      tagged: true,
      timeout: 30000,
    });
    console.log(`✅ Paper PDF generated (${tpl.id}):`, pdfBuffer.length, 'bytes');

    await page.close();
    page = null;

    try {
      return normalizeArabicToUnicode(pdfBuffer);
    } catch (normErr) {
      console.warn('⚠️ Arabic normalization skipped:', normErr.message);
      return pdfBuffer;
    }
  } catch (error) {
    console.error(`❌ Paper PDF Generation Error (${templateId}):`, error);
    if (page) { try { await page.close(); } catch { /* تجاهل */ } }
    throw new Error(`Failed to generate paper PDF (${templateId}): ${error.message}`);
  }
};

// بناء صفحة المستند كاملة (الهيكل + الأنماط + جسم القالب).
function buildHtml(tpl, fontFaceCss, data, leave_days, DateObj, country, qrDataUri, verificationUrl) {
  const ctx = buildContext(tpl, data, leave_days, DateObj, country, {
    qrDataUri, verificationUrl,
    facilityLogo: resolveFacilityLogo(data, tpl),
    dataUriFromPublic,
  });
  return pageShell(tpl, fontFaceCss, tpl.body(ctx));
}

/**
 * نفس الـ HTML الذي يُطبع، لكن كنص — تستهلكه معاينة الواجهة.
 * استخدام نفس الدالة يضمن أن ما يراه المستخدم هو ما يُطبع حرفاً بحرف.
 */
async function renderPaperHtml(templateId, data, leave_days, DateObj, country) {
  const tpl = getPaperTemplate(templateId);
  const fontId = normalizeFont(data.document_font || tpl.defaultFont);
  const frontendUrl = 'https://slenuglushuiry-seha-sa.vercel.app';
  const verificationUrl = `${frontendUrl}/inquiries/slenquiry?service_num=${encodeURIComponent(data.service_num || '')}&national_id=${encodeURIComponent(data.national_id || '')}`;
  let qrDataUri = '';
  try {
    qrDataUri = await QRCode.toDataURL(verificationUrl, { margin: 1, width: 150, errorCorrectionLevel: 'M' });
  } catch { /* المعاينة تعمل بلا QR */ }
  return buildHtml(tpl, fontFaceCssFor(fontId), data, leave_days, DateObj, country, qrDataUri, verificationUrl);
}

// أي أصل صورة: رابط خارجي، أو data URI، أو مسار محلي داخل public.
function resolveAsset(value) {
  if (!value || typeof value !== 'string') return '';
  if (value.startsWith('http') || value.startsWith('data:')) return value;
  return dataUriFromPublic(value.replace(/^\//, ''));
}

// شعار المنشأة: أولوية ما اختاره المستخدم، ثم شعار التذييل المحفوظ، ثم
// القيمة الافتراضية المعلنة في القالب.
function resolveFacilityLogo(data, tpl) {
  const raw = data.template_data?.facility_logo
    || data.footer_logo
    || tpl.defaults?.facility_logo;
  if (!raw) return '';
  if (raw.startsWith('http') || raw.startsWith('data:')) return raw;
  return resolveAsset(raw) || resolveFooterLogo(raw);
}

/**
 * السياق الممرَّر لجسم القالب. `f()` تقرأ حقلاً من template_data مُهرَّباً،
 * فلا يستطيع أي نص من قاعدة البيانات كسر بنية الصفحة أو حقن وسم.
 */
function buildContext(tpl, data, leave_days, DateObj, country, extra) {
  // القيم الافتراضية التي يعلنها القالب (شعارات، أختام، تواقيع، نصوص ثابتة)
  // تُدمج تحت ما أدخله المستخدم: فالمستند يخرج كاملاً كالأصل من أول مرة،
  // ويظل كل عنصر قابلاً للاستبدال أو الإفراغ من خانته في النموذج.
  const defaults = {};
  for (const fld of tpl.fields || []) {
    if (fld.default !== undefined) defaults[fld.key] = fld.default;
  }
  const td = { ...defaults, ...(tpl.defaults || {}), ...(data.template_data || {}) };
  return {
    data,
    td,
    leave_days,
    DateObj,
    country,
    ...extra,
    // قيمة حقل خاص بالقالب (مُهرَّبة). الفارغ يبقى فارغاً — لا نخترع بيانات.
    f: (key, fallback = '') => escapeHtml(td[key] != null && td[key] !== '' ? td[key] : fallback),
    // أصل صورة (شعار/ختم/توقيع): يُعاد كما هو إن كان رابطاً أو data URI،
    // ويُضمَّن base64 إن كان مساراً محلياً — صفحة الطباعة لا تُصدر أي طلب شبكة.
    asset: (key) => resolveAsset(td[key]),
    // حقل متعدّد الأسطر: يُهرَّب ثم تتحوّل أسطره إلى <br> (لحقول textarea).
    fml: (key, fallback = '') => {
      const v = td[key] != null && td[key] !== '' ? td[key] : fallback;
      return escapeHtml(v).replace(/\r?\n/g, '<br>');
    },
    // قيمة خام غير مهرَّبة (للاستخدام في الشروط فقط، لا للطباعة).
    raw: (key) => td[key],
    // خانة اختيار مرسومة بنفس شكل النموذج الورقي.
    check: (on) => (on ? '<span class="cbx on">✓</span>' : '<span class="cbx"></span>'),
    esc: escapeHtml,
  };
}

// هيكل الصفحة المشترك: مقاس A4، الخطوط المضمّنة، وقواعد الطباعة.
// أسماء العائلات ثابتة (DocArabic / DocLatin) فتغيير الخط لا يمسّ أي تخطيط.
function pageShell(tpl, fontFaceCss, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(tpl.titleEn || tpl.id)}</title>
<style>
${fontFaceCss}

@page { size: A4; margin: 0; }

* { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }

html, body { width: 210mm; height: 297mm; margin: 0; padding: 0; }
body {
  font-family: '${AR_FAMILY}', '${LATIN_FAMILY}', sans-serif;
  color: #000;
  background: #fff;
  overflow: hidden;
  page-break-inside: avoid;
}
.en { font-family: '${LATIN_FAMILY}', serif; direction: ltr; }
.ar { font-family: '${AR_FAMILY}', sans-serif; direction: rtl; }

/* خانة الاختيار: مربّع بحجم النموذج الورقي، والعلامة داخله عند التفعيل. */
.cbx {
  display: inline-block;
  width: 13px; height: 13px;
  border: 1.3px solid #000;
  vertical-align: -2px;
  text-align: center;
  line-height: 11px;
  font-size: 11px;
  font-weight: 700;
}
.cbx.on::after { content: '✓'; }
.cbx.on { font-size: 0; }
.cbx.on::after { font-size: 12px; }

/* أمان النصوص الطويلة: تلتفّ داخل مكانها بدل توسيع الصفحة. */
td, th, .val { word-break: break-word; overflow-wrap: anywhere; }

@media print { body { page-break-inside: avoid !important; } }
${tpl.css || ''}
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

module.exports.renderPaperHtml = renderPaperHtml;
module.exports._pageShell = pageShell;
module.exports._buildContext = buildContext;
