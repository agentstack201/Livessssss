// ───────────────────────────────────────────────────────────────────────────
// تشكيل النصّ العربي وتضمينه في القالب.
//
// المستند الأصلي مكتوبٌ بخط Noto Sans Arabic (نسخة Regular للقيم، وBold
// للمسمّيات والتذييل)، مضمَّناً فيه كمجموعة جزئية تحوي أشكال حروفه هو فقط.
// لذلك لا يمكن كتابة نصّ عربي جديد بمرجع الخط القديم — نُضمّن نفس المحرف
// (ملفات الخط الموجودة أصلاً في public/fonts) كمجموعة جزئية جديدة، ونشكّل
// النصّ بمحرّك OpenType كامل (fontkit) يطبّق نفس جداول GSUB/GPOS.
//
// النتيجة مطابقة للأصل: نفس الأشكال، ونفس التشكيل (وصل الحروف واللام-ألف
// ومواضع النقاط)، ونفس العرض — قِيست نصوص المستند الأصلي العربية فطابقت ما
// يحسبه المحرّك بفارق أقلّ من نصف نقطة.
//
// كل حرف يُرسم بموضعه المطلق (Td ثم Tj)، فلا يعتمد الشكل على جدول العروض
// المكتوب في الملف إطلاقاً — وهو ما يجعل النتيجة قطعية.
// ───────────────────────────────────────────────────────────────────────────
const fs = require('fs');
const fontkit = require('fontkit');

// وسمٌ من ستة أحرف كبيرة يسبق اسم الخط الجزئي — اصطلاح PDF المعتاد.
const SUBSET_TAG = { regular: 'SEHAAA', bold: 'SEHABB' };

/**
 * مجموعة خطوط عربية محمَّلة مرة واحدة لعمر العملية (فتح ملف الخط وتحليله
 * مكلفان). كل عملية توليد تفتح «جلسة» خاصة بها تجمع الأحرف المستعملة فيها.
 */
class ArabicFonts {
  constructor(paths) {
    this.paths = paths;
    this.fonts = {};
  }

  font(weight) {
    if (!this.fonts[weight]) {
      this.fonts[weight] = fontkit.create(fs.readFileSync(this.paths[weight]));
    }
    return this.fonts[weight];
  }

  session() {
    return new ArabicSession(this);
  }
}

class ArabicSession {
  constructor(owner) {
    this.owner = owner;
    this.subsets = {};   // weight → { subset, map: Map<oldGid,newGid>, widths, toUnicode }
  }

  _bucket(weight) {
    if (!this.subsets[weight]) {
      const font = this.owner.font(weight);
      this.subsets[weight] = {
        font,
        subset: font.createSubset(),
        map: new Map(),
        widths: new Map(),
        toUnicode: new Map(),
        // مرجع الخط في مجرى المحتوى يُثبَّت هنا — قبل توليد النصّ — حتى تكتب
        // كتل النصّ الاسم الصحيح ولا تنتظر بناء كائنات الخطوط.
        ref: weight === 'bold' ? 'FA' : 'FR',
      };
    }
    return this.subsets[weight];
  }

  /**
   * يشكّل نصاً ويعيد أحرفه بمواضعها بوحدات الخط (1000 وحدة لكل em).
   * الأحرف تعود بترتيبها البصري (من اليسار إلى اليمين) جاهزةً للرسم.
   */
  shape(weight, text, direction = 'rtl') {
    const bucket = this._bucket(weight);
    const str = String(text == null ? '' : text);
    if (!str) return { glyphs: [], width: 0, unitsPerEm: bucket.font.unitsPerEm };

    const run = bucket.font.layout(str, undefined, 'arab', undefined, direction);
    const glyphs = [];
    let pen = 0;
    for (let i = 0; i < run.glyphs.length; i++) {
      const glyph = run.glyphs[i];
      const pos = run.positions[i];
      let gid = bucket.map.get(glyph.id);
      if (gid === undefined) {
        gid = bucket.subset.includeGlyph(glyph);
        bucket.map.set(glyph.id, gid);
        bucket.widths.set(gid, Math.round(glyph.advanceWidth * 1000 / bucket.font.unitsPerEm));
        if (glyph.codePoints && glyph.codePoints.length) bucket.toUnicode.set(gid, glyph.codePoints);
      }
      // w = العرض المعلَن لهذا الحرف في جدول /W. حين يساوي التقدّم الفعلي بعد
      // التشكيل ولا يوجد إزاحة، يمكن ضمّ الحرف إلى الحرف السابق في أمر رسم
      // واحد — فيخرج النصّ في مقاطع كاملة بدل حرفٍ حرف، ويبقى قابلاً للنسخ.
      glyphs.push({
        gid,
        x: pen + (pos.xOffset || 0),
        y: pos.yOffset || 0,
        w: bucket.widths.get(gid) || 0,
        joinable: !pos.xOffset && !pos.yOffset
          && Math.abs((pos.xAdvance || 0) - (bucket.widths.get(gid) || 0)) < 0.001,
      });
      pen += pos.xAdvance || 0;
    }
    return { glyphs, width: pen, unitsPerEm: bucket.font.unitsPerEm };
  }

  /** عرض نصٍّ عربي بالنقاط عند حجمٍ معيّن. */
  measure(weight, text, size, direction = 'rtl') {
    const shaped = this.shape(weight, text, direction);
    return (shaped.width * size) / shaped.unitsPerEm;
  }

  /** هل استُعمل هذا الوزن في هذه الجلسة؟ */
  used(weight) {
    return !!this.subsets[weight] && this.subsets[weight].map.size > 0;
  }

  /**
   * يبني كائنات PDF لكل خطٍّ استُعمل، ابتداءً من رقم الكائن المعطى.
   * يعيد { objects, resources } حيث resources تربط مرجع الخط برقم كائنه.
   */
  buildObjects(startNum, streamObject) {
    const objects = [];
    const resources = {};
    let num = startNum;

    for (const [weight, bucket] of Object.entries(this.subsets)) {
      if (bucket.map.size === 0) continue;
      const font = bucket.font;
      const scale = 1000 / font.unitsPerEm;
      const baseName = `${SUBSET_TAG[weight]}+${font.postscriptName}`;

      const type0 = num++;
      const cidFont = num++;
      const descriptor = num++;
      const fontFile = num++;
      const toUnicode = num++;

      const gids = [...bucket.map.values()].sort((a, b) => a - b);
      const widths = gids.map((g) => `${g} [${bucket.widths.get(g) || 0}]`).join(' ');

      objects.push({
        num: type0,
        body: Buffer.from(
          `<< /Type /Font /Subtype /Type0 /BaseFont /${baseName} /Encoding /Identity-H`
          + ` /DescendantFonts [ ${cidFont} 0 R ] /ToUnicode ${toUnicode} 0 R >>`, 'latin1'),
      });

      objects.push({
        num: cidFont,
        body: Buffer.from(
          `<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${baseName}`
          + ` /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >>`
          + ` /FontDescriptor ${descriptor} 0 R /DW 1000 /W [ ${widths} ] /CIDToGIDMap /Identity >>`, 'latin1'),
      });

      const bbox = font.bbox;
      objects.push({
        num: descriptor,
        body: Buffer.from(
          `<< /Type /FontDescriptor /FontName /${baseName} /Flags 4`
          + ` /FontBBox [ ${Math.round(bbox.minX * scale)} ${Math.round(bbox.minY * scale)}`
          + ` ${Math.round(bbox.maxX * scale)} ${Math.round(bbox.maxY * scale)} ]`
          + ` /ItalicAngle 0 /Ascent ${Math.round(font.ascent * scale)}`
          + ` /Descent ${Math.round(font.descent * scale)}`
          + ` /CapHeight ${Math.round((font.capHeight || font.ascent) * scale)}`
          + ` /StemV 80 /FontFile2 ${fontFile} 0 R >>`, 'latin1'),
      });

      const subsetBytes = Buffer.from(bucket.subset.encode());
      objects.push(streamObject(fontFile, `/Length1 ${subsetBytes.length}`, subsetBytes));
      objects.push(streamObject(toUnicode, '', Buffer.from(buildToUnicodeCMap(bucket.toUnicode), 'latin1')));

      resources[bucket.ref] = type0;
    }

    return { objects, resources, nextNum: num };
  }

  /** مرجع الخط في مجرى المحتوى (FR للعادي، FA للعريض). */
  ref(weight) {
    const bucket = this.subsets[weight];
    return bucket && bucket.ref;
  }
}

/** خريطة الأحرف → يونيكود، حتى يبقى النصّ قابلاً للنسخ والبحث. */
function buildToUnicodeCMap(map) {
  const hex4 = (n) => n.toString(16).toUpperCase().padStart(4, '0');
  const entries = [...map.entries()].sort((a, b) => a[0] - b[0]);
  let body = '';
  for (let i = 0; i < entries.length; i += 100) {
    const chunk = entries.slice(i, i + 100);
    body += `${chunk.length} beginbfchar\n`;
    for (const [gid, codePoints] of chunk) {
      const target = codePoints
        .map((cp) => (cp > 0xffff
          ? hex4(0xd800 + ((cp - 0x10000) >> 10)) + hex4(0xdc00 + ((cp - 0x10000) & 0x3ff))
          : hex4(cp)))
        .join('');
      body += `<${hex4(gid)}> <${target}>\n`;
    }
    body += 'endbfchar\n';
  }
  return '/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n'
    + '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n'
    + '/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n'
    + '1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n'
    + body
    + 'endcmap\nCMapName currentdict /CMap defineresource pop\nend\nend\n';
}

module.exports = { ArabicFonts };
