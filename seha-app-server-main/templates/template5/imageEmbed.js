// ───────────────────────────────────────────────────────────────────────────
// تضمين صورة (شعار المنشأة) داخل القالب ككائن XObject.
//
// الشعار وحده هو ما يتغيّر — موضعه وحجمه في الصفحة يبقيان كما هما في الملف
// الأصلي بالضبط. الصورة تُركَّب داخل نفس المربّع الأصلي بنسبة أبعادها (contain)
// فلا تتشوّه ولا تتجاوز إطارها.
//
// المدعوم: JPEG (يُمرَّر كما هو بمرشّح DCTDecode بلا إعادة ترميز، فلا تفقد
// جودة) و PNG بعمق 8 بت (يُفكّ ضغطه وتُزال مرشّحاته، وتُفصل قناة الشفافية
// إلى SMask فتبقى الخلفية شفافة كما في الأصل).
// ───────────────────────────────────────────────────────────────────────────
const zlib = require('zlib');

/** أبعاد صورة JPEG وعدد قنواتها من ترويسة SOF. */
function readJpeg(buf) {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) { i += 1; continue; }
    const marker = buf[i + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    const length = buf.readUInt16BE(i + 2);
    // SOF0..SOF3 و SOF5..SOF7 و SOF9..SOF11 و SOF13..SOF15 تحمل الأبعاد.
    if ((marker >= 0xc0 && marker <= 0xcf) && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return {
        kind: 'jpeg',
        height: buf.readUInt16BE(i + 5),
        width: buf.readUInt16BE(i + 7),
        components: buf[i + 9],
        data: buf,
      };
    }
    i += 2 + length;
  }
  return null;
}

/** بيانات PNG خاماً: RGB (أو رمادي) مع قناة شفافية منفصلة إن وُجدت. */
function readPng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) return null;
  let width = 0; let height = 0; let bitDepth = 0; let colorType = 0;
  const idat = [];
  let i = 8;
  while (i < buf.length) {
    const length = buf.readUInt32BE(i);
    const type = buf.toString('latin1', i + 4, i + 8);
    const body = buf.subarray(i + 8, i + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      bitDepth = body[8];
      colorType = body[9];
      if (body[12] !== 0) return null;          // الصور المتشابكة غير مدعومة
    } else if (type === 'IDAT') {
      idat.push(body);
    } else if (type === 'IEND') {
      break;
    }
    i += 12 + length;
  }
  if (bitDepth !== 8) return null;
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  if (!channels) return null;                    // اللوحات اللونية غير مدعومة

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = channels;
  const stride = width * bpp;
  const out = Buffer.alloc(height * stride);
  let prev = Buffer.alloc(stride);
  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++];
    const line = Buffer.from(raw.subarray(pos, pos + stride));
    pos += stride;
    unfilter(filter, line, prev, bpp);
    line.copy(out, y * stride);
    prev = line;
  }

  const colorChannels = colorType === 6 ? 3 : (colorType === 4 ? 1 : channels);
  const hasAlpha = colorType === 6 || colorType === 4;
  let color = out;
  let alpha = null;
  if (hasAlpha) {
    color = Buffer.alloc(width * height * colorChannels);
    alpha = Buffer.alloc(width * height);
    for (let p = 0; p < width * height; p++) {
      for (let c = 0; c < colorChannels; c++) color[p * colorChannels + c] = out[p * bpp + c];
      alpha[p] = out[p * bpp + colorChannels];
    }
  }
  return { kind: 'raw', width, height, components: colorChannels, data: color, alpha };
}

/** عكس مرشّحات PNG لسطر واحد (المواصفة، القسم 9.2). */
function unfilter(type, line, prev, bpp) {
  const n = line.length;
  if (type === 1) {
    for (let x = bpp; x < n; x++) line[x] = (line[x] + line[x - bpp]) & 0xff;
  } else if (type === 2) {
    for (let x = 0; x < n; x++) line[x] = (line[x] + prev[x]) & 0xff;
  } else if (type === 3) {
    for (let x = 0; x < n; x++) {
      const left = x >= bpp ? line[x - bpp] : 0;
      line[x] = (line[x] + ((left + prev[x]) >> 1)) & 0xff;
    }
  } else if (type === 4) {
    for (let x = 0; x < n; x++) {
      const a = x >= bpp ? line[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      const p = a + b - c;
      const pa = Math.abs(p - a); const pb = Math.abs(p - b); const pc = Math.abs(p - c);
      const pred = (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      line[x] = (line[x] + pred) & 0xff;
    }
  }
}

/** أي مصدر صورة مدعوم → وصفٌ جاهز للتضمين، أو null إن تعذّر. */
function decodeImage(buffer) {
  const buf = Buffer.from(buffer);
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8) return readJpeg(buf);
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50) return readPng(buf);
  return null;
}

/**
 * وصف الصورة → كائنات PDF جاهزة.
 * @returns {{objects: Array, name: string, width: number, height: number, nextNum: number}}
 */
function buildImageObjects(image, startNum, streamObject) {
  const objects = [];
  let num = startNum;
  const imageNum = num++;
  const colorSpace = image.components === 1 ? '/DeviceGray'
    : (image.components === 4 ? '/DeviceCMYK' : '/DeviceRGB');

  let smaskRef = '';
  if (image.alpha) {
    const smaskNum = num++;
    objects.push(streamObject(smaskNum,
      `/Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height}`
      + ' /ColorSpace /DeviceGray /BitsPerComponent 8', image.alpha));
    smaskRef = ` /SMask ${smaskNum} 0 R`;
  }

  if (image.kind === 'jpeg') {
    const dict = `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height}`
      + ` /ColorSpace ${colorSpace} /BitsPerComponent 8 /Filter /DCTDecode${smaskRef}`
      + ` /Length ${image.data.length} >>\nstream\n`;
    objects.push({
      num: imageNum,
      body: Buffer.concat([
        Buffer.from(dict, 'latin1'),
        image.data,
        Buffer.from('\nendstream', 'latin1'),
      ]),
    });
  } else {
    objects.push(streamObject(imageNum,
      `/Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height}`
      + ` /ColorSpace ${colorSpace} /BitsPerComponent 8${smaskRef}`, image.data));
  }

  return { objects, imageNum, nextNum: num };
}

/**
 * مصفوفة الرسم (cm) التي تضع الصورة داخل مربّع الشعار الأصلي بنسبة أبعادها،
 * موسَّطةً فيه — نفس المكان ونفس الحجم الأقصى، بلا تشويه.
 */
function containMatrix(box, imageWidth, imageHeight) {
  const scale = Math.min(box.width / imageWidth, box.height / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  return {
    width,
    height,
    x: box.x + (box.width - width) / 2,
    y: box.y + (box.height - height) / 2,
  };
}

module.exports = { decodeImage, buildImageObjects, containMatrix };
