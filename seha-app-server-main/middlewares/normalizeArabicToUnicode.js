'use strict';

/**
 * normalizeArabicToUnicode(pdfBuffer) -> Buffer
 *
 * Chromium's page.pdf() maps many Arabic glyphs to Unicode *presentation
 * forms* (U+FB50–FDFF, U+FE70–FEFF) inside the /ToUnicode CMaps. The text is
 * selectable, but copy/search of Arabic *words* then yields presentation-form
 * codepoints that don't match base-letter searches and paste "disconnected".
 *
 * This post-process rewrites the destination values of every bfchar / bfrange
 * mapping through Unicode NFKC normalization, which folds Arabic presentation
 * forms back to their base letters (and correctly expands ligatures such as
 * lam-alef ﻻ -> لا). It is purely a *text-layer* transform: no drawing
 * operators, fonts, positions or colors are touched, so the document looks
 * 100% identical while Arabic copy / search / translation become clean.
 *
 * ---------------------------------------------------------------------------
 * Design: SAFE INCREMENTAL UPDATE (ISO 32000-1 §7.5.6).
 *
 * The original file bytes are NEVER modified or relocated. We:
 *   1. Read the authoritative classic xref table to enumerate real objects
 *      and their exact byte offsets (we do NOT regex-scan the whole file for
 *      "N G obj" — that would false-match arbitrary bytes inside compressed
 *      streams).
 *   2. Locate each candidate stream's data using its inline /Length (we do
 *      NOT indexOf('endstream') over binary — that would false-match too).
 *   3. Transform only /ToUnicode CMap streams.
 *   4. APPEND the updated objects + a small incremental xref section + a
 *      trailer whose /Prev points at the original xref. Readers use the new
 *      xref and transparently fall back to the original for everything else.
 *
 * Every uncertainty (unexpected shape, indirect /Length, inflate failure,
 * huge or inconsistent xref, /Prev already present, object-number blow-up,
 * ...) makes the function FAIL OPEN — it returns the original buffer unchanged.
 * It never emits a half-rebuilt or corrupt PDF, and it never allocates based
 * on an attacker-influenced number.
 */

const zlib = require('zlib');
const LATIN1 = 'latin1';

// Hard ceiling on object count we're willing to process (Chromium sick-leave
// PDFs have a few hundred). Guards against pathological /Size values.
const MAX_OBJECTS = 200000;

// --- Unicode helpers -------------------------------------------------------

function hasPresentationForm(str) {
  for (const ch of str) {
    const c = ch.codePointAt(0);
    if ((c >= 0xfb50 && c <= 0xfdff) || (c >= 0xfe70 && c <= 0xfeff)) return true;
  }
  return false;
}

function utf16beHexToStr(hex) {
  const buf = Buffer.from(hex, 'hex');
  const swapped = Buffer.alloc(buf.length);
  for (let i = 0; i + 1 < buf.length; i += 2) { swapped[i] = buf[i + 1]; swapped[i + 1] = buf[i]; }
  return swapped.toString('utf16le');
}

function strToUtf16beHex(str) {
  const le = Buffer.from(str, 'utf16le');
  const be = Buffer.alloc(le.length);
  for (let i = 0; i + 1 < le.length; i += 2) { be[i] = le[i + 1]; be[i + 1] = le[i]; }
  return be.toString('hex').toUpperCase();
}

// Normalize one UTF-16BE hex destination value. Byte-stable unless it holds an
// Arabic presentation form, so non-Arabic (digits, IDs, Latin) is never touched.
function normalizeDstHex(hex) {
  try {
    if (!hex || hex.length % 4 !== 0) return hex; // must be whole UTF-16 code units
    const s = utf16beHexToStr(hex);
    if (!hasPresentationForm(s)) return hex;
    const n = s.normalize('NFKC');
    if (n === s) return hex;
    return strToUtf16beHex(n);
  } catch (_) {
    return hex;
  }
}

// Transform the decoded CMap text: only the destination operands of
// bfchar and bfrange (both the array and the incremental <lo> <hi> <base> forms).
function transformCMapText(text) {
  let changed = false;

  // bfchar:  <src> <dst>
  text = text.replace(/beginbfchar([\s\S]*?)endbfchar/g, (whole, body) => {
    const nb = body.replace(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g, (m, src, dst) => {
      const ndst = normalizeDstHex(dst);
      if (ndst !== dst) changed = true;
      return `<${src}> <${ndst}>`;
    });
    return `beginbfchar${nb}endbfchar`;
  });

  // bfrange
  text = text.replace(/beginbfrange([\s\S]*?)endbfrange/g, (whole, body) => {
    // array form:  <lo> <hi> [ <d1> <d2> ... ]
    let nb = body.replace(/(<[0-9A-Fa-f]+>\s*<[0-9A-Fa-f]+>\s*)\[([\s\S]*?)\]/g, (m, prefix, arr) => {
      const narr = arr.replace(/<([0-9A-Fa-f]+)>/g, (mm, dst) => {
        const ndst = normalizeDstHex(dst);
        if (ndst !== dst) changed = true;
        return `<${ndst}>`;
      });
      return `${prefix}[${narr}]`;
    });
    // incremental form:  <lo> <hi> <base>   (only the base is folded; presentation
    // forms virtually never appear in an incremental range, but fold defensively)
    nb = nb.replace(/(<[0-9A-Fa-f]+>\s*<[0-9A-Fa-f]+>\s*)<([0-9A-Fa-f]+)>/g, (m, prefix, dst) => {
      const ndst = normalizeDstHex(dst);
      if (ndst !== dst) changed = true;
      return `${prefix}<${ndst}>`;
    });
    return `beginbfrange${nb}endbfrange`;
  });

  return { text, changed };
}

// --- Classic xref parsing --------------------------------------------------

// Parse the classic xref table starting at byte offset `at`.
// Returns { entries: Map<num,{off,gen}> } or null on any deviation.
function parseClassicXref(s, at) {
  if (s.slice(at, at + 4) !== 'xref') return null;
  let i = at + 4;
  // skip the EOL after "xref"
  while (i < s.length && (s[i] === '\r' || s[i] === '\n' || s[i] === ' ')) i++;
  const entries = new Map();
  let guard = 0;
  while (true) {
    if (++guard > MAX_OBJECTS) return null;
    if (s.startsWith('trailer', i)) break;
    const sec = /^(\d+)\s+(\d+)\s*\r?\n/.exec(s.slice(i, i + 40));
    if (!sec) return null;
    i += sec[0].length;
    const start = parseInt(sec[1], 10);
    const count = parseInt(sec[2], 10);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(count)) return null;
    if (count < 0 || entries.size + count > MAX_OBJECTS) return null;
    for (let k = 0; k < count; k++) {
      // each entry is exactly 20 bytes: "nnnnnnnnnn ggggg t \n"
      const entry = s.slice(i, i + 20);
      const em = /^(\d{10}) (\d{5}) ([nf])/.exec(entry);
      if (!em) return null;
      const num = start + k;
      if (em[3] === 'n') {
        const off = parseInt(em[1], 10);
        const gen = parseInt(em[2], 10);
        if (!entries.has(num)) entries.set(num, { off, gen });
      }
      i += 20;
    }
  }
  return { entries };
}

// Locate the CMap stream inside object `num` at byte offset `off`.
// Returns { headerLen, dictStr, gen, streamData, isFlate } or null.
function readStreamObject(pdfBuffer, num, off) {
  // Read a bounded window for the header + dictionary (dictionaries are small).
  const WINDOW = 8192;
  const winBuf = pdfBuffer.slice(off, Math.min(off + WINDOW, pdfBuffer.length));
  const win = winBuf.toString(LATIN1);
  const hdr = /^(\d+)\s+(\d+)\s+obj\b/.exec(win);
  if (!hdr || parseInt(hdr[1], 10) !== num) return null;
  const sm = /stream\r?\n/.exec(win);
  if (!sm) return null;
  const dictStr = win.slice(0, sm.index);
  // inline /Length only
  const lenM = /\/Length\s+(\d+)(?!\s+\d+\s+R)/.exec(dictStr);
  if (!lenM) return null;
  const length = parseInt(lenM[1], 10);
  if (!Number.isSafeInteger(length) || length < 0) return null;
  const dataStart = off + sm.index + sm[0].length;
  const dataEnd = dataStart + length;
  if (dataEnd > pdfBuffer.length) return null;
  // Verify the stream really ends here: optional EOL then "endstream".
  const after = pdfBuffer.slice(dataEnd, Math.min(dataEnd + 20, pdfBuffer.length)).toString(LATIN1);
  if (!/^\r?\n?endstream/.test(after)) return null;
  const isFlate = /\/Filter\s*(\/FlateDecode|\[\s*\/FlateDecode\s*\])/.test(dictStr);
  return {
    dictStr,
    gen: parseInt(hdr[2], 10),
    streamData: pdfBuffer.slice(dataStart, dataEnd),
    isFlate,
  };
}

// --- Main ------------------------------------------------------------------

module.exports = function normalizeArabicToUnicode(pdfBuffer) {
  try {
    if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length < 64) return pdfBuffer;
    if (pdfBuffer.slice(0, 5).toString(LATIN1) !== '%PDF-') return pdfBuffer;

    const s = pdfBuffer.toString(LATIN1);

    // Only the simple shape Chromium emits: classic xref, no object/xref streams.
    if (s.indexOf('/ObjStm') !== -1 || s.indexOf('/XRef') !== -1) return pdfBuffer;

    const trailerIdx = s.lastIndexOf('trailer');
    if (trailerIdx === -1) return pdfBuffer;
    const trailerTail = s.slice(trailerIdx);

    // Idempotency + simplicity guard: refuse anything already carrying a /Prev
    // (our own output does — so a second pass is a safe no-op returning the input).
    if (/\/Prev\s+\d+/.test(trailerTail)) return pdfBuffer;

    const rootM = /\/Root\s+(\d+)\s+(\d+)\s+R/.exec(trailerTail);
    if (!rootM) return pdfBuffer;
    const infoM = /\/Info\s+(\d+)\s+(\d+)\s+R/.exec(trailerTail);
    const idM = /\/ID\s*(\[[\s\S]*?\])/.exec(trailerTail);
    const sizeM = /\/Size\s+(\d+)/.exec(trailerTail);

    const sxM = /startxref\s+(\d+)/.exec(s.slice(s.lastIndexOf('startxref')));
    if (!sxM) return pdfBuffer;
    const xrefAt = parseInt(sxM[1], 10);
    if (!Number.isSafeInteger(xrefAt) || xrefAt <= 0 || xrefAt >= pdfBuffer.length) return pdfBuffer;

    const xref = parseClassicXref(s, xrefAt);
    if (!xref || xref.entries.size === 0 || xref.entries.size > MAX_OBJECTS) return pdfBuffer;

    // Transform the /ToUnicode CMap objects. Collect updated object bytes.
    const updates = []; // { num, gen, dictStr, newStreamData }
    for (const [num, meta] of xref.entries) {
      if (meta.off <= 0 || meta.off >= pdfBuffer.length) continue;
      const so = readStreamObject(pdfBuffer, num, meta.off);
      if (!so) continue;

      let decoded;
      try {
        decoded = so.isFlate ? zlib.inflateSync(so.streamData) : Buffer.from(so.streamData);
      } catch (_) {
        continue;
      }
      const decText = decoded.toString(LATIN1);
      if (decText.indexOf('beginbfchar') === -1 && decText.indexOf('beginbfrange') === -1) continue;

      const { text: newText, changed } = transformCMapText(decText);
      if (!changed) continue;

      const newDecoded = Buffer.from(newText, LATIN1);
      let newStreamData;
      try {
        newStreamData = so.isFlate ? zlib.deflateSync(newDecoded) : newDecoded;
      } catch (_) {
        continue;
      }
      const newDict = so.dictStr.replace(/\/Length\s+\d+/, `/Length ${newStreamData.length}`);
      if (newDict === so.dictStr) continue; // couldn't set inline length -> skip safely
      updates.push({ num, gen: meta.gen, dictStr: newDict, newStreamData });
    }

    if (updates.length === 0) return pdfBuffer;

    // --- Build the incremental update appendix -----------------------------
    const parts = [pdfBuffer];
    let offset = pdfBuffer.length;
    // Separate the appendix from the original EOF with a newline if needed.
    if (pdfBuffer[pdfBuffer.length - 1] !== 0x0a) { parts.push(Buffer.from('\n', LATIN1)); offset += 1; }

    const newOffsets = new Map(); // num -> byte offset of the appended object
    for (const u of updates) {
      newOffsets.set(u.num, offset);
      const objBuf = Buffer.concat([
        Buffer.from(`${u.num} ${u.gen} obj\n`, LATIN1),
        Buffer.from(u.dictStr.replace(/^\d+\s+\d+\s+obj\s*/, ''), LATIN1), // dict body only
        Buffer.from('stream\n', LATIN1),
        u.newStreamData,
        Buffer.from('\nendstream\nendobj\n', LATIN1),
      ]);
      parts.push(objBuf);
      offset += objBuf.length;
    }

    // Incremental xref: one subsection per updated object (20-byte entries).
    const xrefStart = offset;
    const sorted = updates.map((u) => u.num).sort((a, b) => a - b);
    let xt = 'xref\n';
    for (const num of sorted) {
      const off = newOffsets.get(num);
      const gen = updates.find((u) => u.num === num).gen;
      xt += `${num} 1\n`;
      xt += `${String(off).padStart(10, '0')} ${String(gen).padStart(5, '0')} n \n`;
    }
    parts.push(Buffer.from(xt, LATIN1));
    offset += Buffer.byteLength(xt, LATIN1);

    const size = sizeM ? parseInt(sizeM[1], 10) : (Math.max(...xref.entries.keys()) + 1);
    let tr = `trailer\n<< /Size ${size} /Root ${rootM[1]} ${rootM[2]} R`;
    if (infoM) tr += ` /Info ${infoM[1]} ${infoM[2]} R`;
    if (idM) tr += ` /ID ${idM[1]}`;
    tr += ` /Prev ${xrefAt} >>\nstartxref\n${xrefStart}\n%%EOF\n`;
    parts.push(Buffer.from(tr, LATIN1));

    return Buffer.concat(parts);
  } catch (err) {
    // Fail-open: never return a broken PDF.
    console.warn('⚠️ normalizeArabicToUnicode skipped:', err && err.message);
    return pdfBuffer;
  }
};
