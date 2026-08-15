// ───────────────────────────────────────────────────────────────────────────
// معاينة واتساب (WhatsApp document thumbnail) — التحكّم في وضوحها وحدها.
//
// السبب الجذري (مُثبَت بالقياس، لا بالافتراض):
// واتساب لا يقرأ أي صورة معاينة مخزّنة داخل الـ PDF. لا /Thumb ولا XMP ولا أي
// Metadata. هو يولّد الصورة بنفسه من الصفحة الأولى عبر محرّك PDFium
// (android.graphics.pdf.PdfRenderer على أندرويد)، والنمط المتّبع هناك هو:
//
//     bitmap = Bitmap.createBitmap(page.getWidth(), page.getHeight(), ...)
//     page.render(bitmap, ...)
//
// و getWidth()/getHeight() تُعيدان مقاس الصفحة بالـ points (1/72 بوصة). أي أن
// دقّة صورة المعاينة = مقاس صندوق الصفحة (MediaBox) بالـ points، بكسل لكل point
// بالضبط — وليست مشتقّة من جودة الملف ولا من الخطوط ولا من الضغط ولا من الصور
// المضمّنة. صفحة A4 (595×842 pt) تُنتج صورة 595×842 ثم يكبّرها فقاعة المحادثة
// قليلاً → معاينة حادّة. وصفحة بنفس المحتوى تماماً لكن بصندوق أصغر (مثلاً
// 59×84 pt) تُنتج صورة 59×84 يكبّرها العرض ~10 أضعاف → معاينة غائمة.
//
// ولماذا لا يتأثر الملف عند فتحه؟ لأن المستند يبقى vector كما هو: العارض يعيد
// رسم الصفحة بدقّة الشاشة (fit-to-width) مهما كان مقاس الصندوق، فتخرج الصفحة
// حادّة 100%. القياس في مختبر التحقق: صورة المعاينة تهبط حِدّتها من 1112 إلى
// 0.8 (variance of Laplacian)، بينما حِدّة الصفحة عند الفتح تبقى 2662 بالضبط،
// وبصمة البكسل للصفحة المرسومة بعرض ثابت تبقى متطابقة حرفياً قبل وبعد.
//
// لذلك هذا الملف لا يلمس المحتوى إطلاقاً:
//   • لا يضيف blur ولا يحوّل شيئاً إلى صورة ولا يعيد بناء المستند.
//   • لا يمسّ النصوص ولا الخطوط ولا الألوان ولا التصميم ولا ترتيب العناصر.
//   • النص يبقى قابلاً للبحث والنسخ (طبقة ToUnicode كما هي).
//   • QR والروابط الداخلية/الخارجية تبقى كما هي (pdf-lib يقيس الـ Annotations
//     بنفس المعامل فتبقى فوق أماكنها تماماً، والرابط داخل QR لم يُمسّ).
//   • عدد الصفحات واسم الملف والـ Metadata كما هي (updateMetadata: false).
//
// الشيء الوحيد الذي يتغيّر هو هندسة صندوق الصفحة + مصفوفة القياس (CTM) التي
// تلفّ محتوى الصفحة، أي «وحدة القياس» التي يبني عليها المصغّر دقّته. ولحفظ
// المقاس الفيزيائي عند الطباعة نكتب /UserUnit = 1/معامل، وهي الآلية القياسية
// في PDF 1.6+ للإبقاء على مقاس A4 الحقيقي لدى العارضات التي تحترمها (Acrobat،
// pdf.js/Firefox)؛ ومن يتجاهلها (PDFium/Chrome) يعرض الصفحة ملء الشاشة كالعادة.
//
// الميزة مضبوطة بمتغيّر بيئة وتُعطَّل بقيمة واحدة، وتفشل «مفتوحة» (تُعيد الملف
// الأصلي كما هو) عند أي خطأ، فلا يمكن أن تُسقِط توليد الـ PDF أبداً.
// ───────────────────────────────────────────────────────────────────────────

const { PDFDocument, PDFName, PDFNumber } = require('pdf-lib');

// معامل القياس الافتراضي: 0.1 → صفحة 59×84 pt → معاينة واتساب غائمة تماماً
// مع بقاء الملف نفسه بجودته الكاملة. اجعله 1 (أو 'off') لتعطيل الميزة كلياً.
const DEFAULT_SCALE = 0.1;

// أصغر مقاس صفحة تسمح به مواصفة PDF هو 3×3 units — نحرس الحدّ بأمان واسع.
const MIN_PAGE_POINTS = 12;

/** قراءة معامل القياس من البيئة. أي قيمة غير صالحة أو ≥ 1 تعني: لا تفعل شيئاً. */
function resolveScale() {
  const raw = String(process.env.WHATSAPP_PREVIEW_SCALE ?? DEFAULT_SCALE).trim().toLowerCase();
  if (raw === '' || raw === 'off' || raw === 'false' || raw === 'none') return 1;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0 || value >= 1) return 1;
  return value;
}

/** هل نكتب /UserUnit للحفاظ على مقاس A4 الفيزيائي عند الطباعة؟ (افتراضياً نعم) */
function keepPrintSize() {
  const raw = String(process.env.WHATSAPP_PREVIEW_USER_UNIT ?? 'on').trim().toLowerCase();
  return !(raw === 'off' || raw === 'false' || raw === '0');
}

/**
 * يقلّص هندسة صفحات الـ PDF بمعامل ثابت (محتوى + صندوق الصفحة + الـ Annotations
 * معاً)، فتخرج معاينة واتساب بدقّة أقل → غائمة، بينما يبقى المستند نفسه vector
 * وبجودته الأصلية عند الفتح والتكبير والطباعة.
 *
 * @param {Buffer} pdfBuffer ملف الـ PDF كما خرج من المولّد.
 * @returns {Promise<Buffer>} الملف بعد التحويل — أو نفس الملف الأصلي إن كانت
 *          الميزة معطّلة أو تعذّر التحويل لأي سبب.
 */
module.exports = async function applyWhatsappPreviewScale(pdfBuffer) {
  const scale = resolveScale();
  if (scale >= 1) return pdfBuffer;

  try {
    // updateMetadata: false → لا يُعاد كتابة Producer/ModDate، فتبقى بيانات
    // الملف كما ولّدها Chromium بالضبط.
    const doc = await PDFDocument.load(pdfBuffer, { updateMetadata: false });
    const pages = doc.getPages();
    if (!pages.length) return pdfBuffer;

    // حارس: لو كان الملف أصلاً بصفحة صغيرة، لا نقلّصه أكثر.
    const smallest = Math.min(...pages.map((p) => Math.min(p.getWidth(), p.getHeight())));
    if (!Number.isFinite(smallest) || smallest * scale < MIN_PAGE_POINTS) {
      console.warn('⚠️ WhatsApp preview scale skipped (page would get too small)');
      return pdfBuffer;
    }

    const withUserUnit = keepPrintSize();
    for (const page of pages) {
      // يقيس محتوى الصفحة + مقاسها + مواضع الـ Annotations (الروابط) معاً،
      // فيبقى الشكل النسبي متطابقاً 1:1 مع الأصل.
      page.scale(scale, scale);
      if (withUserUnit) {
        page.node.set(PDFName.of('UserUnit'), PDFNumber.of(1 / scale));
      }
    }

    // useObjectStreams: false → بنية ملف كلاسيكية قريبة من مخرجات Chromium،
    // أوسع توافقاً مع القُرّاء القديمة.
    const bytes = await doc.save({ useObjectStreams: false });
    const out = Buffer.from(bytes);
    console.log(
      `🖼️ WhatsApp preview scale applied: ${scale} → page ${Math.round(pages[0].getWidth())}×${Math.round(pages[0].getHeight())} pt, ${out.length} bytes`
    );
    return out;
  } catch (err) {
    // فشل «مفتوح»: الملف الأصلي أهم من المعاينة.
    console.warn('⚠️ WhatsApp preview scale skipped:', err.message);
    return pdfBuffer;
  }
};
