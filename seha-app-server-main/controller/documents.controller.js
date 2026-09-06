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
const { toModelPart } = require('../utils/fileExtract');
const {
  sanitizeHospitalName,
  sanitizePersonName,
  sanitizeNationalId,
} = require('../utils/extractionClean');

// Field-specific cleanup applied AFTER the LLM returns. Even with a strict
// prompt, header noise (الكاشير, department, badges, "Dr." prefix) occasionally
// leaks into name fields. Sanitizing here keeps the extracted record clean
// without a repair round-trip.
const CORE_SANITIZERS = {
  hospital_name_ar: sanitizeHospitalName,
  hospital_name_en: sanitizeHospitalName,
  physician_name_ar: sanitizePersonName,
  physician_name_en: sanitizePersonName,
  name_ar: sanitizePersonName,
  name_en: sanitizePersonName,
  national_id: sanitizeNationalId,
};

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


// ───────────────────────────────────────────────────────────────────────────
// استخراج البيانات من ملف مرفوع (PDF / DOCX / صورة / مستند ممسوح).
//
// قاعدة صارمة: الملف المرفوع مصدر بيانات فقط. التصميم يأتي دائماً من القالب
// المخزَّن في النظام — لا يُسمح للنموذج بإنتاج أي تخطيط أو HTML، ولا باختراع
// قيمة غير موجودة في الملف. كل ما لا يجده يبقى فارغاً.
// ───────────────────────────────────────────────────────────────────────────

// الحقول الأساسية في سجل النظام (خارج حقول القالب الخاصة).
const CORE_FIELDS = {
  service_num: 'رمز الخدمة / رقم التقرير',
  leave_id: 'رقم الإجازة',
  national_id: 'رقم الهوية أو الإقامة',
  name_ar: 'اسم المريض بالعربية',
  name_en: 'اسم المريض بالإنجليزية',
  admission_date_en: 'تاريخ الدخول ميلادي YYYY-MM-DD',
  discharge_date_en: 'تاريخ الخروج ميلادي YYYY-MM-DD',
  issue_date: 'تاريخ إصدار التقرير ميلادي YYYY-MM-DD',
  employer_ar: 'جهة العمل بالعربية',
  employer_en: 'جهة العمل بالإنجليزية',
  physician_name_ar: 'اسم الطبيب بالعربية',
  physician_name_en: 'اسم الطبيب بالإنجليزية',
  position_ar: 'المسمى الوظيفي بالعربية',
  position_en: 'المسمى الوظيفي بالإنجليزية',
  nationality: 'الجنسية',
  hospital_name_ar: 'اسم المنشأة بالعربية',
  hospital_name_en: 'اسم المنشأة بالإنجليزية',
};

module.exports.aiExtractDocument = async (req, res) => {
  try {
    const { file } = req.body || {};
    if (!file) {
      return res.status(400).json({ success: false, message: 'يرجى إرفاق ملف' });
    }

    let modelPart;
    try {
      modelPart = toModelPart(file);
    } catch (e) {
      return res.status(e.httpStatus || 400).json({ success: false, message: e.message });
    }

    // كتالوج القوالب: مفاتيح الحقول ومسمّياتها فقط — لا شيء عن التصميم.
    // حقول الصور مستبعدة عمداً: الأختام والشعارات لا تُستخرج من الملف، بل
    // تأتي من أصول القالب أو يرفعها المستخدم.
    const catalog = Object.values(PAPER_TEMPLATES).map((t) => ({
      document_type: t.id,
      title: t.titleAr,
      fields: t.fields
        .filter((f) => f.type !== 'image')
        .map((f) => ({ key: f.key, label: f.labelAr, type: f.type || 'text' })),
    }));

    const instructions = [
      'أنت مساعد لاستخراج البيانات من المستندات الطبية السعودية.',
      'مهمتك: قراءة المستند المرفق واستخراج القيم الموجودة فيه فقط.',
      '',
      'قواعد إلزامية:',
      '1. لا تخترع أي قيمة إطلاقاً. ما لا تجده في المستند اتركه فارغاً "".',
      '2. لا تُنتج أي تصميم أو HTML أو تنسيق — القيم النصية فقط.',
      '3. انسخ القيم كما هي في المستند (بما فيها الأرقام العربية والتواريخ الهجرية).',
      '4. التواريخ الميلادية في الحقول الأساسية بصيغة YYYY-MM-DD إن أمكن، وإلا اتركها كما وردت.',
      '5. حقول نوعها checkbox تكون true فقط إذا كانت الخانة مؤشَّرة فعلاً في المستند.',
      '',
      'قواعد نظافة الحقول (المستندات الورقية عادةً تكتظّ فيها الترويسة بأشياء مجاورة — لا تخلطها):',
      '- hospital_name_ar / hospital_name_en: اسم المنشأة الطبية فقط. لا تُدرج معه أبداً: الكاشير، الاستقبال، الاستعلامات، المحاسبة، اسم موظف، رقم شارة، القسم، الجناح، الطابق، رقم هاتف/فاكس/ص.ب، الرمز البريدي، الرقم الضريبي، ولا سطر العنوان. مثال: لو الترويسة تحتوي «مستشفى الملك فهد التخصصي — الكاشير: أحمد — 011...» تكون القيمة «مستشفى الملك فهد التخصصي» فقط.',
      '- physician_name_ar / physician_name_en: الاسم فقط. أزل ألقاب «د.»، «الدكتور»، «الأستاذ الدكتور»، «Dr.»، «Prof.»؛ ولا تُلحق التخصص ولا رقم الرخصة ولا الشارة.',
      '- position_ar / position_en: التخصص فقط (مثل «طبيب عام» / "General Practitioner")، ليس اسم الطبيب ولا القسم.',
      '- name_ar / name_en: اسم المريض فقط، بدون ألقاب «المريض»، «السيد»، «Mr.» ونحوه.',
      '- national_id: أرقام فقط.',
      '- employer_ar / employer_en: اسم جهة العمل فقط، ليس العنوان ولا رقم الهاتف.',
      '',
      'حدّد أي قالب يطابق المستند من القائمة، واملأ حقوله.',
      'إن لم يطابق أي قالب، اجعل document_type = "" واملأ الحقول الأساسية فقط.',
      '',
      'أعد JSON صالحاً فقط بهذا الشكل، بلا أي نص آخر:',
      '{"document_type":"...","confidence":0.0,"core":{...},"template_data":{...},"notes":"..."}',
      '',
      'الحقول الأساسية المتاحة:',
      JSON.stringify(CORE_FIELDS, null, 0),
      '',
      'القوالب وحقولها:',
      JSON.stringify(catalog),
    ].join('\n');

    const { llmGenerate } = require('../utils/llm');
    let raw;
    try {
      const out = await llmGenerate(
        [{ type: 'text', text: instructions }, modelPart.part],
        { json: true }
      );
      raw = out.text;
      console.log(`✅ Document extract via ${out.provider} "${out.model}" (${modelPart.kind})`);
    } catch (err) {
      const status = err.httpStatus || (['NO_KEYS', 'MALFORMED_KEY'].includes(err.code) ? 400 : 502);
      console.error('❌ Document extract failed:', err.code, err.message);
      return res.status(status).json({
        success: false, code: err.code,
        message: err.message || 'تعذّر استخراج البيانات من الملف.',
      });
    }

    let parsed;
    try {
      parsed = JSON.parse(String(raw).replace(/```json/gi, '').replace(/```/g, '').trim());
    } catch {
      console.error('❌ Extract JSON parse failed. RAW:', String(raw).slice(0, 400));
      return res.status(502).json({
        success: false,
        message: 'قرأ النظام الملف لكن تعذّر تحليل النتيجة. حاول مرة أخرى.',
      });
    }

    // ── تنقية صارمة ────────────────────────────────────────────────────────
    // لا نثق بمخرج النموذج: نقبل فقط نوع مستند معروفاً، ومفاتيح حقول معلنة
    // في ذلك القالب، وقيماً بسيطة. أي شيء آخر يُطرح.
    const documentType = PAPER_TEMPLATES[parsed.document_type] ? parsed.document_type : '';
    const allowed = documentType
      ? new Set(PAPER_TEMPLATES[documentType].fields.filter((f) => f.type !== 'image').map((f) => f.key))
      : new Set();

    const core = {};
    for (const key of Object.keys(CORE_FIELDS)) {
      const v = parsed.core?.[key];
      if (typeof v !== 'string' || !v.trim()) continue;
      const cleaned = CORE_SANITIZERS[key] ? CORE_SANITIZERS[key](v) : v.trim();
      if (cleaned) core[key] = cleaned;
    }

    const templateData = {};
    for (const [k, v] of Object.entries(parsed.template_data || {})) {
      if (!allowed.has(k)) continue;
      if (typeof v === 'boolean') templateData[k] = v;
      else if (typeof v === 'number') templateData[k] = String(v);
      else if (typeof v === 'string' && v.trim()) templateData[k] = v.trim();
      // الفارغ يبقى فارغاً: لا نضيفه أصلاً.
    }

    return res.status(200).json({
      success: true,
      data: {
        document_type: documentType,
        template_title: documentType ? PAPER_TEMPLATES[documentType].titleAr : '',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : null,
        core,
        template_data: templateData,
        notes: typeof parsed.notes === 'string' ? parsed.notes.slice(0, 500) : '',
        source: modelPart.note,
        filled: Object.keys(core).length + Object.keys(templateData).length,
      },
      message: documentType
        ? `تم التعرّف على القالب: ${PAPER_TEMPLATES[documentType].titleAr}`
        : 'تم استخراج البيانات، ولم يُطابق المستند أي قالب محفوظ',
    });
  } catch (error) {
    console.error('❌ aiExtractDocument failed:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};
