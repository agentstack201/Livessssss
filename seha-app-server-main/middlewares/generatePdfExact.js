module.exports = async (data, leave_days, DateObj, country) => {
  let browser;

  try {
    const frontendUrl = 'https://slenutglushuiry-seha-sa.vercel.app';
    const verificationUrl = `${frontendUrl}/inquiries/slenquiry?service_num=${data.service_num}&national_id=${data.national_id}`;
    const displayUrl = `${frontendUrl.replace(/^https?:\/\//, '')}/inquiries/slenquiry`;

    // Check if running on Vercel/serverless
    const isVercel = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;

    if (isVercel) {
      // Production: Use Sparticuz Chromium for Vercel
      const chromium = require("@sparticuz/chromium");
      const puppeteer = require("puppeteer-core");

      browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
      });
    } else {
      // Development: Use local Puppeteer
      const puppeteer = require("puppeteer");
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }

    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123 });

    const htmlContent = `
     <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>sick leaves</title>
            <link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@200..1000&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap" rel="stylesheet">
<style>

  @font-face {
          font-family: 'NotoSansArabic';
          src: url('${process.env.SERVER_HOST}/public/fonts/NotoSansArabic-Bold.ttf') format('truetype');
          font-weight: 700;
          font-style: normal;
        }
        
        @font-face {
          font-family: 'NotoSansArabic';
          src: url('${process.env.SERVER_HOST}/public/fonts/NotoSansArabic-Regular.ttf') format('truetype');
          font-weight: 400;
          font-style: normal;
        }
      body {
font-family: "NotoSansArabic", sans-serif;
        margin: 0px 0px 20px 20px;
      
       
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
        font-size: 18px;
        font-family: 'Amiri', serif;
        font-weight: 700;
      }
        .custom-table {
          width: 95%;
          margin: auto;
          margin-right: 35px;
          margin-top: 30px;
          border-collapse: separate;
          border-spacing: 0;
          border: 2px solid #dcdcdc;
          background-color: #dfdfdf;
          overflow: hidden;
        }
        .custom-table td {
          padding: 0px 0px;
          font-size: 13px;
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
          .vertical-line{
          width:1.5px;
          height:160px ;
          background-color:rgb(221, 221, 221) ;
          }



      .custom-table tr:first-child td {
        background-color: white !important;
        border: 1px solid #dfdfdf;
      }
      
      .custom-table tr:first-child td:first-child {
        border-left: 2px solid #dfdfdf;
        border-top: 2px solid #dfdfdf;
        border-radius: 8px 0px 0px 0px;
      }
      
      .custom-table tr:first-child td:last-child {
        border-right: 2px solid #dfdfdf;
        border-top: 2px solid #dfdfdf;
        border-radius: 0px 8px 0px 0px;
      }
      
      .custom-table tr:last-child td:first-child {
        border-left: 2px solid #dfdfdf;
        border-bottom: 2px solid #dfdfdf;
        border-radius: 0px 0px 0px 8px;
      }
      .custom-table tr:last-child td:last-child {
        border-right: 2px solid #dfdfdf;
        border-bottom: 2px solid #dfdfdf;
        border-radius: 0px 0px 8px 0px;
      }
      
      .custom-table tr:first-child .one {
        font-weight: bold;
      }
      
      .custom-table tr:first-child .two {
        font-weight: 400;
      }

      .custom-table .one {
        width: 150px;
        min-width: 150px;
        color: #366fb4 !important;
        font-weight: 700;
        padding: 0px 0px;
      }
      
      .custom-table .two {
        color: #2b3d77 !important;
        font-size: 12px;
        font-weight: 400;
      }
      .darkBg {
        background-color: #f7f7f7 !important;
      }
      
      .darkBg td {
        background-color: #f7f7f7 !important;
      }
      .boldTit {
         font-weight: 700;
        font-size: 13px;
      }
      .leave-duration {
        background-color: #2b3d76;
        color: #a8b9e0 !important;
        font-weight: 700;
      }
      
      .leave-duration td {
        font-size: 12px;
        background-color: #2b3d76 !important;
        color: #a8b9e0 !important;
      }
      
      .leave-duration .one {
        color: #ffffff !important;
      }
      
      .leave-duration .two {
        color: #ffffff !important;
      }
      .custom-table tbody tr td:last-child {
        width: 109px;
        min-width: 109px;
        padding: 8px 8px;
      }
      
      .custom-table tbody tr td:last-child.ar-text {
        font-weight: 700;
        font-size: 13px;
      }
      
      .custom-table tbody tr .two.ar-text {
        font-weight: 400 !important;
        font-size: 12px;
      }
      
      .custom-table tbody tr .ar-text:not(.one) {
        font-weight: 400 !important;
      }
      
      .custom-table tbody tr td:nth-child(2),
      .custom-table tbody tr td:nth-child(3) {
        width: auto;
      }
      .transparnt-bg td {
        background-color: transparent !important;
      }
      .header-logos {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding: 20px 30px;
        background-color: #fff;
      }
      
      .logo-seha {
        flex: 1;
        display: flex;
        justify-content: flex-start;
        align-items: flex-start;
      }
      
      .logo-ksa {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
        padding-top: 40px;
      }
      
      .logo-ksa img {
        margin-bottom: 0px;
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


         .footer-section {
      display: flex;
      justify-content: space-between;
 
    }
    .qr-section {
      text-align: center;
      position: relative;
      margin-top: 20px;
 
    }
          .qr-section a {
position: absolute;
bottom: 10;
right:28% ;


      
    }


    .logo-section {
      display: flex;
      flex-direction: column;
      margin-top : 25px !important ;


 
      }

    .logo-section .text {
      font-size: 12px;
      text-align: right;
     
    }
    .timestamp {
      font-size: 12px;
      color: #000000;

    }
      .leave-report{
        font-size: 20px;
        color: #2f6db4;
        font-weight: 700;
      }

      .vertical-line{
      margin-top: 20px !important ;
      }
    </style>
    
    </head>
    <body>
   <div class="Top-head">
      <div class="header-logos">
        <div class="logo-seha">
          <img style="height: 60px; width: auto;" src='${process.env.SERVER_HOST}/public/images/seha.PNG' alt="seha logo"/>
        </div>
        <div class="logo-ksa"> 
          <img style="height: 30px; width: auto;" src='${process.env.SERVER_HOST}/public/images/saudia1.PNG' alt="KSA Logo" />
          <div class="english-text">Kingdom of Saudi Arabia</div>
        </div>
        <div class="logo-design">
          <img style="height: 98px; width: auto;" src='${process.env.SERVER_HOST}/public/images/3.PNG' alt="design Logo" />
        </div>
      </div>
      <div style="text-align: center; margin-top: -9px;">
        <h3 class='leave-report' style="margin: 0px; padding: 0px; margin-bottom: -5px;">تقرير إجازة مرضية</h3>
        <div class="dark-head" style="margin: 0px; padding: 0px;">Sick Leave Report</div>
      </div>

    </div>
   <table class="custom-table">
<tbody>
  <tr class="transparnt-bg">
    <td class="one en-text" colspan="1">Leave ID</td>
    <td class="two en-text" colspan="2">${data.leave_id || ''}</td>
    <td class="one ar-text" colspan="1">رمز الإجازة</td>
  </tr>
  <tr class="leave-duration">
    <td class="one en-text">Leave Duration</td>
    <td class="two en-text">${leave_days} ${leave_days > 1 ? 'days' : 'day'} ( ${data.admission_date_en || ''} to ${data.discharge_date_en || ''} )</td>
    <td class="two ar-text">${leave_days} ${leave_days > 1 ? 'أيام' : 'يوم'} (${data.admission_date_ar || ''} الى ${data.discharge_date_ar || ''}) </td>
    <td class="one ar-text">مدة الأجازة</td>
  </tr>
  <tr>
    <td class="one en-text">Admission Date</td>
    <td class="two en-text">${data.admission_date_en || ''}</td>
    <td class="two en-text">${data.admission_date_ar || ''}</td>
    <td class="one ar-text">تاريخ الدخول</td>
  </tr>
  <tr class="darkBg">
    <td class="one en-text">Discharge Date</td>
    <td class="two en-text">${data.discharge_date_en || ''}</td>
    <td class="two en-text">${data.discharge_date_ar || ''}</td>
    <td class="one ar-text">تاريخ الخروج</td>
  </tr>
  <tr>
    <td class="one en-text" colspan="1">Issue Date</td>
    <td class="two en-text" colspan="2">${data.issue_date || ''}</td>
    <td class="one ar-text" colspan="1">تاريخ إصدار التقرير</td>
  </tr>
  <tr class="darkBg">
    <td class="one en-text">Name</td>
    <td class="two en-text">${data.name_en || ''}</td>
    <td class="two ar-text">${data.name_ar || ''}</td>
    <td class="one ar-text">الإسم</td>
  </tr>
  <tr>
    <td class="one en-text" colspan="1">National ID / Iqama</td>
    <td class="en-text" colspan="2">${data.national_id || ''}</td>
    <td class="one ar-text" colspan="1">رقم الهوية / الإقامة</td>
  </tr>
  <tr class="darkBg">
    <td class="one en-text">Nationality</td>
    <td class="two en-text">${country.country_name_en || ''}</td>
    <td class="two ar-text">${country.country_name_ar || ''}</td>
    <td class="one ar-text">الجنسية</td>
  </tr>
  <tr>
    <td class="one en-text">Employer</td>
    <td class="two en-text">${data.employer_en || ''}</td>
    <td class="two ar-text">${data.employer_ar || ''}</td>
    <td class="one ar-text">جهة العمل</td>
  </tr>
  <tr class="darkBg">
    <td class="one en-text">Physician Name</td>
    <td class="two en-text">${data.physician_name_en || ''}</td>
    <td class="two ar-text">${data.physician_name_ar || ''}</td>
    <td class="one ar-text">إسم الطبيب المعالج</td>
  </tr>
  <tr>
    <td class="one en-text">Position</td>
    <td class="two en-text">${data.position_en || ''}</td>
    <td class="two ar-text">${data.position_ar || ''}</td>
    <td class="one ar-text">المسمى الوظيفى</td>
  </tr>
</tbody>

      </table>

<div class="footer-section" >
    <!-- QR Code Section -->
    <div class="qr-section">
    <div style="margin-left: 20px !important;">
             <img style="width: 70px; height: 70px;margin:0px " src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(verificationUrl)}" alt="QR Code">

      <p class="ar-text" style='margin:0px ;margin-top : -5px !important ; font-size:8px !important; font-weight: 700 !important;' >للتحقق من بيانات التقرير يرجى التأكد من زيارة موقع منصة صحة<br>الرسمي</p>
      <p class="en-text" style='margin:0px ; font-size:8px !important; font-weight: 700 !important;' >To check the report please visit Seha's official website</p>
 

<a class="en-text"
           style="margin: 0px; font-size: 7px; color:blue; text-decoration: underline;"
          href='${verificationUrl}'
          target="_blank">www.seha.sa/#/inquiries/skenquiry</a>
    </div>
      <!-- Timestamp -->
  <div class="timestamp">
  <div style="margin-top: 40px !important; text-align:left !important ;  margin-left: 10px !important;">
      <p class="en-text" style='margin:0px;font-size:10px !important;font-weight: 700 !important;'>${DateObj.currentTime || ''}</p>
    <p class="en-text" style='margin:0px;font-size:10px !important;font-weight: 700 !important;'>${DateObj.currentDate || ''}</p></div>
     

  </div>




   
      </div>
    <div class="vertical-line"></div>
    <!-- Logo Section -->
    <div class="logo-section" >
      <div style="text-align: center; margin-right: 100px;">
        <img style="width: 150px; height: 85px ;" src='${process.env.SERVER_HOST}/public/images/1.PNG' alt="Ministry of Health Logo">
        <div style="line-height: 1.5;">
          <p class="ar-text" style="margin: 0px; font-size: 10px; font-weight: 700;">${data.hospital_name_ar || 'مستشفى النور التخصصي'}</p>
          <p class="en-text" style="margin: 0px; font-size: 10px; font-weight: 700;">${data.hospital_name_en || 'AL NOOR SPECIALIST HOSPITAL'}</p>
          <p class="ar-text" style="margin: 0px; font-size: 10px; font-weight: 700;">رقم الترخيص: ${data.license_number || '1410845906'}</p>
        </div>
      </div>
      <div>
        <img style="width: 130px; height: 80px ;margin-left: 75px !important; margin-top:14px !important;" src='${process.env.SERVER_HOST}/public/images/national-center.PNG' alt="National Health Logo">
      </div>
    </div>
  </div>
 

    </body>
    </html>
  `;

    await page.setContent(htmlContent);
    await page.pdf({
      path: `./public/leaves/leave_${data.id}_${data.leave_id}.pdf`,
      format: "A4",
      printBackground: true,
    });

    await browser.close();
    return `/public/leaves/leave_${data.id}_${data.leave_id}.pdf`;
  } catch (error) {
    console.error('PDF Generation Error:', error);
    if (browser) {
      await browser.close();
    }
    throw new Error(`Failed to generate PDF: ${error.message}`);
  }
};
