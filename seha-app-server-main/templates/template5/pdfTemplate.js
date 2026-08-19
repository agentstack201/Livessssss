// ───────────────────────────────────────────────────────────────────────────
// محرّك «القالب الأصلي + ربط البيانات».
//
// الفكرة: لا نرسم مستنداً جديداً ولا نقلّد التصميم. نفتح ملف القالب الأصلي
// نفسه (master.pdf)، ونستبدل *فقط* أوامر النصّ الخاصة بالحقول المتغيّرة داخل
// مجرى محتوى الصفحة، ثم نحفظ الملف بتحديثٍ تراكمي (incremental update).
//
// لماذا هذا يحفظ الشكل حرفياً:
//   • بايتات الملف الأصلية كلها تبقى كما هي — لا يُعاد كتابة أي كائن قديم.
//     الجداول والحدود والصور والشعارات وكل النصوص الثابتة هي نفسها بالضبط.
//   • النص اللاتيني يُكتب بنفس مرجع الخط في الملف (F1 = Times-Roman،
//     F2 = Times-Bold) وبنفس الحجم واللون وخط الأساس — فهو الخط ذاته لا خطٌّ
//     شبيه، والنص يبقى متجهاً (vector) قابلاً للنسخ والبحث.
//   • النص العربي يُشكَّل بمحرّك OpenType كامل (fontkit) بنفس المحرف
//     (Noto Sans Arabic) الذي يستخدمه الملف الأصلي، ويُضمَّن كمجموعة جزئية
//     (subset) — فالأشكال والعرض والتشكيل مطابقة (تحقّقنا: عرض النصوص
//     العربية في الملف الأصلي يطابق ما يحسبه المحرّك بفارق أقلّ من 0.5 نقطة).
//   • كل كتلة نصّ في الملف الأصلي محاطة بـ q…Q، فاستبدالها لا يسرّب أي حالة
//     رسم إلى ما بعدها.
//
// بنية مجرى المحتوى في القالب الأصلي (من إنتاج iText-pdfHTML): كل سطر نصّ
// كتلةٌ مستقلة على الشكل:
//     BT
//     /F1 13.5 Tf
//     <x> <y> Td
//     <r> <g> <b> rg          ← اختياري
//     (النص)Tj
//     ET
// وهذا ما نستبدله، مع الحفاظ على كل بايت خارج هذه الكتل.
// ───────────────────────────────────────────────────────────────────────────
const zlib = require('zlib');

// ── قراءة القالب ───────────────────────────────────────────────────────────

const BLOCK_RE = /BT\n[\s\S]*?\nET/g;

/**
 * يفتح ملف القالب ويستخرج مجرى محتوى الصفحة وكتل النصّ فيه.
 * لا يعدّل شيئاً — القراءة فقط.
 */
function loadTemplate(pdfBytes) {
  const raw = Buffer.from(pdfBytes);
  const ascii = raw.toString('latin1');

  // كائن الصفحة: نبحث عن /Type/Page (لا /Pages) ثم نتراجع إلى ترويسة الكائن
  // ونتقدّم إلى endobj. لا نستطيع مطابقة القاموس بتعبير نمطي بسيط لأنه يحوي
  // قواميس متداخلة (<< >> داخل << >>).
  const typeIdx = findPageTypeIndex(ascii);
  if (typeIdx < 0) throw new Error('template: page object not found');
  const objStart = ascii.lastIndexOf(' 0 obj', typeIdx);
  const numStart = ascii.lastIndexOf('\n', objStart) + 1;
  const pageNum = parseInt(ascii.slice(numStart, objStart), 10);
  const objEnd = ascii.indexOf('endobj', typeIdx);
  const pageDict = ascii.slice(numStart, objEnd);
  const pageDictStart = ascii.indexOf('<<', objStart);
  const pageDictEnd = ascii.lastIndexOf('>>', objEnd) + 2;

  const contentsMatch = pageDict.match(/\/Contents (\d+) 0 R/);
  if (!contentsMatch) throw new Error('template: /Contents reference not found');
  const contentNum = parseInt(contentsMatch[1], 10);

  const stream = readStreamObject(raw, ascii, contentNum);
  const content = (stream.filter === 'FlateDecode' ? zlib.inflateSync(stream.data) : stream.data)
    .toString('latin1');

  const blocks = [];
  let m;
  BLOCK_RE.lastIndex = 0;
  while ((m = BLOCK_RE.exec(content)) !== null) {
    blocks.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
  }

  const startxref = parseInt(ascii.slice(ascii.lastIndexOf('startxref')).split(/\s+/)[1], 10);
  const trailer = ascii.slice(ascii.lastIndexOf('trailer'));
  const pick = (key) => {
    const mm = trailer.match(new RegExp('/' + key + '\\s*(\\[[^\\]]*\\]|\\d+ 0 R|\\d+)'));
    return mm ? mm[1] : null;
  };

  return {
    raw,
    ascii,
    pageNum,
    // نصّ قاموس الصفحة كما هو في الملف — نضيف إليه مراجع الخطوط الجديدة دون
    // المساس بأي مفتاح آخر فيه.
    pageDictText: ascii.slice(pageDictStart, pageDictEnd),
    contentNum,
    content,
    blocks,
    startxref,
    trailer: { Size: parseInt(pick('Size'), 10), Root: pick('Root'), Info: pick('Info'), ID: pick('ID') },
  };
}

/** موضع /Type/Page (وليس /Type/Pages) داخل الملف. */
function findPageTypeIndex(ascii) {
  const re = /\/Type\s*\/Page(?![a-zA-Z])/g;
  const m = re.exec(ascii);
  return m ? m.index : -1;
}

/** يقرأ كائن stream خاماً (البيانات + المرشّح المستخدم). */
function readStreamObject(raw, ascii, objNum) {
  const header = new RegExp('(?:^|[^0-9])' + objNum + ' 0 obj').exec(ascii);
  if (!header) throw new Error('template: object ' + objNum + ' not found');
  const dictStart = ascii.indexOf('<<', header.index);
  const streamKw = ascii.indexOf('stream', dictStart);
  const dict = ascii.slice(dictStart, streamKw);
  const lenMatch = dict.match(/\/Length (\d+)/);
  if (!lenMatch) throw new Error('template: /Length missing on object ' + objNum);
  const length = parseInt(lenMatch[1], 10);
  let dataStart = streamKw + 'stream'.length;
  if (ascii[dataStart] === '\r') dataStart++;
  if (ascii[dataStart] === '\n') dataStart++;
  return {
    data: raw.subarray(dataStart, dataStart + length),
    filter: /\/Filter\s*\/FlateDecode/.test(dict) ? 'FlateDecode' : null,
  };
}

// ── الكتابة: تحديث تراكمي يبقي كل بايتات الأصل كما هي ─────────────────────

const pad10 = (n) => String(n).padStart(10, '0');

/**
 * يبني ملفاً جديداً = بايتات الأصل كما هي + الكائنات المستبدَلة/المضافة +
 * جدول مراجع جديد يشير إلى الأصل عبر /Prev. أي عارض يقرأ آخر جدول، فيرى
 * الكائنات الجديدة ويرث كل ما عداها من الأصل بلا أي تغيير.
 */
function writeIncremental(template, objects) {
  const chunks = [template.raw];
  let offset = template.raw.length;
  if (template.raw[offset - 1] !== 0x0a) {
    chunks.push(Buffer.from('\n', 'latin1'));
    offset += 1;
  }

  const entries = [];
  const sorted = [...objects].sort((a, b) => a.num - b.num);
  for (const obj of sorted) {
    const head = Buffer.from(`${obj.num} 0 obj\n`, 'latin1');
    const tail = Buffer.from('\nendobj\n', 'latin1');
    entries.push({ num: obj.num, offset });
    chunks.push(head, obj.body, tail);
    offset += head.length + obj.body.length + tail.length;
  }

  // جدول المراجع: أقسام متتالية بأرقام كائنات تصاعدية.
  const sections = [];
  let current = null;
  for (const e of entries) {
    if (current && e.num === current.first + current.list.length) current.list.push(e);
    else { current = { first: e.num, list: [e] }; sections.push(current); }
  }

  let xref = 'xref\n';
  for (const sec of sections) {
    xref += `${sec.first} ${sec.list.length}\n`;
    for (const e of sec.list) xref += `${pad10(e.offset)} 00000 n \n`;
  }

  const maxNum = entries[entries.length - 1].num;
  const size = Math.max(template.trailer.Size, maxNum + 1);
  xref += 'trailer\n<< /Size ' + size
    + ' /Root ' + template.trailer.Root
    + (template.trailer.Info ? ' /Info ' + template.trailer.Info : '')
    + (template.trailer.ID ? ' /ID ' + template.trailer.ID : '')
    + ' /Prev ' + template.startxref
    + ' >>\nstartxref\n' + offset + '\n%%EOF\n';

  chunks.push(Buffer.from(xref, 'latin1'));
  return Buffer.concat(chunks);
}

/** كائن stream مضغوط جاهز للكتابة. */
function streamObject(num, extraDict, payload) {
  const body = zlib.deflateSync(payload);
  const dict = `<< ${extraDict} /Length ${body.length} /Filter /FlateDecode >>\nstream\n`;
  return { num, body: Buffer.concat([Buffer.from(dict, 'latin1'), body, Buffer.from('\nendstream', 'latin1')]) };
}

module.exports = { loadTemplate, writeIncremental, streamObject, readStreamObject };
