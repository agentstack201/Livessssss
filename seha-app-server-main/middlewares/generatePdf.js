const normalizeArabicToUnicode = require('./normalizeArabicToUnicode');
const { wrapName, wrapText } = require('./nameWrap');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// ── Asset embedding ────────────────────────────────────────────────────────
// Fonts and images are inlined as base64 data URIs so the print page makes ZERO
// network requests. This removes 7+ HTTP round-trips per render (4 fonts + 3
// logos + the external QR service) and lets Chromium print as soon as the DOM is
// parsed instead of waiting on the network. Each file is read from disk once and
// cached for the life of the process.
const _fileCache = new Map();
const MIME_BY_EXT = {
  '.ttf': 'font/ttf', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
};

function dataUriFromPublic(relPath) {
  const key = String(relPath).toLowerCase();
  if (_fileCache.has(key)) return _fileCache.get(key);
  try {
    const clean = String(relPath).replace(/^\/?public\//i, '').replace(/^\//, '');
    const abs = path.join(PUBLIC_DIR, clean);
    const buf = fs.readFileSync(abs);
    const mime = MIME_BY_EXT[path.extname(abs).toLowerCase()] || 'application/octet-stream';
    const uri = `data:${mime};base64,${buf.toString('base64')}`;
    _fileCache.set(key, uri);
    return uri;
  } catch (e) {
    console.warn('⚠️ Could not inline asset:', relPath, e.message);
    return '';
  }
}

// @font-face CSS with the TTFs inlined — built once.
let _fontFaceCss = null;
function fontFaceCss() {
  if (_fontFaceCss !== null) return _fontFaceCss;
  const face = (family, file, weight) => {
    const uri = dataUriFromPublic(`fonts/${file}`);
    return uri
      ? `@font-face{font-family:'${family}';src:url('${uri}') format('truetype');font-weight:${weight};font-style:normal;}`
      : '';
  };
  _fontFaceCss = [
    face('NotoSansArabic', 'NotoSansArabic-Bold.ttf', 700),
    face('NotoSansArabic', 'NotoSansArabic-Regular.ttf', 400),
    face('Amiri', 'Amiri-Bold.ttf', 700),
    face('Amiri', 'Amiri-Regular.ttf', 400),
  ].join('\n');
  return _fontFaceCss;
}

// Resolve the footer logo for an offline print page: keep http(s)/data URIs as
// they are, inline a local /public path, else fall back to the default logo.
function resolveFooterLogo(footerLogo) {
  if (footerLogo && (footerLogo.startsWith('http') || footerLogo.startsWith('data:'))) return footerLogo;
  if (footerLogo && footerLogo.includes('/public/')) return dataUriFromPublic(footerLogo.slice(footerLogo.indexOf('/public/')));
  if (footerLogo && footerLogo.startsWith('/')) return dataUriFromPublic(footerLogo);
  return dataUriFromPublic('images/1.png');
}

// ── Browser reuse ──────────────────────────────────────────────────────────
// Launching Chromium costs ~1-3s. We launch ONE browser for the whole process
// and reuse it, creating/closing only a page per request. It re-launches lazily
// if the browser crashed or disconnected.
let _browserPromise = null;

async function resolveLaunchOptions() {
  const useBundledChromium =
    !!process.env.VERCEL_ENV ||
    !!process.env.RENDER ||
    process.env.USE_BUNDLED_CHROMIUM === 'true';
  console.log('🌐 Chromium mode:', useBundledChromium ? 'bundled (@sparticuz)' : 'local puppeteer');

  let puppeteer;
  let launchOptions = { headless: true };

  if (useBundledChromium) {
    const chromium = (await import('@sparticuz/chromium')).default;
    puppeteer = await import('puppeteer-core');
    const https = require('https');
    const { execSync } = require('child_process');

    let executablePath;
    const customUrl = process.env.CHROMIUM_URL;
    if (customUrl) {
      const tmpDir = '/tmp/chromium';
      const tarPath = '/tmp/chromium.tar';
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
      await new Promise((resolve, reject) => {
        const file = fs.createWriteStream(tarPath);
        https.get(customUrl, (response) => {
          response.pipe(file);
          file.on('finish', () => { file.close(); resolve(); });
        }).on('error', (err) => { fs.unlinkSync(tarPath); reject(err); });
      });
      execSync(`tar -xf ${tarPath} -C ${tmpDir}`);
      executablePath = path.join(tmpDir, 'chromium');
      execSync(`chmod +x ${executablePath}`);
    } else {
      executablePath = await chromium.executablePath();
    }

    launchOptions = {
      headless: true,
      args: [
        ...chromium.args,
        '--disable-gpu', '--disable-dev-shm-usage', '--disable-setuid-sandbox',
        '--no-first-run', '--no-sandbox', '--no-zygote', '--single-process',
        '--font-render-hinting=none',
      ],
      executablePath,
    };
  } else {
    puppeteer = await import('puppeteer');
    launchOptions.args = ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'];
  }

  return { puppeteer, launchOptions };
}

async function getBrowser() {
  if (_browserPromise) {
    try {
      const b = await _browserPromise;
      const connected = typeof b.isConnected === 'function' ? b.isConnected() : b.connected;
      if (b && connected) return b;
    } catch { /* fall through and relaunch */ }
    _browserPromise = null;
  }
  _browserPromise = (async () => {
    const { puppeteer, launchOptions } = await resolveLaunchOptions();
    console.log('🚀 Launching browser (shared)...');
    const b = await puppeteer.launch(launchOptions);
    b.on('disconnected', () => { _browserPromise = null; });
    console.log('✅ Browser launched (shared)');
    return b;
  })();
  return _browserPromise;
}

module.exports = async (data, leave_days, DateObj, country) => {
  let page;

  try {
    console.log('🚀 Starting PDF generation...');
    console.log('📋 Data received:', {
      id: data.id,
      leave_id: data.leave_id,
      name: data.name_en,
      hospital: data.hospital_name_en
    });

    // All images are inlined as data URIs so the print page makes no network
    // requests. Logos are read from /public; a user-provided footer logo that is
    // already an http(s)/data URI is kept as-is.
    const sehaLogo = dataUriFromPublic('images/seha.jpg');
    const ksaLogo = dataUriFromPublic('images/saudia1.jpg');
    const designLogo = dataUriFromPublic('images/3.PNG');
    const nationalCenterLogo = dataUriFromPublic('images/national-center.jpg');
    const footerLogoSrc = resolveFooterLogo(data.footer_logo);
    const fontFaceInline = fontFaceCss();

    // عنوان الواجهة العامة. الافتراضي هو الموقع المنشور حتى لا يَطبع التقرير
    // رابط localhost إن لم تُضبط FRONTEND_URL على الخادم.
    const frontendUrl = process.env.FRONTEND_URL || 'https://slenglushuiry-seha-sa.vercel.app';

    // رابط واحد يستخدمه رمز الـ QR والرابط الظاهر أسفله معاً: صفحة الاستعلام
    // العامة ومعها رمز الخدمة ورقم الهوية، فتُملأ حقول الاستعلام تلقائياً عند
    // فتحه ولا يحتاج المستخدم إلا للضغط على «استعلام».
    const verificationUrl = `${frontendUrl}/inquiries/slenquiry?service_num=${encodeURIComponent(data.service_num || '')}&national_id=${encodeURIComponent(data.national_id || '')}`;
    const displayUrl = `${frontendUrl.replace(/^https?:\/\//, '')}/inquiries/slenquiry`;

    // QR اختياري: أي سجل قديم بلا قيمة add_qr يستمر بإظهار الـ QR كما كان
    // دائماً (السلوك الأصلي). لا يُعطَّل إلا إذا كانت القيمة false صراحةً.
    const includeQr = data.add_qr !== false;

    // Generate the QR locally (data URI) instead of calling the external
    // api.qrserver.com service on every render. الحجم كما هو (150px توليداً،
    // 90px عرضاً) فلا يتغيّر شكل التقرير.
    let qrDataUri = '';
    if (includeQr) {
      try {
        qrDataUri = await QRCode.toDataURL(verificationUrl, { margin: 1, width: 150, errorCorrectionLevel: 'M' });
      } catch (qrErr) {
        console.warn('⚠️ QR generation failed (continuing without QR):', qrErr.message);
      }
    }

    // ------------------------------------------------------------------
    // Presentation helpers — kept byte-for-byte in sync with the on-screen
    // preview component (frontend: src/components/SickLeavePDFOriginal.jsx).
    // The PDF MUST render identically to that preview; only the rendering
    // engine changes (Chromium page.pdf -> true vector, selectable text).
    // ------------------------------------------------------------------
    const padTwo = (value) => String(value).padStart(2, '0');

    // Gregorian date -> DD-MM-YYYY
    const formatDate = (dateString) => {
      if (!dateString) return '';
      const parts = String(dateString).split('-');
      if (parts.length === 3) {
        const [year, month, day] = parts;
        return `${padTwo(day)}-${padTwo(month)}-${year}`;
      }
      return dateString;
    };

    // Hijri date -> zero-padded, delimiter preserved
    const formatHijriDate = (dateString) => {
      if (!dateString) return '';
      const delimiter = String(dateString).includes('/') ? '/' : '-';
      const parts = String(dateString).split(delimiter);
      if (parts.length >= 3) {
        return parts
          .map((part) => (isNaN(part) ? part : padTwo(part)))
          .join(delimiter);
      }
      return dateString;
    };

    // Prefer the values stored with the leave (what the preview shows),
    // falling back to the freshly formatted timestamp.
    const currentTime = data.report_time || (DateObj && DateObj.currentTime) || '';
    const currentDate = data.report_date || (DateObj && DateObj.currentDate) || '';

    // The two nationality columns must agree. They used to fall back
    // independently — Arabic to the free-text nationality, English to the
    // literal 'Saudi' — so a custom entry printed as English "Saudi" next to
    // Arabic "مقيم نازح". When the country row cannot be resolved, only the
    // Arabic value is trustworthy, so English mirrors it rather than inventing
    // a nationality that contradicts it.
    const countryNameAr = (country && country.country_name_ar) || data.nationality || 'سعودي';
    const countryNameEn = (country && country.country_name_en)
      || (countryNameAr === 'سعودي' || countryNameAr === 'السعودية' ? 'Saudi' : countryNameAr);

    // Reuse the shared browser (launched once for the whole process) and open a
    // fresh page for this render. Only the page is closed afterwards.
    const browser = await getBrowser();
    page = await browser.newPage();

    // Set viewport for A4 size (794x1123 css px @96dpi). deviceScaleFactor
    // only affects raster capture; page.pdf() output stays vector regardless.
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
    console.log('✅ Page created with A4 viewport');

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>sick leaves</title>
<style>
  /* Inlined fonts (base64 data URIs) for deterministic, network-independent
     rendering. Identical TTFs to the frontend preview (Noto Sans Arabic + Amiri). */
  ${fontFaceInline}

  /* A4, zero margin — matches the 210mm x 297mm preview container exactly. */
  @page { size: A4; margin: 0; }

  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

      html, body {
        width: 210mm;
        height: 297mm;
      }
      body {
        font-family: "NotoSansArabic", sans-serif;
        /* الجسم بعرض الصفحة نفسه (210mm)، فأي هامش أفقي يزيحه عن مركزها
           ويقصّ الطرف الآخر. الهامش الأيسر كان 20px والأيمن صفراً، فكان
           المستند كله منزاحاً 20px إلى اليمين. صفر يعيده إلى المنتصف. */
        margin: 0px 0px 20px 0px;
        max-height: 297mm;
        height: 297mm;
        overflow: hidden;
        page-break-inside: avoid;
        box-sizing: border-box;
      }
      Top-head {
        text-align: center;
      }
      h3 {
        color: #3773b9;
        text-align: center;
      }
      .dark-head {
        color: #2b3d77;
        font-size: 19px;
        font-family: 'Amiri', serif;
        font-weight: 700;
      }
        .custom-table {
          width: 93%;
          margin: auto;
          margin-top: 10px;
          border-collapse: separate;
          border-spacing: 0;
          border: 1px solid #dee2e6;
          border-radius: 8px;
          background-color: white;
          overflow: hidden;
        }
        .custom-table td {
          padding: 5px 7px;
          font-size: 14px;
          text-align: center;
          border: 1px solid #d0d0d0;
          vertical-align: middle;
          background-color: white;
        }

        .en-text {
          font-family: 'Amiri', serif;
        }

        .ar-text {
          font-family: "NotoSansArabic", sans-serif;
        }

        .ar-date {
          font-family: 'Amiri', serif;
        }
          .vertical-line{
          width:1.5px;
          height:190px ;
          background-color:rgb(221, 221, 221) ;
          }

      .custom-table tr:first-child td {
        background-color: white !important;
        border: 1px solid #dee2e6;
      }

      .custom-table tr:first-child td:first-child {
        border-left: 1px solid #dee2e6;
        border-top: 1px solid #dee2e6;
        border-radius: 8px 0px 0px 0px;
      }

      .custom-table tr:first-child td:last-child {
        border-right: 1px solid #dee2e6;
        border-top: 1px solid #dee2e6;
        border-radius: 0px 8px 0px 0px;
      }

      .custom-table tr:last-child td:first-child {
        border-left: 1px solid #dee2e6;
        border-bottom: 1px solid #dee2e6;
        border-radius: 0px 0px 0px 8px;
      }
      .custom-table tr:last-child td:last-child {
        border-right: 1px solid #dee2e6;
        border-bottom: 1px solid #dee2e6;
        border-radius: 0px 0px 8px 0px;
      }

      .custom-table tr:first-child .one {
        font-weight: bold;
      }

      .custom-table tr:first-child .two {
        font-weight: 400;
      }

      .custom-table .one {
        width: 130px;
        min-width: 130px;
        color: #366fb4 !important;
        font-weight: 700;
        padding: 6px 0px;
        font-size: 13.5px;
      }

      .custom-table .two {
        color: #2b3d77 !important;
        font-size: 14px;
        font-weight: 400;
        line-height: 1.1;
        padding-top: 4px;
        padding-bottom: 4px;
        /* اسم طويل جداً بلا مسافات: يلتف على السطر بدل الخروج من الخلية،
           دون كسر الكلمات العادية (يبقى الالتفاف على حدود الكلمة أولاً). */
        overflow-wrap: break-word;
        word-break: normal;
      }
      /* وحدة لا تنكسر: أداة وصل مربوطة بالاسم الذي تخصّه (انظر nameWrap.js). */
      .nb {
        white-space: nowrap;
      }
      /* كلمة واحدة أطول من أي عمود. مع break-word وحدها يبقى «أقلّ عرض ممكن»
         للعمود = طول الكلمة كاملة، فيتمدّد الجدول أعرض من الصفحة ويضغط
         Chromium الصفحة كلها لتصغر (نص مجهري ونِسَب مشوّهة). قيمة anywhere
         تجعل الكسر محسوباً ضمن أقلّ عرض للعمود فيبقى الجدول داخل A4 — ولا
         تُوضع إلا على الكلمات الطويلة وحدها، فلا تتأثر أي بيانات عادية. */
      .brk {
        overflow-wrap: anywhere;
      }
      /* خلية اسم: توزيع الكلمات على الأسطر بالتساوي بدل ملء السطر الأول ثم
         ترك اللقب وحده في السطر التالي («... MOHAMMED / ALSHAHRANY»). المتصفّح
         يوازن بين الأسطر مع احترام الوحدات التي لا تنكسر أعلاه، فلا يتغيّر حجم
         الخط ولا عرض الخلية، وعدد الأسطر يبقى كما هو (الارتفاع يتكيّف طبيعياً
         عند الحاجة). المحرّك الذي لا يعرف balance يقع على pretty ثم على
         الالتفاف العادي — والوحدات تبقى محمية في الحالتين. */
      .name-cell {
        text-wrap: pretty;
        text-wrap: balance;
      }
      .darkBg {
        background-color: #f7f7f7 !important;
      }

      .darkBg td {
        background-color: #f7f7f7 !important;
      }
      .boldTit {
         font-weight: 700;
        font-size: 14px;
      }
      .leave-duration {
        background-color: #2b3d76;
        color: #a8b9e0 !important;
        font-weight: 700;
      }

      .leave-duration td {
        font-size: 11px;
        background-color: #2b3d76 !important;
        color: #a8b9e0 !important;
      }

      .leave-duration .one {
        color: #ffffff !important;
      }

      .leave-duration .two {
        color: #ffffff !important;
      }
      /* خلية العنوان العربي (آخر عمود) هي التي تحدّد ارتفاع كل صف: سطر الخط
         العربي وحده ٣٠px عند حجم ١٣px، فيصير الصف ٣٠+٦+٦ = ٤٢px. قياس المستند
         المرجعي أظهر صفوفه أقصر من صفوفنا، فخُفّض الحشو الرأسي بكسلاً واحداً من
         كل جهة (٤٠px) ليطابقه. لا يمسّ هذا حجم الخط ولا عرض الأعمدة ولا ترتيبها. */
      .custom-table tbody tr td:last-child {
        padding: 5px 4px;
      }

      .custom-table tbody tr td:last-child.ar-text {
        font-weight: 700;
        font-size: 13px;
      }

      .custom-table tbody tr .two.ar-text {
        font-weight: 400 !important;
        font-size: 14px;
      }

      .custom-table tbody tr .ar-text:not(.one) {
        font-weight: 400 !important;
      }

      .custom-table tbody tr td:nth-child(2),
      .custom-table tbody tr td:nth-child(3) {
        width: 50%;
      }
      .transparnt-bg td {
        background-color: transparent !important;
      }
      .header-logos {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding: 10px 20px;
        padding-top: 36px;
        background-color: #fff;
      }

      .logo-seha {
        flex: 1;
        display: flex;
        justify-content: flex-start;
        align-items: flex-start;
        margin-top: -8px;
      }

      .logo-ksa {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
        padding-top: 20px;
      }

      .logo-ksa img {
        margin-bottom: -4px;
      }

      .logo-ksa .english-text {
        font-size: 15px;
        font-weight: 400;
        color: #000;
        margin: 0;
        text-align: center;
        font-family: 'Amiri', serif;
      }

      .logo-design {
        flex: 1;
        display: flex;
        justify-content: flex-end;
        align-items: flex-start;
      }


         .pdf-footer-section {
      display: flex;
      justify-content: space-between;

    }
    .qr-section {
      text-align: center;
      position: relative;
      margin-top: 21px;
      margin-right: -93px;
      flex: 1;
    }
        .qr-section a {
        position: absolute;
        bottom: 10;
        right:25% ;
    }
    /* إخفاء الـ QR لا يعني تحريك ما تحته: هذا المُباعد يشغل نفس صندوق الصورة
       (ارتفاع 90px، سطر داخلي محاذٍ لخط القاعدة) بعرض صفر، فيبقى نص التحقق
       والرابط والطابع الزمني عند إحداثياتها نفسها بالضبط كما في المستند
       المرجعي — يختفي الرمز وحده ولا يتغيّر أي شيء آخر في التذييل. */
    .qr-placeholder {
      display: inline-block;
      height: 90px;
      width: 0;
    }


    .logo-section {
      display: flex;
      flex-direction: column;
      margin-top : 18px !important;
      flex: 1;
      margin-left: 65px;
      }

    .logo-section .text {
      font-size: 12px;
      text-align: right;

    }
    .timestamp {
      font-size: 13px;
      font-weight: 700;
      color: #000000;

    }
      .leave-report{
        font-size: 22px;
        color: #2f6db4;
        font-weight: 700;
      }

      .vertical-line{
      margin-top: 10px !important;
      margin-left: 174px;
      margin-right: 5px;
      flex-shrink: 0;
      }


      @media print {
        body, .Top-head, .custom-table, .footer-section {
          page-break-inside: avoid !important;
          page-break-after: avoid !important;
        }
      }
    </style>

    </head>
    <body>
   <div class="Top-head">
      <div class="header-logos">
        <div class="logo-seha">
          <img style="height: 80px; width: auto;" src='${sehaLogo}' alt="seha logo"/>
        </div>
        <div class="logo-ksa">
          <img style="height: 54px; width: auto;" src='${ksaLogo}' alt="KSA Logo" />
          <div class="english-text">Kingdom of Saudi Arabia</div>
        </div>
        <div class="logo-design">
          <img style="height: 100px; width: auto;margin-right: 10px;" src='${designLogo}' alt="design Logo" />
        </div>
      </div>
      <div style="text-align: center; margin-top: -5px;">
        <h3 class='leave-report' style="margin: 0px; padding: 0px; margin-bottom: -5px;">تقرير إجازة مرضية</h3>
        <div class="dark-head" style="margin: 0px; padding: 0px;">Sick Leave Report</div>
      </div>

    </div>
   <table class="custom-table">
<tbody>
  <tr class="transparnt-bg">
    <td class="one en-text" colspan="1">Leave ID</td>
    <td class="two en-text" colspan="2">${wrapText(data.leave_id)}</td>
    <td class="one ar-text" colspan="1">رمز الإجازة</td>
  </tr>
  <tr class="leave-duration">
    <td class="one en-text">Leave Duration</td>
    <td class="two en-text">${leave_days} ${leave_days > 1 ? 'days' : 'day'} ( ${formatDate(data.admission_date_en) || ''} to ${formatDate(data.discharge_date_en) || ''} )</td>
    <td class="two ar-text" style="direction: rtl;"><span class="ar-date">${leave_days}</span> ${leave_days > 1 ? 'أيام' : 'يوم'} (<span class="ar-date" dir="ltr">${formatHijriDate(data.admission_date_ar) || ''}</span> الى <span class="ar-date" dir="ltr">${formatHijriDate(data.discharge_date_ar) || ''}</span>) </td>
    <td class="one ar-text">مدة الإجازة</td>
  </tr>
  <tr>
    <td class="one en-text">Admission Date</td>
    <td class="two en-text">${formatDate(data.admission_date_en) || ''}</td>
    <td class="two en-text">${formatHijriDate(data.admission_date_ar) || ''}</td>
    <td class="one ar-text">تاريخ الدخول</td>
  </tr>
  <tr class="darkBg">
    <td class="one en-text">Discharge Date</td>
    <td class="two en-text">${formatDate(data.discharge_date_en) || ''}</td>
    <td class="two en-text">${formatHijriDate(data.discharge_date_ar) || ''}</td>
    <td class="one ar-text">تاريخ الخروج</td>
  </tr>
  <tr>
    <td class="one en-text" colspan="1">Issue Date</td>
    <td class="two en-text" colspan="2">${formatDate(data.issue_date) || ''}</td>
    <td class="one ar-text" colspan="1">تاريخ إصدار التقرير</td>
  </tr>
  <tr class="darkBg">
    <td class="one en-text">Name</td>
    <td class="two en-text name-cell">${wrapName((data.name_en || '').toUpperCase())}</td>
    <td class="two ar-text name-cell">${wrapName(data.name_ar)}</td>
    <td class="one ar-text">الاسم</td>
  </tr>
  <tr>
    <td class="one en-text" colspan="1">National ID / Iqama</td>
    <td class="two en-text" colspan="2">${wrapText(data.national_id)}</td>
    <td class="one ar-text" colspan="1">رقم الهوية / الإقامة</td>
  </tr>
  <tr class="darkBg">
    <td class="one en-text">Nationality</td>
    <td class="two en-text">${wrapText(countryNameEn)}</td>
    <td class="two ar-text">${wrapText(countryNameAr)}</td>
    <td class="one ar-text">الجنسية</td>
  </tr>
  <tr>
    <td class="one en-text">Employer</td>
    <td class="two en-text">${''}</td>
    <td class="two ar-text">${wrapText(data.employer_ar)}</td>
    <td class="one ar-text">جهة العمل</td>
  </tr>
  <tr class="darkBg">
    <td class="one en-text">Physician Name</td>
    <td class="two en-text name-cell">${wrapName((data.physician_name_en || '').toUpperCase())}</td>
    <td class="two ar-text name-cell">${wrapName(data.physician_name_ar)}</td>
    <td class="one ar-text">اسم الممارس</td>
  </tr>
  <tr>
    <td class="one en-text">Position</td>
    <td class="two en-text">${wrapText(data.position_en)}</td>
    <td class="two ar-text">${wrapText(data.position_ar)}</td>
    <td class="one ar-text">المسمى الوظيفى</td>
  </tr>
</tbody>

      </table>

<div class="pdf-footer-section" >
    <!-- QR Code Section -->
    <div class="qr-section">
    <div style="margin-left: 45px !important;">
             ${includeQr
               ? `<img style="height: 90px;margin:0px " src="${qrDataUri}" alt="QR Code">`
               : `<span class="qr-placeholder"></span>`}

      <p class="ar-text" style='margin:0px ;margin-top : -5px !important ; font-size:10px !important; font-weight: 900 !important; color: #000;' >للتحقق من بيانات التقرير يرجى التأكد من زيارة موقع منصة صحة الرسمي</p>
      <p class="en-text" style='margin:0px ; font-size:10px !important; font-weight: 900 !important; color: #000;' >To check the report please visit Seha's official website</p>


<a class="en-text"
           style="margin: 0px; margin-top : 7px !important ; font-size: 10px; font-weight: 900 !important; color:blue; text-decoration: underline;"
          href='${verificationUrl}'
          target="_blank">www.seha.sa/#/inquiries/slenquiry</a>
    </div>
      <!-- Timestamp -->
  <div class="timestamp">
  <div style="margin-top: 46px !important; text-align:left !important ;  margin-left: 26px !important;">
      <p class="en-text" style='margin:0px;font-size:13px !important;font-weight: 700 !important;'>${currentTime}</p>
    <p class="en-text" style='margin:0px;font-size:13px !important;font-weight: 700 !important;'>${currentDate}</p></div>


  </div>




      </div>
    <div class="vertical-line"></div>
    <!-- Logo Section -->
    <div class="logo-section" >
      <div style="text-align: center; margin-right: 80px;">
        <img style="height: 100px ;" src='${footerLogoSrc}' alt="Ministry of Health Logo">
        <div style="line-height: 1.5; margin-top: 0px;">
          <p class="ar-text" style="margin: 0px; font-size: 12.8px; font-weight: 900;font-weight: bold !important;color: #000;">${wrapText(data.hospital_name_ar || 'مستشفى النور التخصصي')}</p>
          <p class="en-text" style="margin: 0px; font-size: 12.8px; font-weight: 900;font-weight: bold !important;color: #000;">${wrapText(data.hospital_name_en || 'AL NOOR SPECIALIST HOSPITAL')}</p>
          ${data.show_license_number !== false ? `<p class="ar-text" style="margin: 0px; font-size: 12px; font-weight: 900;color: #000;">رقم الترخيص: <span class="ar-date">${wrapText(data.license_number || '1410845906')}</span></p>` : ''}
        </div>
      </div>
      <div>
        <img style="width: 140px; height: 90px ;margin-left: 147px !important; margin-top:30px !important;" src='${nationalCenterLogo}' alt="National Health Logo">
      </div>
    </div>
  </div>


    </body>
    </html>
  `;

    console.log('📄 Setting HTML content...');
    // All fonts/images/QR are inline data URIs now, so there is no network to
    // wait on — 'load' fires as soon as the DOM and inline resources are parsed,
    // which is far faster (and can't hang) compared to 'networkidle0'.
    await page.setContent(htmlContent, { waitUntil: 'load', timeout: 30000 });
    console.log('✅ HTML content loaded');

    // Ensure web fonts are fully parsed & ready before printing, otherwise
    // Chromium may lay text out with a fallback font (layout shift / wrong glyphs).
    try {
      await page.evaluateHandle('document.fonts.ready');
      console.log('✅ Fonts ready');
    } catch (fontErr) {
      console.warn('⚠️ document.fonts.ready wait failed (continuing):', fontErr.message);
    }

    // Generate a TRUE vector PDF (selectable/searchable text, embedded subset
    // fonts, correct ToUnicode). preferCSSPageSize honours the @page A4/0-margin
    // rule so the output matches the 210x297mm preview 1:1.
    console.log('🖨️ Generating PDF buffer...');
    const pdfBuffer = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      format: "A4",
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
      pageRanges: '1',
      tagged: true,   // emit the accessibility structure tree + ActualText /
                      // ReversedChars spans so screen readers and compliant
                      // viewers get correct logical-order, base-Unicode Arabic.
      timeout: 30000
    });
    console.log('✅ PDF buffer generated:', pdfBuffer.length, 'bytes');

    // Close only the page — the shared browser stays alive for the next request.
    await page.close();
    page = null;
    console.log('✅ Page closed (browser kept alive)');

    // Normalize the Arabic /ToUnicode layer (presentation forms -> base
    // letters) so Arabic copy / search / translation work cleanly. This is a
    // text-layer-only transform: 0 drawing operators are touched, so the PDF
    // stays 100% visually identical. Fails open (returns the original buffer)
    // if the PDF isn't the expected shape.
    let finalBuffer = pdfBuffer;
    try {
      finalBuffer = normalizeArabicToUnicode(pdfBuffer);
      console.log('✅ Arabic ToUnicode normalized:', finalBuffer.length, 'bytes');
    } catch (normErr) {
      console.warn('⚠️ Arabic normalization skipped:', normErr.message);
      finalBuffer = pdfBuffer;
    }

    // Return the PDF buffer directly
    return finalBuffer;
  } catch (error) {
    console.error('❌ PDF Generation Error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    // Close only the failed page; keep the shared browser alive so one bad
    // render doesn't take down PDF generation for every other request.
    if (page) {
      try {
        await page.close();
        console.log('✅ Page closed after error');
      } catch (closeError) {
        console.error('❌ Error closing page:', closeError.message);
      }
    }
    throw new Error(`Failed to generate PDF: ${error.message}`);
  }
};

// ── Shared internals ───────────────────────────────────────────────────────
// Sibling templates (e.g. the Companion Statement of Visit) render through the
// SAME asset inliner, font faces and — importantly — the SAME shared Chromium
// instance. Exposing them here keeps one browser per process instead of one per
// template. Nothing above is modified: this only publishes existing helpers.
module.exports._internals = {
  dataUriFromPublic,
  fontFaceCss,
  resolveFooterLogo,
  getBrowser,
};
