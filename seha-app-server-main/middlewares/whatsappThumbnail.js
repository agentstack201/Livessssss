// ───────────────────────────────────────────────────────────────────────────
// مولّد صورة المعاينة (jpegThumbnail) لرسائل واتساب.
//
// لماذا هذا الملف موجود أصلاً؟
// أثبتت التجارب أن واتساب لا يقرأ أي معاينة مخزّنة داخل الـ PDF (لا /Thumb ولا
// XMP)، وأن الصورة التي تظهر في المحادثة هي حقل مستقل في الرسالة نفسها اسمه
// jpegThumbnail داخل DocumentMessage. أي أن المعاينة والملف شيئان منفصلان
// تماماً على مستوى البروتوكول:
//
//     DocumentMessage {
//       url/fileSha256/fileLength …   ← بايتات الـ PDF كما هي، بلا أي تعديل
//       jpegThumbnail                 ← الصورة التي نبنيها هنا
//     }
//
// لذلك هذا الملف **يقرأ** الـ PDF ولا يكتبه أبداً: يرسم الصفحة الأولى بدقّة
// منخفضة (PDFium عبر WebAssembly)، ثم يموّه الناتج ويضغطه JPEG. الملف المرسَل
// يبقى هو نفسه بايت ببايت، فيُفتح لدى الزبون بجودته الأصلية كاملة من اللحظة
// الأولى — والتمويه لا يوجد إلا في هذه الصورة الصغيرة.
//
// كل الأدوات هنا JS/WASM خالصة (لا مكتبات نظام ولا ImageMagick ولا sharp)، فهي
// تعمل على Render/Vercel بلا أي إعداد إضافي.
// ───────────────────────────────────────────────────────────────────────────

const jpeg = require('jpeg-js');

// مقاس المصغّرة. واتساب يعرضها مكبّرة داخل الفقاعة، فكلما صغُرت زاد الغيام.
const DEFAULT_WIDTH = Number(process.env.WHATSAPP_THUMB_WIDTH || 160);
// نصف قطر التمويه بالبكسل (على المصغّرة الصغيرة، لا على المستند).
const DEFAULT_BLUR = Number(process.env.WHATSAPP_THUMB_BLUR || 3);
// جودة ضغط JPEG (1–100).
const DEFAULT_QUALITY = Number(process.env.WHATSAPP_THUMB_QUALITY || 45);

let _pdfiumPromise = null;
function getPdfium() {
  if (!_pdfiumPromise) {
    _pdfiumPromise = import('@hyzyla/pdfium').then(({ PDFiumLibrary }) => PDFiumLibrary.init());
  }
  return _pdfiumPromise;
}

/** تصغير بمرشّح صندوقي (box filter) — متوسط كل البكسلات المصدرية لكل بكسل هدف. */
function downscale(src, sw, sh, dw, dh) {
  const out = new Uint8ClampedArray(dw * dh * 4);
  const xRatio = sw / dw;
  const yRatio = sh / dh;
  for (let y = 0; y < dh; y++) {
    const y0 = Math.floor(y * yRatio);
    const y1 = Math.max(y0 + 1, Math.floor((y + 1) * yRatio));
    for (let x = 0; x < dw; x++) {
      const x0 = Math.floor(x * xRatio);
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * xRatio));
      let r = 0, g = 0, b = 0, n = 0;
      for (let yy = y0; yy < y1 && yy < sh; yy++) {
        for (let xx = x0; xx < x1 && xx < sw; xx++) {
          const i = (yy * sw + xx) * 4;
          r += src[i]; g += src[i + 1]; b += src[i + 2]; n++;
        }
      }
      const o = (y * dw + x) * 4;
      out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = 255;
    }
  }
  return out;
}

/** تمويه صندوقي مكرّر ثلاث مرات ≈ تمويه غاوسي، وهو أسرع كثيراً منه. */
function blur(data, w, h, radius) {
  if (radius < 1) return data;
  let cur = data;
  for (let pass = 0; pass < 3; pass++) {
    const tmp = new Uint8ClampedArray(cur.length);
    // أفقياً
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let r = 0, g = 0, b = 0, n = 0;
        for (let k = -radius; k <= radius; k++) {
          const xx = Math.min(w - 1, Math.max(0, x + k));
          const i = (y * w + xx) * 4;
          r += cur[i]; g += cur[i + 1]; b += cur[i + 2]; n++;
        }
        const o = (y * w + x) * 4;
        tmp[o] = r / n; tmp[o + 1] = g / n; tmp[o + 2] = b / n; tmp[o + 3] = 255;
      }
    }
    // عمودياً
    const out = new Uint8ClampedArray(cur.length);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let r = 0, g = 0, b = 0, n = 0;
        for (let k = -radius; k <= radius; k++) {
          const yy = Math.min(h - 1, Math.max(0, y + k));
          const i = (yy * w + x) * 4;
          r += tmp[i]; g += tmp[i + 1]; b += tmp[i + 2]; n++;
        }
        const o = (y * w + x) * 4;
        out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = 255;
      }
    }
    cur = out;
  }
  return cur;
}

/**
 * يبني صورة معاينة غائمة (JPEG) من الصفحة الأولى لملف PDF.
 * الملف يُقرأ فقط — لا يُعدَّل ولا يُعاد بناؤه ولا تُمسّ بايتاته.
 *
 * @param {Buffer} pdfBuffer ملف الـ PDF كما خرج من المولّد.
 * @param {{width?:number, blurRadius?:number, quality?:number}} [opts]
 * @returns {Promise<{ buffer: Buffer, width: number, height: number }>}
 */
module.exports = async function buildWhatsappThumbnail(pdfBuffer, opts = {}) {
  const width = Math.max(32, Math.round(opts.width || DEFAULT_WIDTH));
  const blurRadius = Math.max(0, Math.round(opts.blurRadius ?? DEFAULT_BLUR));
  const quality = Math.min(100, Math.max(1, Math.round(opts.quality || DEFAULT_QUALITY)));

  const lib = await getPdfium();
  const doc = await lib.loadDocument(pdfBuffer);
  try {
    const page = doc.getPage(0);
    const { originalWidth: pw, originalHeight: ph } = page.getOriginalSize();
    // نرسم بضِعف مقاس المصغّرة ثم نصغّر: يعطي تدرّجاً ناعماً بدل حوافّ مسنّنة.
    const renderScale = (width * 2) / pw;
    const res = await doc.getPage(0).render({ scale: renderScale, render: 'bitmap' });

    const height = Math.max(1, Math.round((width * ph) / pw));
    const small = downscale(res.data, res.width, res.height, width, height);
    const blurred = blur(small, width, height, blurRadius);

    const encoded = jpeg.encode({ data: Buffer.from(blurred.buffer), width, height }, quality);
    return { buffer: encoded.data, width, height };
  } finally {
    doc.destroy();
  }
};
