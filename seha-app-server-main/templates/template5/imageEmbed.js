// ───────────────────────────────────────────────────────────────────────────
// تضمين صورة (شعار المنشأة) داخل القالب ككائن XObject.
//
// الشعار وحده هو ما يتغيّر — موضعه وحجمه في الصفحة يبقيان كما هما في الملف
// الأصلي بالضبط. الصورة تُركَّب داخل نفس المربّع الأصلي بنسبة أبعادها (contain)
// فلا تتشوّه ولا تتجاوز إطارها.
//
// المدعوم — كل ما تقبله مكتبة الوسائط عملياً في الشعارات:
//   • JPEG بكل أنواعه (أساسي ومتدرّج، رمادي/RGB/CMYK). يُمرَّر كما هو بمرشّح
//     DCTDecode بلا إعادة ترميز، فلا تفقد الصورة أي جودة.
//   • PNG بكل صوره: رمادي، ملوّن، **لوحة ألوان (PNG-8)**، رمادي+شفافية،
//     RGBA؛ بأعماق 1 و2 و4 و8 و16 بت؛ متشابك (Adam7) أو غير متشابك؛ مع
//     شفافية tRNS. تُفكّ إلى عيّنات 8 بت وتُفصل قناة الشفافية إلى SMask.
//   • GIF (87a/89a) بلوحته وشفافيته — أول إطار.
//
// مبدأ صارم: `decodeImage` إمّا أن تعيد الصورة التي اختارها المستخدم، أو
// `null`. لا تعيد أبداً صورةً أخرى. ومن يستدعيها ملزَمٌ بألّا يستبدل الشعار
// المختار بشعارٍ آخر عند الفشل — انظر index.js.
// ───────────────────────────────────────────────────────────────────────────
const zlib = require('zlib');

// ── تعرّف الصيغة (لرسالة خطأ تسمّي السبب بدل الصمت) ────────────────────────

/** بصمة بايتات المصدر → اسم الصيغة، أو 'غير معروفة'. */
function imageFormat(buffer) {
  const buf = Buffer.from(buffer || []);
  if (buf.length < 4) return 'غير معروفة';
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'JPEG';
  if (buf[0] === 0x89 && buf.toString('latin1', 1, 4) === 'PNG') return 'PNG';
  if (buf.toString('latin1', 0, 3) === 'GIF') return 'GIF';
  if (buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return 'WEBP';
  if (buf.toString('latin1', 0, 2) === 'BM') return 'BMP';
  if (buf[0] === 0x00 && buf[1] === 0x00 && buf[2] === 0x01 && buf[3] === 0x00) return 'ICO';
  const head = buf.toString('latin1', 0, Math.min(buf.length, 512)).trimStart();
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && /<svg[\s>]/.test(head))) return 'SVG';
  return 'غير معروفة';
}

// ── JPEG ───────────────────────────────────────────────────────────────────

/** أبعاد صورة JPEG وعدد قنواتها من ترويسة SOF (مع كشف علامة Adobe). */
function readJpeg(buf) {
  let adobe = false;
  let i = 2;
  while (i < buf.length - 1) {
    if (buf[i] !== 0xff) { i += 1; continue; }
    const marker = buf[i + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    if (marker === 0xd9 || marker === 0xda) break;   // نهاية/بداية بيانات المسح
    const length = buf.readUInt16BE(i + 2);
    if (marker === 0xee && buf.toString('latin1', i + 4, i + 9) === 'Adobe') adobe = true;
    // SOF0..SOF3 و SOF5..SOF7 و SOF9..SOF11 و SOF13..SOF15 تحمل الأبعاد.
    if ((marker >= 0xc0 && marker <= 0xcf) && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const components = buf[i + 9];
      // 1 = رمادي، 3 = ملوّن، 4 = CMYK. أي عدد آخر لا نعرف كيف نصفه لـ PDF،
      // فنرفضه بدل أن نصفه وصفاً خاطئاً تظهر به الألوان مقلوبة.
      if (components !== 1 && components !== 3 && components !== 4) return null;
      return {
        kind: 'jpeg',
        height: buf.readUInt16BE(i + 5),
        width: buf.readUInt16BE(i + 7),
        components,
        data: buf,
        alpha: null,
        // ملفات CMYK الصادرة عن Adobe مخزَّنة معكوسة، وهذا هو التصحيح المعتاد.
        decode: components === 4 && adobe ? '[1 0 1 0 1 0 1 0]' : null,
      };
    }
    i += 2 + length;
  }
  return null;
}

// ── PNG ────────────────────────────────────────────────────────────────────

// عدد قنوات كل نوع لون: 0 رمادي، 2 ملوّن، 3 لوحة، 4 رمادي+ألفا، 6 RGBA.
const PNG_CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

// مراحل التشابك السبع (Adam7): بداية س، بداية ص، خطوة س، خطوة ص.
const ADAM7 = [
  [0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4],
  [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2],
];

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

/**
 * يستخرج عيّنات سطرٍ واحد بأي عمق بت → بايت لكل عيّنة.
 * قيم اللوحة تبقى فهارس كما هي؛ وما عداها يُمدَّد إلى المدى 0-255.
 */
function readSamples(line, bitDepth, count, palette) {
  const out = Buffer.alloc(count);
  if (bitDepth === 8) {
    line.copy(out, 0, 0, count);
    return out;
  }
  if (bitDepth === 16) {
    for (let i = 0; i < count; i++) out[i] = line[i * 2];   // البايت الأعلى يكفي
    return out;
  }
  const max = (1 << bitDepth) - 1;
  const perByte = 8 / bitDepth;
  for (let i = 0; i < count; i++) {
    const byte = line[Math.floor(i / perByte)];
    const shift = 8 - bitDepth * ((i % perByte) + 1);
    const value = (byte >> shift) & max;
    out[i] = palette ? value : Math.round((value * 255) / max);
  }
  return out;
}

/** بيانات PNG خاماً: RGB (أو رمادي) مع قناة شفافية منفصلة إن وُجدت. */
function readPng(buf) {
  if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) return null;

  let width = 0; let height = 0; let bitDepth = 0; let colorType = 0; let interlace = 0;
  let palette = null; let trns = null;
  const idat = [];
  let i = 8;
  while (i + 8 <= buf.length) {
    const length = buf.readUInt32BE(i);
    const type = buf.toString('latin1', i + 4, i + 8);
    const body = buf.subarray(i + 8, i + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      bitDepth = body[8];
      colorType = body[9];
      if (body[10] !== 0 || body[11] !== 0) return null;   // ضغط/ترشيح غير قياسي
      interlace = body[12];
      if (interlace !== 0 && interlace !== 1) return null;
    } else if (type === 'PLTE') {
      palette = Buffer.from(body);
    } else if (type === 'tRNS') {
      trns = Buffer.from(body);
    } else if (type === 'IDAT') {
      idat.push(body);
    } else if (type === 'IEND') {
      break;
    }
    i += 12 + length;
  }

  const channels = PNG_CHANNELS[colorType];
  if (!channels || !width || !height || !idat.length) return null;
  if (![1, 2, 4, 8, 16].includes(bitDepth)) return null;
  if (bitDepth === 16 && colorType === 3) return null;                 // غير موجود في المواصفة
  if (bitDepth !== 8 && bitDepth !== 16 && colorType !== 0 && colorType !== 3) return null;
  if (colorType === 3 && (!palette || palette.length < 3)) return null;

  let raw;
  try {
    raw = zlib.inflateSync(Buffer.concat(idat));
  } catch {
    return null;
  }

  // كل العيّنات بعمق 8 بت: قناة لكل عيّنة، بترتيب الصفوف.
  const samples = Buffer.alloc(width * height * channels);
  const isPalette = colorType === 3;
  const bpp = Math.max(1, Math.ceil((bitDepth * channels) / 8));
  let pos = 0;

  const passes = interlace === 1
    ? ADAM7
    : [[0, 0, 1, 1]];

  for (const [xStart, yStart, xStep, yStep] of passes) {
    const passW = Math.ceil((width - xStart) / xStep);
    const passH = Math.ceil((height - yStart) / yStep);
    if (passW <= 0 || passH <= 0) continue;
    const stride = Math.ceil((passW * channels * bitDepth) / 8);
    let prev = Buffer.alloc(stride);
    for (let row = 0; row < passH; row++) {
      if (pos >= raw.length) return null;
      const filter = raw[pos++];
      if (filter > 4) return null;
      const line = Buffer.from(raw.subarray(pos, pos + stride));
      if (line.length < stride) return null;
      pos += stride;
      unfilter(filter, line, prev, bpp);
      prev = line;

      const values = readSamples(line, bitDepth, passW * channels, isPalette);
      const y = yStart + row * yStep;
      for (let col = 0; col < passW; col++) {
        const x = xStart + col * xStep;
        const dst = (y * width + x) * channels;
        for (let c = 0; c < channels; c++) samples[dst + c] = values[col * channels + c];
      }
    }
  }

  // العيّنات → قنوات لون + قناة شفافية مستقلّة، بالشكل الذي يفهمه PDF.
  const pixels = width * height;
  if (isPalette) {
    const colors = Math.floor(palette.length / 3);
    const color = Buffer.alloc(pixels * 3);
    let alpha = null;
    if (trns && trns.length) alpha = Buffer.alloc(pixels, 0xff);
    for (let p = 0; p < pixels; p++) {
      const index = Math.min(samples[p], colors - 1);
      color[p * 3] = palette[index * 3];
      color[p * 3 + 1] = palette[index * 3 + 1];
      color[p * 3 + 2] = palette[index * 3 + 2];
      if (alpha) alpha[p] = samples[p] < trns.length ? trns[samples[p]] : 0xff;
    }
    return { kind: 'raw', width, height, components: 3, data: color, alpha, decode: null };
  }

  const hasAlphaChannel = colorType === 4 || colorType === 6;
  const colorChannels = colorType === 6 ? 3 : (colorType === 4 ? 1 : channels);

  if (hasAlphaChannel) {
    const color = Buffer.alloc(pixels * colorChannels);
    const alpha = Buffer.alloc(pixels);
    for (let p = 0; p < pixels; p++) {
      for (let c = 0; c < colorChannels; c++) color[p * colorChannels + c] = samples[p * channels + c];
      alpha[p] = samples[p * channels + colorChannels];
    }
    return { kind: 'raw', width, height, components: colorChannels, data: color, alpha, decode: null };
  }

  // شفافية tRNS للرمادي (قيمة واحدة) وللملوّن (ثلاث قيم): لونٌ بعينه شفاف.
  let alpha = null;
  if (trns && ((colorType === 0 && trns.length >= 2) || (colorType === 2 && trns.length >= 6))) {
    const scale = bitDepth === 16 ? 1 : 255 / ((1 << bitDepth) - 1);
    const key = colorType === 0
      ? [Math.round((trns.readUInt16BE(0) & 0xffff) * (bitDepth === 16 ? 1 / 257 : scale))]
      : [0, 2, 4].map((o) => Math.round(trns.readUInt16BE(o) * (bitDepth === 16 ? 1 / 257 : scale)));
    alpha = Buffer.alloc(pixels, 0xff);
    for (let p = 0; p < pixels; p++) {
      let match = true;
      for (let c = 0; c < channels; c++) {
        if (samples[p * channels + c] !== key[c]) { match = false; break; }
      }
      if (match) alpha[p] = 0;
    }
  }
  return { kind: 'raw', width, height, components: channels, data: samples, alpha, decode: null };
}

// ── GIF ────────────────────────────────────────────────────────────────────

/** فكّ ضغط LZW الخاص بـ GIF → فهارس اللوحة. */
function lzwDecode(minCodeSize, data, pixelCount) {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  const out = Buffer.alloc(pixelCount);
  let outPos = 0;

  let codeSize = minCodeSize + 1;
  let dict = [];
  const resetDict = () => {
    dict = new Array(clearCode + 2);
    for (let i = 0; i < clearCode; i++) dict[i] = [i];
    codeSize = minCodeSize + 1;
  };
  resetDict();

  let bitPos = 0;
  let prev = null;
  const totalBits = data.length * 8;
  while (bitPos + codeSize <= totalBits) {
    let code = 0;
    for (let b = 0; b < codeSize; b++) {
      const p = bitPos + b;
      code |= ((data[p >> 3] >> (p & 7)) & 1) << b;
    }
    bitPos += codeSize;

    if (code === clearCode) { resetDict(); prev = null; continue; }
    if (code === eoiCode) break;

    let entry;
    if (dict[code]) entry = dict[code];
    else if (prev) entry = prev.concat(prev[0]);
    else break;

    for (const v of entry) {
      if (outPos >= pixelCount) break;
      out[outPos++] = v;
    }
    if (prev) {
      dict.push(prev.concat(entry[0]));
      if (dict.length === (1 << codeSize) && codeSize < 12) codeSize += 1;
    }
    prev = entry;
    if (outPos >= pixelCount) break;
  }
  return out;
}

/** أول إطار من ملف GIF، مركَّباً على مقاس الشاشة المنطقية بخلفية شفافة. */
function readGif(buf) {
  const sig = buf.toString('latin1', 0, 6);
  if (sig !== 'GIF87a' && sig !== 'GIF89a') return null;

  const screenW = buf.readUInt16LE(6);
  const screenH = buf.readUInt16LE(8);
  const packed = buf[10];
  let pos = 13;
  let globalPalette = null;
  if (packed & 0x80) {
    const size = 3 * (1 << ((packed & 7) + 1));
    globalPalette = buf.subarray(pos, pos + size);
    pos += size;
  }
  if (!screenW || !screenH) return null;

  let transparentIndex = -1;
  const readSubBlocks = () => {
    const parts = [];
    while (pos < buf.length) {
      const size = buf[pos++];
      if (!size) break;
      parts.push(buf.subarray(pos, pos + size));
      pos += size;
    }
    return Buffer.concat(parts);
  };

  while (pos < buf.length) {
    const marker = buf[pos++];
    if (marker === 0x3b) break;                               // نهاية الملف
    if (marker === 0x21) {                                    // كتلة امتداد
      const label = buf[pos++];
      if (label === 0xf9) {
        const block = readSubBlocks();
        if (block.length >= 4 && (block[0] & 1)) transparentIndex = block[3];
      } else {
        readSubBlocks();
      }
      continue;
    }
    if (marker !== 0x2c) return null;                          // بايت غير متوقّع

    const left = buf.readUInt16LE(pos);
    const top = buf.readUInt16LE(pos + 2);
    const imgW = buf.readUInt16LE(pos + 4);
    const imgH = buf.readUInt16LE(pos + 6);
    const imgPacked = buf[pos + 8];
    pos += 9;

    let localPalette = null;
    if (imgPacked & 0x80) {
      const size = 3 * (1 << ((imgPacked & 7) + 1));
      localPalette = buf.subarray(pos, pos + size);
      pos += size;
    }
    const paletteBytes = localPalette || globalPalette;
    if (!paletteBytes || !imgW || !imgH) return null;

    const minCodeSize = buf[pos++];
    const data = readSubBlocks();
    const indices = lzwDecode(minCodeSize, data, imgW * imgH);

    // GIF المتشابك: أربع مراحل بخطوات ثابتة.
    let rows = indices;
    if (imgPacked & 0x40) {
      rows = Buffer.alloc(imgW * imgH);
      const steps = [[0, 8], [4, 8], [2, 4], [1, 2]];
      let src = 0;
      for (const [start, step] of steps) {
        for (let y = start; y < imgH; y += step) {
          indices.copy(rows, y * imgW, src * imgW, (src + 1) * imgW);
          src += 1;
        }
      }
    }

    const pixels = screenW * screenH;
    const color = Buffer.alloc(pixels * 3);
    const alpha = Buffer.alloc(pixels, 0);          // خارج الإطار = شفاف
    for (let y = 0; y < imgH; y++) {
      const dstY = top + y;
      if (dstY >= screenH) break;
      for (let x = 0; x < imgW; x++) {
        const dstX = left + x;
        if (dstX >= screenW) break;
        const index = rows[y * imgW + x];
        const p = dstY * screenW + dstX;
        color[p * 3] = paletteBytes[index * 3];
        color[p * 3 + 1] = paletteBytes[index * 3 + 1];
        color[p * 3 + 2] = paletteBytes[index * 3 + 2];
        alpha[p] = index === transparentIndex ? 0 : 0xff;
      }
    }
    return { kind: 'raw', width: screenW, height: screenH, components: 3, data: color, alpha, decode: null };
  }
  return null;
}

// ── الواجهة ────────────────────────────────────────────────────────────────

/**
 * أي مصدر صورة مدعوم → وصفٌ جاهز للتضمين، أو null إن تعذّر.
 * لا تُرجِع هذه الدالة صورةً بديلة أبداً: إمّا صورة المستخدم أو لا شيء.
 */
function decodeImage(buffer) {
  const buf = Buffer.from(buffer);
  try {
    if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8) return readJpeg(buf);
    if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50) return readPng(buf);
    if (buf.length > 13 && buf.toString('latin1', 0, 3) === 'GIF') return readGif(buf);
  } catch {
    return null;                                   // ملف تالف — يعالجه المستدعي
  }
  return null;
}

/**
 * وصف الصورة → كائنات PDF جاهزة.
 * @returns {{objects: Array, imageNum: number, nextNum: number}}
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
  const decodeRef = image.decode ? ` /Decode ${image.decode}` : '';

  if (image.kind === 'jpeg') {
    const dict = `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height}`
      + ` /ColorSpace ${colorSpace} /BitsPerComponent 8${decodeRef} /Filter /DCTDecode${smaskRef}`
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
      + ` /ColorSpace ${colorSpace} /BitsPerComponent 8${decodeRef}${smaskRef}`, image.data));
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

module.exports = { decodeImage, buildImageObjects, containMatrix, imageFormat };
