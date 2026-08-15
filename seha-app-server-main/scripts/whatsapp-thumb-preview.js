#!/usr/bin/env node
// ضبط شكل مصغّرة واتساب محلياً بلا خادم ولا إرسال.
//
//   node scripts/whatsapp-thumb-preview.js <ملف.pdf> [الناتج.jpg] [العرض] [التمويه] [الجودة]
//
// مثال — تجربة ثلاث درجات غيام على نفس التقرير:
//   node scripts/whatsapp-thumb-preview.js report.pdf t-soft.jpg  300 1 70
//   node scripts/whatsapp-thumb-preview.js report.pdf t-mid.jpg   200 2 55
//   node scripts/whatsapp-thumb-preview.js report.pdf t-heavy.jpg 120 4 40
//
// افتح الناتج وكبّره إلى عرض فقاعة المحادثة (~640px) لترى ما سيراه المستلم.
// الملف المُدخَل يُقرأ فقط ولا يُكتب عليه إطلاقاً.

const fs = require('fs');
const path = require('path');
const buildThumbnail = require('../middlewares/whatsappThumbnail');

const [input, output = 'thumb.jpg', width, blurRadius, quality] = process.argv.slice(2);

if (!input) {
  console.error('الاستخدام: node scripts/whatsapp-thumb-preview.js <ملف.pdf> [الناتج.jpg] [العرض] [التمويه] [الجودة]');
  process.exit(1);
}

(async () => {
  const before = fs.readFileSync(path.resolve(input));
  const thumb = await buildThumbnail(before, {
    width: width ? Number(width) : undefined,
    blurRadius: blurRadius !== undefined ? Number(blurRadius) : undefined,
    quality: quality ? Number(quality) : undefined,
  });
  fs.writeFileSync(path.resolve(output), thumb.buffer);

  const after = fs.readFileSync(path.resolve(input));
  console.log(`✅ ${output} — ${thumb.width}×${thumb.height}, ${thumb.buffer.length} بايت, جودة ${thumb.quality}`);
  console.log(`🔒 ملف الـ PDF لم يتغيّر: ${Buffer.compare(before, after) === 0 ? 'نعم (مطابق بايت ببايت)' : 'لا — أوقف الاستخدام وأبلغ'}`);
})().catch((err) => {
  console.error('❌ فشل توليد المصغّرة:', err.message);
  process.exit(1);
});
