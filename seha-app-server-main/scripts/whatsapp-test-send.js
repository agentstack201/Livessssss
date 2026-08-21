#!/usr/bin/env node
// ───────────────────────────────────────────────────────────────────────────
// اختبار داخلي كامل لمسار «معاينة غائمة + ملف حادّ» — بأمر واحد وبلا قاعدة
// بيانات وبلا لمس أي شيء في النظام.
//
//   node scripts/whatsapp-test-send.js <رقم الاختبار> [--pairing-code]
//
// مثال:
//   node scripts/whatsapp-test-send.js 967738056534
//   node scripts/whatsapp-test-send.js 967738056534 --pairing-code
//
// ماذا يفعل بالترتيب:
//   1) يقرن الرقم: يعرض رمز QR في الطرفية (أو رمز إقران من ٨ خانات مع
//      --pairing-code، وهو أسهل على الهاتف: واتساب ← الأجهزة المرتبطة ←
//      ربط برقم الهاتف).
//   2) ينتظر حتى تصبح الحالة Connected ويطبعها.
//   3) يولّد تقرير PDF تجريبي ببيانات وهمية عبر نفس مولّد النظام (بلا قاعدة
//      بيانات وبلا أي سجل حقيقي).
//   4) يبني المصغّرة المموّهة بالإعدادات الحالية ويطبع مقاسها وحجمها.
//   5) يرسل الملف إلى الرقم نفسه فقط — لا زبائن ولا أرقام أخرى إطلاقاً.
//
// جلسة هذا الاختبار تُحفظ في مجلد مؤقّت (.wa-test-auth) منفصل تماماً عن جلسة
// الإنتاج المحفوظة في قاعدة البيانات. احذف المجلد وافصل الجهاز من واتساب
// (الأجهزة المرتبطة) بعد انتهاء الاختبار.
//
// تنبيه: ربط الجهاز يمنح هذه العملية صلاحية قراءة رسائل الحساب ما دامت
// مرتبطة — لذلك استخدم رقم اختبار مخصّصاً، وافصله بعد الانتهاء.
// ───────────────────────────────────────────────────────────────────────────

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

const createPDF = require('../middlewares/generatePdf');
const buildThumbnail = require('../middlewares/whatsappThumbnail');

const AUTH_DIR = path.join(__dirname, '..', '.wa-test-auth');

const rawNumber = process.argv[2];
const usePairingCode = process.argv.includes('--pairing-code');
// --dry-run: ينفّذ كل شيء عدا الاتصال والإرسال — يولّد التقرير والمصغّرة
// ويحفظهما بجانب المشروع لتفحصهما بعينك قبل أي إقران.
const dryRun = process.argv.includes('--dry-run');

if (!rawNumber) {
  console.error('الاستخدام: node scripts/whatsapp-test-send.js <رقم بصيغة دولية بلا +> [--pairing-code]');
  process.exit(1);
}
const digits = String(rawNumber).replace(/\D+/g, '');
const jid = `${digits}@s.whatsapp.net`;

// بيانات تجريبية بحتة — لا تمسّ قاعدة البيانات ولا أي سجل حقيقي.
const SAMPLE = {
  id: 0,
  leave_id: 'GSL00000000000',
  service_num: 'PSL00000000',
  national_id: '0000000000',
  name_ar: 'تجربة داخلية', name_en: 'INTERNAL TEST',
  nationality: 'سعودي', identity_type: 'هوية وطنية',
  employer_ar: '—', employer_en: '—',
  hospital_name_ar: 'مستشفى الاختبار', hospital_name_en: 'Test Hospital',
  doctor_name_ar: '—', doctor_name_en: '—',
  admission_date_en: '2026-01-01', discharge_date_en: '2026-01-03',
  admission_date_ar: '1447-07-12', discharge_date_ar: '1447-07-14',
  report_date: '2026-01-03', report_time: '12:00',
};

// خطوتا التوليد (٣ و٤) مشتركتان بين الاختبار الحقيقي والتجربة الجافّة.
async function buildSampleReport() {
  console.log('⏳ توليد تقرير PDF تجريبي عبر مولّد النظام كما هو…');
  const pdfBuffer = await createPDF(SAMPLE, 3,
    { currentDate: '2026-01-03', currentTime: '12:00' },
    { country_name_ar: 'سعودي', country_name_en: 'Saudi' });
  console.log(`   الملف: ${pdfBuffer.length} بايت`);

  console.log('⏳ بناء المصغّرة المموّهة (الملف يُقرأ فقط)…');
  const thumb = await buildThumbnail(pdfBuffer);
  console.log(`   المصغّرة: ${thumb.width}×${thumb.height}, ${thumb.buffer.length} بايت, جودة ${thumb.quality}`);
  return { pdfBuffer, thumb };
}

if (dryRun) {
  (async () => {
    const { pdfBuffer, thumb } = await buildSampleReport();
    const outPdf = path.join(__dirname, '..', 'wa-test-sample.pdf');
    const outJpg = path.join(__dirname, '..', 'wa-test-thumbnail.jpg');
    fs.writeFileSync(outPdf, pdfBuffer);
    fs.writeFileSync(outJpg, thumb.buffer);
    console.log(`\n✅ تجربة جافّة — لم يُرسَل شيء ولم يُقرَن أي رقم.`);
    console.log(`   التقرير : ${outPdf}   (افتحه: يجب أن يكون واضحاً 100%)`);
    console.log(`   المصغّرة: ${outJpg}   (كبّرها: هكذا ستظهر المعاينة في واتساب)`);
    process.exit(0);
  })().catch((err) => { console.error('❌ فشل:', err.message); process.exit(1); });
  return;
}

(async () => {
  const baileys = await import('@whiskeysockets/baileys');
  const makeWASocket = baileys.default || baileys.makeWASocket;
  const { useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = baileys;

  const silent = { level: 'silent', child: () => silent, trace() {}, debug() {}, info() {}, warn() {}, error() {}, fatal() {} };
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: silent,
    printQRInTerminal: false,
    browser: ['Seha Reports Test', 'Chrome', '1.0.0'],
    markOnlineOnConnect: false,
    syncFullHistory: false,
  });
  sock.ev.on('creds.update', saveCreds);

  let askedForCode = false;

  const connected = new Promise((resolve, reject) => {
    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        if (usePairingCode && !askedForCode && !state.creds.registered) {
          askedForCode = true;
          try {
            const code = await sock.requestPairingCode(digits);
            console.log('\n────────────────────────────────────────');
            console.log(`  رمز الإقران: ${code}`);
            console.log('  واتساب ← الأجهزة المرتبطة ← ربط جهاز ← ربط برقم الهاتف');
            console.log('────────────────────────────────────────\n');
          } catch (err) {
            console.error('❌ تعذّر طلب رمز الإقران:', err.message);
          }
        } else if (!usePairingCode) {
          console.log('\nامسح هذا الرمز من: واتساب ← الأجهزة المرتبطة ← ربط جهاز\n');
          console.log(await QRCode.toString(qr, { type: 'terminal', small: true }));
        }
      }
      if (connection === 'open') resolve();
      if (connection === 'close') {
        const status = lastDisconnect?.error?.output?.statusCode;
        if (status === DisconnectReason.loggedOut) {
          reject(new Error('تم تسجيل الخروج — احذف مجلد .wa-test-auth وأعد المحاولة'));
        } else {
          console.warn('⚠️ انقطع الاتصال، إعادة المحاولة تلقائياً…', lastDisconnect?.error?.message || '');
        }
      }
    });
  });

  console.log('⏳ (1/5) بدء الإقران…');
  await connected;
  console.log('✅ (2/5) الحالة: Connected —', sock.user?.id);

  const { pdfBuffer, thumb } = await buildSampleReport();

  console.log(`⏳ (5/5) الإرسال إلى ${digits} (الرقم نفسه فقط)…`);
  const sent = await sock.sendMessage(jid, {
    document: pdfBuffer,                 // بايتات الملف كما هي — بلا أي تعديل
    mimetype: 'application/pdf',
    fileName: 'sickLeaves.pdf',
    jpegThumbnail: thumb.buffer,         // المعاينة المموّهة، منفصلة عن الملف
  });

  console.log(`\n✅ تم الإرسال — معرّف الرسالة: ${sent?.key?.id}`);
  console.log('افتح واتساب وتحقّق يدوياً من أمرين:');
  console.log('  • المعاينة في المحادثة: غائمة');
  console.log('  • الملف عند فتحه: واضح 100% من اللحظة الأولى');
  console.log(`\nبعد الانتهاء: افصل الجهاز من واتساب واحذف المجلد ${AUTH_DIR}`);

  await new Promise((r) => setTimeout(r, 4000)); // امنح الرفع وقتاً للاكتمال
  process.exit(0);
})().catch((err) => {
  console.error('\n❌ فشل الاختبار:', err.message);
  process.exit(1);
});
