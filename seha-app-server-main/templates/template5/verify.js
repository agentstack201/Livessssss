// ───────────────────────────────────────────────────────────────────────────
// تحقّق ذاتي من أن ربط البيانات لم يمسّ القالب.
//
// شغّله بـ:  node templates/template5/verify.js
//
// يثبت ثلاثة أشياء:
//   ١) الملف الناتج يبدأ ببايتات master.pdf كاملةً بلا تغيير — أي أن كل
//      الرسومات والصور والنصوص الثابتة والخطوط الأصلية سليمة حرفياً.
//   ٢) كل كتلة نصّ لا يملكها حقلٌ في fieldMap تخرج كما هي بايتاً ببايت.
//   ٣) إعادة توليد بيانات الملف الأصلي نفسها تُنتج نفس المواضع (±0.05 نقطة).
// ───────────────────────────────────────────────────────────────────────────
const fs = require('fs');
const assert = require('assert');
const zlib = require('zlib');

const { loadTemplate } = require('./pdfTemplate');
const { FIELDS } = require('./fieldMap');
const { renderTemplate5Pdf, MASTER_PATH } = require('./index');

// بيانات الملف الأصلي نفسها — إعادة توليدها يجب أن تعيد إنتاجه.
const MASTER_DATA = {
  leave_id: 'PSL26081523142', national_id: '1083930121',
  name_en: 'ASMAHAN HAMOUD MOHAMMED ALGHAMDI', name_ar: 'اسمهان حمود محمد الغامدي',
  admission_date_en: '2026-08-14', admission_date_ar: '01-03-1448',
  discharge_date_en: '2026-08-14', discharge_date_ar: '01-03-1448',
  issue_date: '2026-08-15', employer_ar: 'شركات العطور', employer_en: '',
  physician_name_en: 'NUJUD ABDULLAH SULAIMAN ALJOHANI', physician_name_ar: 'نجود عبدالله سليمان الجهني',
  position_en: 'General Dentist', position_ar: 'طبيب أسنان عام',
  hospital_name_ar: 'عيادة الاسرة الجميلة', hospital_name_en: 'Beautiful Family Medical Clinic',
  license_number: '3800027389', show_license_number: true, leave_days: 1,
  report_time: '8:16 PM', report_date: 'Saturday, 15 August 2026',
};
const SAUDI = { country_name_ar: 'السعودية', country_name_en: 'Saudi Arabia' };

const master = fs.readFileSync(MASTER_PATH);
const output = renderTemplate5Pdf({ data: MASTER_DATA, leaveDays: 1, country: SAUDI });

// ── ١) بايتات الأصل سليمة ──────────────────────────────────────────────────
assert.ok(output.length > master.length, 'الناتج يجب أن يكون الأصل + تحديث تراكمي');
assert.ok(output.subarray(0, master.length).equals(master),
  'بايتات القالب الأصلي تغيّرت — التحديث التراكمي مكسور');
console.log('✅ ١) الملف الناتج يبدأ بـ master.pdf كاملاً بلا تغيير (%d بايت)', master.length);

// ── ٢) الكتل غير المربوطة لم تُمَسّ ────────────────────────────────────────
const tpl = loadTemplate(master);
const owned = new Set(FIELDS.flatMap((f) => f.blocks));
const newContent = readLastStream(output, tpl.contentNum).toString('latin1');
let untouched = 0;
tpl.blocks.forEach((block, index) => {
  if (owned.has(index)) return;
  assert.ok(newContent.includes(block.text),
    `كتلة نصّ ثابتة رقم ${index} فُقدت أو تغيّرت:\n${block.text}`);
  untouched += 1;
});
console.log('✅ ٢) %d كتلة نصّ ثابتة خرجت بايتاً ببايت (%d كتلة مربوطة بالبيانات)',
  untouched, owned.size);

// ── ٣) مواضع النصّ اللاتيني تطابق الأصل ────────────────────────────────────
// موضع نصٍّ ما أفقياً: نجد كتلة BT…ET التي تحويه ونجمع إزاحات Td حتى أمر
// رسمه — فالنتيجة إحداثيّه المطلق سواء كُتب في كتلة مستقلة (كما في الأصل) أو
// كسطرٍ ثانٍ بإزاحة نسبية (كما نكتبه نحن).
const absoluteX = (content, text) => {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const blocks = content.match(/BT\n[\s\S]*?\nET/g) || [];
  for (const block of blocks) {
    const at = block.search(new RegExp('\\(' + escaped + '\\)Tj'));
    if (at < 0) continue;
    let x = 0;
    const re = /([-\d.]+) ([-\d.]+) Td/g;
    let m;
    while ((m = re.exec(block)) !== null && m.index < at) x += parseFloat(m[1]);
    return x;
  }
  return null;
};
const tdOf = (text) => {
  const mine = absoluteX(newContent, text);
  const ref = absoluteX(tpl.content, text);
  return mine === null || ref === null ? null : { mine, ref };
};
const SAMPLES = ['PSL26081523142', '14-08-2026', '15-08-2026', 'Saudi Arabia',
  'ASMAHAN HAMOUD MOHAMMED', 'ALGHAMDI', 'General Dentist', 'NUJUD ABDULLAH SULAIMAN',
  'Beautiful Family Medical Clinic', '8:16 PM', 'Saturday, 15 August 2026'];
let worst = 0;
for (const sample of SAMPLES) {
  const pos = tdOf(sample);
  assert.ok(pos, `تعذّر إيجاد «${sample}» في الأصل أو في الناتج`);
  const delta = Math.abs(pos.mine - pos.ref);
  worst = Math.max(worst, delta);
  assert.ok(delta < 0.05, `«${sample}» انزاح ${delta.toFixed(3)} نقطة`);
}
console.log('✅ ٣) %d نصّاً لاتينياً في موضعه الأصلي (أقصى فرق %s نقطة)',
  SAMPLES.length, worst.toFixed(3));

console.log('\nكل الفحوص نجحت — القالب لم يتغيّر، والبيانات وحدها هي المتبدّلة.');

/** آخر تعريف لكائن stream في الملف (التحديث التراكمي يعرّفه من جديد). */
function readLastStream(buffer, objNum) {
  const ascii = buffer.toString('latin1');
  const start = ascii.lastIndexOf(`\n${objNum} 0 obj`);
  const dictStart = ascii.indexOf('<<', start);
  const streamKw = ascii.indexOf('stream', dictStart);
  const dict = ascii.slice(dictStart, streamKw);
  const length = parseInt(dict.match(/\/Length (\d+)/)[1], 10);
  let dataStart = streamKw + 'stream'.length;
  if (ascii[dataStart] === '\r') dataStart++;
  if (ascii[dataStart] === '\n') dataStart++;
  const data = buffer.subarray(dataStart, dataStart + length);
  return /\/Filter\s*\/FlateDecode/.test(dict) ? zlib.inflateSync(data) : data;
}
