// ───────────────────────────────────────────────────────────────────────────
// قالب «مشهد مراجعة لمرافق» — Companion Statement of Visit
//
// نسخة موازية تماماً لـ generatePdf.js (تقرير الإجازة المرضية): نفس المتصفح
// المشترك، نفس الخطوط والصور المضمّنة (base64)، نفس page.pdf() المتجه، ونفس
// تطبيع طبقة ToUnicode العربية. الفرق الوحيد هو جدول الحقول وعنوان التقرير.
//
// لا يستدعي هذا الملف أي تعديل على قالب الإجازة المرضية، ولا يُستخدم إلا عندما
// يكون document_type = 'companion_visit'.
// ───────────────────────────────────────────────────────────────────────────
const normalizeArabicToUnicode = require('./normalizeArabicToUnicode');
const QRCode = require('qrcode');

// إعادة استخدام أدوات القالب الأصلي (نفس المتصفح المشترك ونفس الأصول المضمّنة).
const { _internals } = require('./generatePdf');
const { dataUriFromPublic, fontFaceCss, resolveFooterLogo, getBrowser } = _internals;

// دوال التنسيق مشتركة مع قالب «مشهد مراجعة» — استُخرجت إلى documentFormat.js
// بنفس تطبيقها السابق حرفياً، فلا يتغيّر أي مخرَج من هذا القالب.
const {
  formatDate,
  formatHijriDate,
  formatTime12,
  arabicMeridiem,
  waitingPeriod,
} = require('./documentFormat');
const { wrapName } = require('./nameWrap');

module.exports = async (data, leave_days, DateObj, country) => {
  let page;

  try {
    console.log('🚀 Starting companion-visit PDF generation...');

    const sehaLogo = dataUriFromPublic('images/seha.jpg');
    const ksaLogo = dataUriFromPublic('images/saudia1.jpg');
    const designLogo = dataUriFromPublic('images/3.PNG');
    const nationalCenterLogo = dataUriFromPublic('images/national-center.jpg');
    const footerLogoSrc = resolveFooterLogo(data.footer_logo);
    const fontFaceInline = fontFaceCss();

    // نفس منطق قالب الإجازة المرضية بالحرف: رابط واحد للـ QR وللرابط الظاهر
    // أسفله، يحمل رمز الخدمة ورقم الهوية فتُملأ حقول الاستعلام تلقائياً.
    const frontendUrl = 'https://slenutglushuiry-seha-sa.vercel.app';
    const verificationUrl = `${frontendUrl}/inquiries/slenquiry?service_num=${encodeURIComponent(data.service_num || '')}&national_id=${encodeURIComponent(data.national_id || '')}`;

    let qrDataUri = '';
    try {
      qrDataUri = await QRCode.toDataURL(verificationUrl, { margin: 1, width: 150, errorCorrectionLevel: 'M' });
    } catch (qrErr) {
      console.warn('⚠️ QR generation failed (continuing without QR):', qrErr.message);
    }

    const currentTime = data.report_time || (DateObj && DateObj.currentTime) || '';
    const currentDate = data.report_date || (DateObj && DateObj.currentDate) || '';

    const countryNameAr = (country && country.country_name_ar) || data.nationality || 'سعودي';
    const countryNameEn = (country && country.country_name_en)
      || (countryNameAr === 'سعودي' || countryNameAr === 'السعودية' ? 'Saudi' : countryNameAr);

    const admissionTimeEn = formatTime12(data.admission_time);
    const dischargeTimeEn = formatTime12(data.discharge_time);
    const admissionTimeAr = admissionTimeEn ? `${admissionTimeEn.replace(/\s*(AM|PM)$/i, '')} ${arabicMeridiem(data.admission_time)}` : '';
    const dischargeTimeAr = dischargeTimeEn ? `${dischargeTimeEn.replace(/\s*(AM|PM)$/i, '')} ${arabicMeridiem(data.discharge_time)}` : '';

    const admissionEn = [formatDate(data.admission_date_en), admissionTimeEn].filter(Boolean).join(' - ');
    const dischargeEn = [formatDate(data.discharge_date_en), dischargeTimeEn].filter(Boolean).join(' - ');
    const admissionAr = [formatHijriDate(data.admission_date_ar), admissionTimeAr].filter(Boolean).join(' - ');
    const dischargeAr = [formatHijriDate(data.discharge_date_ar), dischargeTimeAr].filter(Boolean).join(' - ');

    const waiting = waitingPeriod(
      data.admission_date_en, data.admission_time,
      data.discharge_date_en, data.discharge_time
    );

    const browser = await getBrowser();
    page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>companion statement of visit</title>
<style>
  ${fontFaceInline}

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

      /* هذا القالب وحده يحمل أطول عناوين الأعمدة (Admission Date/Time و
         Discharge Date/Time). عند 13.5px يبلغ عرض العنوان 127.5px داخل خلية
         عرضها 130px بلا حشو أفقي، فيكاد يلتصق بحدّي الخلية. 12.5px يترك 6px
         على كل جهة. عرض العمود وترتيبه ولونه كما هي. */
      .custom-table .one {
        width: 130px;
        min-width: 130px;
        color: #366fb4 !important;
        font-weight: 700;
        padding: 6px 0px;
        font-size: 12.5px;
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
      /* وحدة لا تنكسر: كلمات الاسم المرتبطة منطقياً تنتقل معاً (انظر nameWrap.js). */
      .nb {
        white-space: nowrap;
      }
      /* كلمة واحدة أطول من أي عمود: يُسمح بالكسر داخلها وحدها حتى لا يتمدّد
         الجدول أعرض من الصفحة. */
      .brk {
        overflow-wrap: anywhere;
      }
      /* خلية اسم: توزيع الكلمات على الأسطر بالتساوي بدل ملء السطر الأول ثم
         ترك اللقب وحده في السطر التالي. حجم الخط وعرض الخلية وعدد الأسطر كما هي. */
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
      /* الصفوف الثلاثة الزرقاء الداكنة: الدخول، الخروج، فترة الانتظار */
      .navy-row td {
        background-color: #2b3d76 !important;
        color: #ffffff !important;
      }

      .navy-row .one {
        color: #ffffff !important;
      }

      .navy-row .two {
        color: #ffffff !important;
      }
      .custom-table tbody tr td:last-child {
        padding: 6px 4px;
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
        <h3 class='leave-report' style="margin: 0px; padding: 0px; margin-bottom: -5px;">مشهد مراجعة لمرافق</h3>
        <div class="dark-head" style="margin: 0px; padding: 0px;">Companion Statement of Visit</div>
      </div>

    </div>
   <table class="custom-table">
<tbody>
  <tr class="transparnt-bg">
    <td class="one en-text" colspan="1">Leave ID</td>
    <td class="two en-text" colspan="2">${data.leave_id || ''}</td>
    <td class="one ar-text" colspan="1">رمز الإجازة</td>
  </tr>
  <tr class="navy-row">
    <td class="one en-text">Admission Date/Time</td>
    <td class="two en-text">${admissionEn}</td>
    <td class="two ar-text" style="direction: rtl;">${admissionAr}</td>
    <td class="one ar-text">تاريخ / وقت الدخول</td>
  </tr>
  <tr class="navy-row">
    <td class="one en-text">Discharge Date/Time</td>
    <td class="two en-text">${dischargeEn}</td>
    <td class="two ar-text" style="direction: rtl;">${dischargeAr}</td>
    <td class="one ar-text">تاريخ / وقت الخروج</td>
  </tr>
  <tr class="navy-row">
    <td class="one en-text">Waiting Period</td>
    <td class="two en-text">${waiting.en}</td>
    <td class="two ar-text" style="direction: rtl;">${waiting.ar}</td>
    <td class="one ar-text">فترة الانتظار</td>
  </tr>
  <tr>
    <td class="one en-text" colspan="1">Issue Date</td>
    <td class="two en-text" colspan="2">${formatDate(data.issue_date) || ''}</td>
    <td class="one ar-text" colspan="1">تاريخ إصدار التقرير</td>
  </tr>
  <tr class="darkBg">
    <td class="one en-text">Companion Name</td>
    <td class="two en-text name-cell">${wrapName((data.name_en || '').toUpperCase())}</td>
    <td class="two ar-text name-cell">${wrapName(data.name_ar)}</td>
    <td class="one ar-text">اسم المرافق</td>
  </tr>
  <tr>
    <td class="one en-text" colspan="1">National ID / Iqama</td>
    <td class="two en-text" colspan="2">${data.national_id || ''}</td>
    <td class="one ar-text" colspan="1">رقم الهوية / الإقامة</td>
  </tr>
  <tr class="darkBg">
    <td class="one en-text">Nationality</td>
    <td class="two en-text">${countryNameEn}</td>
    <td class="two ar-text">${countryNameAr}</td>
    <td class="one ar-text">الجنسية</td>
  </tr>
  <tr>
    <td class="one en-text">Relation</td>
    <td class="two en-text">${data.relation_en || ''}</td>
    <td class="two ar-text">${data.relation_ar || ''}</td>
    <td class="one ar-text">صلة القرابة</td>
  </tr>
  <tr class="darkBg">
    <td class="one en-text">Employer</td>
    <td class="two en-text">${''}</td>
    <td class="two ar-text">${data.employer_ar || ''}</td>
    <td class="one ar-text">جهة العمل</td>
  </tr>
  <tr>
    <td class="one en-text">Practitioner Name</td>
    <td class="two en-text name-cell">${wrapName((data.physician_name_en || '').toUpperCase())}</td>
    <td class="two ar-text name-cell">${wrapName(data.physician_name_ar)}</td>
    <td class="one ar-text">اسم الممارس الصحي</td>
  </tr>
  <tr class="darkBg">
    <td class="one en-text">Position</td>
    <td class="two en-text">${data.position_en || ''}</td>
    <td class="two ar-text">${data.position_ar || ''}</td>
    <td class="one ar-text">المسمى الوظيفى</td>
  </tr>
  <tr>
    <td class="one en-text">Visit Type</td>
    <td class="two en-text">${data.visit_type_en || ''}</td>
    <td class="two ar-text">${data.visit_type_ar || ''}</td>
    <td class="one ar-text">نوع الزيارة</td>
  </tr>
</tbody>

      </table>

<div class="pdf-footer-section" >
    <!-- QR Code Section -->
    <div class="qr-section">
    <div style="margin-left: 45px !important;">
             <img style="height: 90px;margin:0px " src="${qrDataUri}" alt="QR Code">

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
        <img style="height: 100px ;" src='${footerLogoSrc}' alt="Health Facility Logo">
        <div style="line-height: 1.5; margin-top: 0px;">
          <p class="ar-text" style="margin: 0px; font-size: 12.8px; font-weight: 900;font-weight: bold !important;color: #000;">${data.hospital_name_ar || 'مستشفى النور التخصصي'}</p>
          <p class="en-text" style="margin: 0px; font-size: 12.8px; font-weight: 900;font-weight: bold !important;color: #000;">${data.hospital_name_en || 'AL NOOR SPECIALIST HOSPITAL'}</p>
          ${data.show_license_number !== false ? `<p class="ar-text" style="margin: 0px; font-size: 12px; font-weight: 900;color: #000;">رقم الترخيص: <span class="ar-date">${data.license_number || '1410845906'}</span></p>` : ''}
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

    await page.setContent(htmlContent, { waitUntil: 'load', timeout: 30000 });

    try {
      await page.evaluateHandle('document.fonts.ready');
    } catch (fontErr) {
      console.warn('⚠️ document.fonts.ready wait failed (continuing):', fontErr.message);
    }

    const pdfBuffer = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      format: "A4",
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
      pageRanges: '1',
      tagged: true,
      timeout: 30000
    });
    console.log('✅ Companion PDF buffer generated:', pdfBuffer.length, 'bytes');

    await page.close();
    page = null;

    let finalBuffer = pdfBuffer;
    try {
      finalBuffer = normalizeArabicToUnicode(pdfBuffer);
    } catch (normErr) {
      console.warn('⚠️ Arabic normalization skipped:', normErr.message);
      finalBuffer = pdfBuffer;
    }

    return finalBuffer;
  } catch (error) {
    console.error('❌ Companion PDF Generation Error:', error);
    if (page) {
      try {
        await page.close();
      } catch (closeError) {
        console.error('❌ Error closing page:', closeError.message);
      }
    }
    throw new Error(`Failed to generate companion PDF: ${error.message}`);
  }
};
