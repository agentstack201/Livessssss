// ───────────────────────────────────────────────────────────────────────────
// مولّد الـ PDF للقالب الخامس — «تقرير إجازة مرضية - محسن»
//
// لا يحوي هذا الملف تخطيطاً ولا تنسيقاً: كل شكل الورقة يأتي من وحدة القالب
// (templates/template5) — وهي نفس الوحدة التي تبني معاينة الواجهة، فما يراه
// المستخدم على الشاشة هو ما يُطبع حرفاً بحرف. ما يخصّ هذا الملف هو تضمين
// الأصول (خطوط/صور base64)، وتشغيل المتصفح المشترك، وإخراج ملف متجهي.
//
// الاستقلال: لا يُستدعى إلا حين يكون document_type = 'sick_leave_enhanced'،
// ولا يستورد أي شيء من generatePdf.js سوى الأدوات المشتركة العامة (المتصفح
// الواحد ومُضمِّن الأصول) — فلا يمسّ قالب «تقرير إجازة مرضية» ولا أي قالب آخر،
// ولا يمسّه أي تعديل فيها.
//
// طبيعة المخرَج: نموذج تصميم قابل للتحرير (mockup). لا رمز QR ولا رابط تحقّق
// ولا أي آلية توثيق — عنوان المستند نفسه يعلن ذلك في بيانات الملف.
// ───────────────────────────────────────────────────────────────────────────
const normalizeArabicToUnicode = require('./normalizeArabicToUnicode');

// أدوات القالب الأصلي المشتركة: نفس المتصفح الواحد لكل العملية، ونفس مُضمِّن
// الأصول — لا نطلق متصفحاً ثانياً لأجل قالب جديد.
const { _internals } = require('./generatePdf');
const { dataUriFromPublic, fontFaceCss, resolveFooterLogo, getBrowser } = _internals;

const { escapeHtml } = require('./documentFormat');
const { wrapName, wrapText } = require('./nameWrap');
const {
  TEMPLATE5_ID,
  TEMPLATE5_NAME_EN,
  TEMPLATE5_MOCKUP_NOTICE,
  renderTemplate5,
} = require('../templates/template5');

module.exports = async (data, leave_days, DateObj, country) => {
  let page;

  try {
    console.log('🚀 Starting template-5 (enhanced sick leave) PDF generation...');

    const assets = {
      seha: dataUriFromPublic('images/seha.jpg'),
      crest: dataUriFromPublic('images/saudia1.jpg'),
      decor: dataUriFromPublic('images/3.PNG'),
      facilityLogo: resolveFooterLogo(data.footer_logo),
      centerLogo: dataUriFromPublic('images/national-center.jpg'),
    };

    const document5 = renderTemplate5({
      data,
      leaveDays: leave_days,
      country,
      reportDate: (DateObj && DateObj.currentDate) || '',
      reportTime: (DateObj && DateObj.currentTime) || '',
      fontFaceCss: fontFaceCss(),
      assets,
      helpers: { wrapName, wrapText, escapeHtml },
    });

    const browser = await getBrowser();
    page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(TEMPLATE5_NAME_EN)} — ${escapeHtml(TEMPLATE5_MOCKUP_NOTICE)}</title>
  <meta name="x-template-id" content="${escapeHtml(TEMPLATE5_ID)}">
  <meta name="x-template-role" content="mockup">
<style>
  @page { size: A4; margin: 0; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  html, body { width: 210mm; height: 297mm; margin: 0; padding: 0; overflow: hidden; }
  body { background: #ffffff; }
${document5.css}
</style>
</head>
<body>
${document5.html}
</body>
</html>`;

    await page.setContent(htmlContent, { waitUntil: 'load', timeout: 30000 });

    // انتظار جاهزية الخطوط قبل الطباعة، وإلا رسم Chromium بخطٍّ بديل فاختلّ
    // التخطيط عمّا تظهره المعاينة.
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
      pageRanges: '1',
      tagged: true,
      timeout: 30000,
    });
    console.log('✅ Template-5 PDF buffer generated:', pdfBuffer.length, 'bytes');

    await page.close();
    page = null;

    // تطبيع طبقة ToUnicode العربية (أشكال العرض → حروف أساسية) حتى ينجح نسخ
    // النص والبحث فيه. تحويل على طبقة النص فقط — لا يُمسّ أي أمر رسم.
    let finalBuffer = pdfBuffer;
    try {
      finalBuffer = normalizeArabicToUnicode(pdfBuffer);
    } catch (normErr) {
      console.warn('⚠️ Arabic normalization skipped:', normErr.message);
      finalBuffer = pdfBuffer;
    }

    return finalBuffer;
  } catch (error) {
    console.error('❌ Template-5 PDF Generation Error:', error);
    if (page) {
      try {
        await page.close();
      } catch (closeError) {
        console.error('❌ Error closing page:', closeError.message);
      }
    }
    throw new Error(`Failed to generate template-5 PDF: ${error.message}`);
  }
};
