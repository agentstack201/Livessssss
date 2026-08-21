// ───────────────────────────────────────────────────────────────────────────
// نقاط الخدمة الخاصة بالقوالب الورقية.
//
// • قائمة القوالب وحقولها: مصدر واحد للحقيقة تقرأه الواجهة، فلا تُكتب أسماء
//   الحقول مرتين ولا تنحرف عن الخادم عند إضافة قالب.
// • معاينة HTML: نفس الدالة التي يستعملها مولّد الـ PDF بالضبط، فما يظهر في
//   المعاينة هو ما يُطبع حرفاً بحرف — لا نسخة ثانية من التصميم.
// ───────────────────────────────────────────────────────────────────────────
const { PAPER_TEMPLATES } = require('../config/paperTemplates');
const { DOCUMENT_TYPES, normalizeDocumentType, paperTemplateFor } = require('../config/documentTypes');
const { FONT_OPTIONS, DEFAULT_FONT } = require('../config/documentFonts');
const { renderPaperHtml } = require('../middlewares/generatePaperPdf');
const config = require('../config/middlewares');

// وصف القوالب الورقية + خيارات الخطوط.
module.exports.listTemplates = async (req, res) => {
  try {
    const templates = Object.values(PAPER_TEMPLATES).map((t) => ({
      id: t.id,
      titleAr: t.titleAr,
      titleEn: t.titleEn,
      defaultFont: t.defaultFont,
      defaults: t.defaults || {},
      // الحقول بلا دوال — قابلة للتسلسل إلى JSON كما هي.
      fields: t.fields.map((f) => ({ ...f })),
    }));

    const fonts = Object.values(FONT_OPTIONS).map((f) => ({
      id: f.id, label_ar: f.label_ar, label_en: f.label_en,
    }));

    // أي أنواع المستندات ورقية، ليعرف النموذج متى يعرض الحقول الديناميكية.
    const documentTypes = Object.values(DOCUMENT_TYPES).map((d) => ({
      key: d.key, label_ar: d.label_ar, label_en: d.label_en,
      paperTemplate: d.paperTemplate || null,
    }));

    return res.status(200).json({
      success: true,
      data: { templates, fonts, documentTypes, defaultFont: DEFAULT_FONT },
    });
  } catch (error) {
    console.error('❌ listTemplates failed:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// HTML المستند كما سيُطبع تماماً — للمعاينة الحيّة قبل الحفظ.
module.exports.previewHtml = async (req, res) => {
  try {
    const body = req.body || {};
    const documentType = normalizeDocumentType(body.document_type);
    const templateId = paperTemplateFor(documentType);
    if (!templateId) {
      return res.status(400).json({
        success: false,
        message: 'نوع المستند المطلوب ليس قالباً ورقياً',
      });
    }

    const leaveDays = Number(body.leave_days) > 0
      ? Number(body.leave_days)
      : safeCalcDays(body.admission_date_en, body.discharge_date_en);

    const html = await renderPaperHtml(
      templateId,
      { ...body, document_type: documentType },
      leaveDays,
      { currentTime: body.report_time || '', currentDate: body.report_date || '' },
      body.country || null
    );

    // نصّ HTML خام: تعرضه الواجهة داخل إطار المعاينة.
    res.set('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  } catch (error) {
    console.error('❌ previewHtml failed:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// calcDays يرمي على تاريخ غير صالح — والمعاينة يجب ألا تفشل لذلك.
function safeCalcDays(from, to) {
  try {
    return config.calcDays(from, to) || 0;
  } catch {
    return 0;
  }
}
