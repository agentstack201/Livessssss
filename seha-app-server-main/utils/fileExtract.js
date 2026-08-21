// ───────────────────────────────────────────────────────────────────────────
// تحضير الملف المرفوع للذكاء الاصطناعي.
//
// الملف المرفوع مصدر بيانات فقط — لا مصدر تصميم. هذه الوحدة تحوّله إلى ما
// يفهمه النموذج، ولا تنتج أي تخطيط أو HTML إطلاقاً.
//
//   • DOCX : يُستخرج نصّه محلياً (فكّ ضغط + تنظيف وسوم) — بلا اعتماد جديد.
//   • PDF والصور : تُمرَّر كما هي إلى النموذج متعدّد الوسائط، فيقرأ حتى
//     المستندات الممسوحة ضوئياً التي لا تحوي طبقة نص.
//   • النص العادي : يُمرَّر كما هو.
// ───────────────────────────────────────────────────────────────────────────
const zlib = require('zlib');

const MAX_BYTES = 12 * 1024 * 1024; // 12MB

const KIND = {
  DOCX: 'docx',
  PDF: 'pdf',
  IMAGE: 'image',
  TEXT: 'text',
};

function detectKind(mimeType = '', fileName = '') {
  const mt = String(mimeType).toLowerCase();
  const nm = String(fileName).toLowerCase();
  if (mt.includes('wordprocessingml') || nm.endsWith('.docx')) return KIND.DOCX;
  if (mt === 'application/pdf' || nm.endsWith('.pdf')) return KIND.PDF;
  if (mt.startsWith('image/')) return KIND.IMAGE;
  if (mt.startsWith('text/') || nm.endsWith('.txt')) return KIND.TEXT;
  return null;
}

// ── قراءة نص DOCX بلا مكتبات ────────────────────────────────────────────────
// ملف DOCX أرشيف ZIP؛ نقرأ word/document.xml مباشرةً من الأرشيف (تخزين عادي
// أو مضغوط deflate)، ثم نحوّل نهايات الفقرات إلى أسطر ونزيل الوسوم.
function readZipEntry(buf, entryName) {
  const target = Buffer.from(entryName, 'utf8');
  let idx = -1;
  // ابحث في ترويسات الملفات المحلية عن الاسم المطلوب
  for (let i = 0; i + 30 < buf.length; i++) {
    if (buf.readUInt32LE(i) !== 0x04034b50) continue;
    const nameLen = buf.readUInt16LE(i + 26);
    const extraLen = buf.readUInt16LE(i + 28);
    const name = buf.slice(i + 30, i + 30 + nameLen);
    if (name.equals(target)) { idx = i; var _nameLen = nameLen, _extraLen = extraLen; break; }
    i += 29;
  }
  if (idx < 0) return null;
  const method = buf.readUInt16LE(idx + 8);
  let compSize = buf.readUInt32LE(idx + 18);
  const nameLen = buf.readUInt16LE(idx + 26);
  const extraLen = buf.readUInt16LE(idx + 28);
  const start = idx + 30 + nameLen + extraLen;

  // حجم صفر يعني أن الحجم في واصف البيانات؛ نأخذ حتى الترويسة التالية.
  if (!compSize) {
    let next = buf.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]), start);
    if (next < 0) next = buf.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]), start);
    compSize = (next < 0 ? buf.length : next) - start;
  }
  const raw = buf.slice(start, start + compSize);
  try {
    return method === 0 ? raw : zlib.inflateRawSync(raw);
  } catch {
    return null;
  }
}

function docxToText(buffer) {
  const xmlBuf = readZipEntry(buffer, 'word/document.xml');
  if (!xmlBuf) return '';
  let xml = xmlBuf.toString('utf8');
  xml = xml
    .replace(/<w:br[^>]*\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<w:tab[^>]*\/>/g, '\t')
    .replace(/<[^>]+>/g, '');
  return xml
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .split('\n').map((l) => l.trim()).filter(Boolean).join('\n')
    .slice(0, 40000);
}

/**
 * يحوّل ملفاً مرفوعاً إلى جزء رسالة صالح للنموذج.
 * @returns {{ kind:string, part:object, note:string }}
 */
function toModelPart({ dataBase64, mimeType, fileName }) {
  if (!dataBase64 || typeof dataBase64 !== 'string') {
    throw Object.assign(new Error('لم يصل أي ملف'), { httpStatus: 400 });
  }
  const buffer = Buffer.from(dataBase64, 'base64');
  if (!buffer.length) throw Object.assign(new Error('الملف فارغ أو تالف'), { httpStatus: 400 });
  if (buffer.length > MAX_BYTES) {
    throw Object.assign(new Error('حجم الملف يتجاوز 12 ميجابايت'), { httpStatus: 413 });
  }

  const kind = detectKind(mimeType, fileName);
  if (!kind) {
    throw Object.assign(
      new Error('نوع الملف غير مدعوم. المدعوم: PDF و DOCX والصور والنصوص.'),
      { httpStatus: 415 }
    );
  }

  if (kind === KIND.DOCX) {
    const text = docxToText(buffer);
    if (!text) throw Object.assign(new Error('تعذّرت قراءة محتوى ملف Word'), { httpStatus: 422 });
    return { kind, part: { type: 'text', text }, note: 'نص مستخرج من ملف Word' };
  }

  if (kind === KIND.TEXT) {
    return { kind, part: { type: 'text', text: buffer.toString('utf8').slice(0, 40000) }, note: 'ملف نصي' };
  }

  // PDF والصور: تُقرأ بصرياً، فتعمل حتى مع المستندات الممسوحة.
  return {
    kind,
    part: { type: 'file', mimeType: mimeType || (kind === KIND.PDF ? 'application/pdf' : 'image/png'), data: dataBase64 },
    note: kind === KIND.PDF ? 'ملف PDF يُقرأ بصرياً' : 'صورة تُقرأ بصرياً',
  };
}

module.exports = { toModelPart, docxToText, detectKind, KIND, MAX_BYTES };
