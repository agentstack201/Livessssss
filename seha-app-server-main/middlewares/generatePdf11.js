module.exports = async (data, leave_days, DateObj, country) => {
  let browser;
  
  try {
    const frontendUrl = process.env.FRONTEND_URL || 'https://seha-sa-s.vercel.app';
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

  // Generate HTML dynamically using template literals
  //   const htmlContent = `
  //     <!DOCTYPE html>
  //     <html lang="en">
  //     <head>
  //       <meta charset="UTF-8">
  //       <meta name="viewport" content="width=device-width, initial-scale=1.0">
  //       <title>Sick Leaves</title>
  //       <link rel="preconnect" href="https://fonts.googleapis.com">
  //       <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  //       <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@200..1000&display=swap" rel="stylesheet">
  //      <style>
  //       body {
  // font-family: "Cairo", sans-serif;
  //         margin: 0px 0px 20px 20px;
  //       }
  //       Top-head {
  //         text-align: center;
  //       }
  //       h3 {
  //         color: #3773b9;
  //         text-align: center;
  //       }
  //       .dark-head {
  //         color: #2b3e75;
  //         font-size: 24px ;
  //       }
  //         .custom-table {
  //           width: 90%;
  //           margin:  auto;
  //           margin-right: 51px;
  //            margin-top: 40px;

  //                 border-collapse: separate; /* Ensures border-radius works */
  //       border-spacing: 0; /* Removes spacing between cells for a cohesive look */
  //           border: 1px solid rgb(221, 221, 221);
  //           border-radius: 10px; /* Add rounded corners */
  //           overflow: hidden;
  //         }
  //         .custom-table td {
  //           padding: 5px;
  //           font-size: 12px;
  //           text-align: center;
  //           border: 1px solid rgb(221, 221, 221);
  //         }
  //           .vertical-line{
  //           width:1px;
  //           height:100px ;
  //           background-color:rgb(221, 221, 221) ;
  //           }

  //       /* Optional: Style the first row to stand out */
  //       .custom-table tr:first-child td {
  //         background-color: #f2f2f2;
  //         font-weight: bold;
  //       }

  //       .custom-table .one {
  //         width: 97px !important;
  //                                 color: #3773b9 !important;

  //       }
  //       .custom-table .two {
  //         color: red !important;
  //         color: #59699D !important;

  //       }
  //       .darkBg {
  //         background-color: #f5f5f5 !important;
  //       }
  //       .leave-duration {
  //         background-color: #283c78;
  //         color: white;
  //       }
  //       .custom-table tbody tr .one {

  //         font-weight: 400 ;
  //       }
  //       .custom-table tbody tr td:last-child {

  //         font-weight: 400 ;
  //       }
  //       .transparnt-bg td {
  //         background-color: transparent !important;
  //       }
  //       .header-logos {

  //         display: flex;
  //         justify-content: space-between;
  //         align-items: center;

  //         background-color: #fff;
  //       }

  //          .footer-section {
  //       display: flex;
  //       justify-content: space-between;

  //     }
  //     .qr-section {
  //       text-align: center;
  //       position: relative;
  //       margin-top: 20px;

  //     }
  //           .qr-section a {
  // position: absolute;
  // bottom: 10;
  // right:28% ;

  //     }

  //     .logo-section {
  //       display: flex;
  //       flex-direction: column;
  //       margin-top : 50px !important ;

  //       }

  //     .logo-section .text {
  //       font-size: 12px;
  //       text-align: right;

  //     }
  //     .timestamp {
  //       font-size: 12px;
  //       color: #555;

  //     }
  //       .leave-report{
  //       font-size:26px
  //       }

  //       .vertical-line{
  //       margin-top: 50px !important ;
  //       }
  //     </style>

  //     </head>
  //     <body>
  //        <div class="Top-head">
  //       <div class="header-logos">
  //         <div class="logo-seha">
  //           <img style="height: 60px !important; width: 120px !important; margin-right:-60px !important" src='${process.env.SERVER_HOST}/public/images/seha.PNG' alt="seha logo"/>
  //         </div>
  //         <div class="logo-ksa">
  //           <img style="height: 60px !important; width: 140px !important; margin-right:-125px !important" src='${process.env.SERVER_HOST}/public/images/saudia.PNG' alt="KSA Logo" />
  //         </div>
  //         <div class="logo-design">
  //           <img style="height: 120px !important; width: 200px !important;" src='${process.env.SERVER_HOST}/public/images/3.PNG' alt="design Logo" />
  //         </div>
  //       </div>
  //       <div style="text-align: center; margin-top:40px">
  //             <h3 class='leave-report ' style="margin:0px ; padding:0px">تقرير إجازة مرضية</h3>
  //       <span class="dark-head" style="margin:0px ; padding:0px ; font-weight:bold">Sick Leave Report</span>
  //       </div>

  //     </div>

  //      <table class="custom-table">
  //         <tbody>
  //           <tr class="transparnt-bg">
  //             <td class="one">leave_id</td>
  //             <td class="two" colspan="2">${data.leave_id}</td>
  //             <td class="one">leave_id</td>
  //           </tr>
  //           <tr class="leave-duration">
  //             <td>Leave Duration</td>
  //             <td>${leave_days} day (${data.admission_date_en} to ${data.discharge_date_en})</td>
  //             <td>يوم ${leave_days} (${data.admission_date_ar} إلى ${data.discharge_date_ar})</td>
  //             <td>مدة الأجازة</td>
  //           </tr>
  //           <tr>
  //             <td class="one">admission date</td>
  //             <td class="two">${data.admission_date_en}</td>
  //             <td class="two">${data.admission_date_ar}</td>
  //             <td class="one">تاريخ الدخول</td>
  //           </tr>
  //           <tr class="darkBg">
  //             <td class="one">discharge date</td>
  //             <td class="two">${data.discharge_date_en}</td>
  //             <td class="two">${data.discharge_date_ar}</td>
  //             <td class="one">تاريخ الخروج</td>
  //           </tr>
  //           <tr>
  //             <td class="one">issue date</td>
  //             <td class="two" colspan="2">${data.issue_date}</td>
  //             <td class="one">تاريخ إصدار التقرير</td>
  //           </tr>
  //           <tr class="darkBg">
  //             <td class="one">name</td>
  //             <td class="two">${data.name_en}</td>
  //             <td class="two">${data.name_ar}</td>
  //             <td class="one">الإسم</td>
  //           </tr>
  //           <tr>
  //             <td class="one">National ID/Iqama</td>
  //             <td class="two" colspan="2">${data.national_id}</td>
  //             <td class="one">رقم الهوية/الإقامة</td>
  //           </tr>
  //           <tr class="darkBg">
  //             <td class="one">nationality</td>
  //             <td class="two">${country.country_name_en}</td>
  //             <td class="two">${country.country_name_ar}</td>
  //             <td class="one">الجنسية</td>
  //           </tr>
  //           <tr>
  //             <td class="one">employer</td>
  //             <td class="two">${data.employer_en}</td>
  //             <td class="two">${data.employer_ar}</td>
  //             <td class="one">جهة العمل</td>
  //           </tr>
  //           <tr class="darkBg">
  //             <td class="one">physician name</td>
  //             <td class="two">${data.physician_name_en}</td>
  //             <td class="two">${data.physician_name_ar}</td>
  //             <td class="one">إسم الطبيب المعالج</td>
  //           </tr>
  //           <tr>
  //             <td class="one">position</td>
  //             <td class="two">${data.position_en}</td>
  //             <td class="two">${data.position_ar}</td>
  //             <td class="one">المسمى الوظيفي</td>
  //           </tr>
  //         </tbody>
  //       </table>
  //    <div class="footer-section">
  //     <!-- QR Code Section -->
  //    <div class="qr-section">
  //     <div style="margin-left: 20px;">
  //       <img
  //         style="width: 70px; height: 70px; margin: 0px;"
  //         src="${process.env.SERVER_HOST}/public/images/barcode.jpg"
  //         alt="QR Code">
  //       <p
  //         style="margin: 0px; margin-top: -5px; font-size: 8px;">
  //         للتحقق من بيانات التقرير يرجي التحقق من زيارة موقع منصه صحه الرسمي
  //       </p>
  //       <p
  //         style="margin: 0px; font-size: 8px;">
  //         To check the report please visit Seha's official website
  //       </p>
  //       <a
  //         style="margin: 0px; font-size: 8px;"
  //         href='${process.env.FRONT_HOST_LEAVE_PAGE}'
  //         target="_blank">
  //         <span style="margin-bottom: 40px;">www.seha.sa/#/inquiries/slenquiry</span>
  //       </a>
  //     </div>
  //   </div>

  //   <!-- Timestamp -->
  //   <div class="timestamp" style="margin-top: 80px; text-align: left; margin-left: 20px;">
  //     <p style="margin: 0px;">${DateObj.currentTime}</p>
  //     <p style="margin: 0px;">${DateObj.currentDate}</p>
  //   </div>

  //   <!-- Vertical Line -->
  //   <div class="vertical-line"></div>

  //   <!-- Logo Section -->
  //   <div class="logo-section">
  //     <div>
  //       <img
  //         style="width: 150px; height: 130px; margin-right: 130px;"
  //         src="${process.env.SERVER_HOST}/public/images/1.PNG"
  //         alt="Ministry of Health Logo">
  //     </div>
  //     <div>
  //       <img
  //         style="width: 130px; height: 80px; margin-left: 90px;"
  //         src="${process.env.SERVER_HOST}/public/images/national-center.PNG"
  //         alt="National Health Logo">
  //     </div>
  //   </div>
  //   </div>

  //     </body>
  //     </html>
  //   `;
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>تقرير إجازة مرضية - Sick Leave Report</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700&display=swap" rel="stylesheet">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Cairo', sans-serif;
          padding: 30px;
          background: #fff;
          color: #333;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 20px;
        }
        .header-right { text-align: right; }
        .header-center {
          text-align: center;
          flex: 1;
          padding: 0 20px;
        }
        .kingdom-ar {
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 5px;
        }
        .kingdom-en {
          font-size: 11px;
          color: #666;
        }
        .title-ar {
          color: #4a90e2;
          font-size: 20px;
          font-weight: 700;
          margin: 10px 0 5px;
        }
        .title-en {
          color: #666;
          font-size: 14px;
          font-weight: 400;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
          font-size: 11px;
        }
        td {
          border: 1px solid #ddd;
          padding: 8px 10px;
          text-align: center;
        }
        .label-ar {
          background: #f8f9fa;
          color: #4a90e2;
          font-weight: 600;
          width: 25%;
        }
        .label-en {
          background: #fff;
          color: #666;
          width: 25%;
        }
        .value {
          background: #fff;
          color: #333;
        }
        .duration-row td {
          background: #2c5282;
          color: white;
          font-weight: 600;
        }
        .footer {
          display: flex;
          justify-content: space-between;
          margin-top: 30px;
          align-items: flex-end;
        }
        .qr-section {
          text-align: center;
        }
        .qr-text {
          font-size: 8px;
          color: #666;
          margin-top: 5px;
        }
        .timestamp {
          font-size: 10px;
          color: #666;
          text-align: left;
        }
        .logo-section img {
          max-width: 120px;
          height: auto;
        }
      Top-head {
        text-align: center;
      }
      h3 {
        color: #3773b9;
        text-align: center;
      }
      .dark-head {
        color: #2b3e75;
        font-size: 24px ;
      }
        .custom-table {
          width: 90%;
          margin:  auto;
          margin-right: 51px;
           margin-top: 40px;
    
                border-collapse: separate; /* Ensures border-radius works */
      border-spacing: 0; /* Removes spacing between cells for a cohesive look */
          border: 1px solid rgb(221, 221, 221);
          border-radius: 10px; /* Add rounded corners */
          overflow: hidden;
        }
        .custom-table td {
          padding: 5px;
          font-size: 12px;
          text-align: center;
          border: 1px solid rgb(221, 221, 221);
        }
          .vertical-line{
          width:1px;
          height:100px ;
          background-color:rgb(221, 221, 221) ;
          }



      /* Optional: Style the first row to stand out */
      .custom-table tr:first-child td {
        background-color: #f2f2f2;
        font-weight: bold;
      }

      .custom-table .one {
        width: 97px !important;
                                color: #3773b9 !important;


        
      }
      .custom-table .two {
        color: red !important;
        color: #59699D !important;


        
      }
      .darkBg {
        background-color: #f5f5f5 !important;
      }
      .leave-duration {
        background-color: #283c78;
        color: white;
      }
      .custom-table tbody tr .one {
        
        font-weight: 400 ;
      }
      .custom-table tbody tr td:last-child {
        
        font-weight: 400 ;
      }
      .transparnt-bg td {
        background-color: transparent !important;
      }
      .header-logos {

        display: flex;
        justify-content: space-between;
        align-items: center;
    
        background-color: #fff;
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
      margin-top : 50px !important ;
 
      }

    .logo-section .text {
      font-size: 12px;
      text-align: right;
     
    }
    .timestamp {
      font-size: 12px;
      color: #555;

    }
      .leave-report{
      font-size:26px
      }

      .vertical-line{
      margin-top: 50px !important ;
      }
    </style>
    
    </head>
    <body>
   <div class="Top-head">
      <div class="header-logos">
        <div class="logo-seha">
          <img style="height: 60px !important; width: 120px !important; margin-right:-60px !important" src='${process.env.SERVER_HOST}/public/images/seha.PNG' alt="seha logo"/>
        </div>
        <div class="logo-ksa">
          <img style="height: 60px !important; width: 140px !important; margin-right:-125px !important" src='${process.env.SERVER_HOST}/public/images/saudia.PNG' alt="KSA Logo" />
        </div>
        <div class="logo-design">
          <img style="height: 120px !important; width: 200px !important;" src='${process.env.SERVER_HOST}/public/images/3.PNG' alt="design Logo" />
        </div>
      </div>
      <div style="text-align: center; margin-top:40px">
            <h3 class='leave-report ' style="margin:0px ; padding:0px">تقرير إجازة مرضية</h3>
      <span class="dark-head" style="margin:0px ; padding:0px ; font-weight:bold">Sick Leave Report</span>
      </div>

    </div>
   <table class="custom-table">
<tbody>
  <tr class="transparnt-bg">
    <td class="one"  colspan="1">leave_id</td>

    <td class="two"  colspan="2">${data.leave_id}</td>
    <td class="one"  colspan="1">leave_id</td>

  </tr>
  <tr class="leave-duration">
    <td >Leave Duration</td>
    <td style="padding: 8px; border: 1px solid #ccc;">
        ${leave_days} day (${data.admission_date_en} to ${data.discharge_date_en})
      </td>
      <td style="padding: 8px; border: 1px solid #ccc;">
        يوم ${leave_days}  (${data.admission_date_ar} إلى ${data.discharge_date_ar})
      </td>
    <td >مدة الأجازة</td>
  </tr>
  <tr>
    <td class="one">addmition date</td>
    <td class="two" >${data.admission_date_en}</td>
    <td class="two" >${data.admission_date_ar}</td>
    <td class="one">تاريخ الدخول</td>
  </tr>
  <tr class="darkBg">
    <td class="one">discharege date</td>
    <td class="two">${data.discharge_date_en}</td>
    <td class="two">${data.discharge_date_ar}</td>
    <td class="one">تاريخ الخروج</td>
  </tr>

  <tr>
    <td class="one" colspan="1">assu_date</td>

    <td class="two"  colspan="2">${data.issue_date}</td>
    <td class="one" colspan="1">تاريخ إصدار التقرير</td>

  </tr>

  <tr class="darkBg">
    <td class="one">name</td>
    <td class="two">${data.name_en}</td>
    <td class="two">${data.name_ar}</td>
    <td class="one">الإسم</td>
  </tr>

  <tr>
    <td class="one" colspan="1">National ID/lqama </td>

    <td colspan="2">${data.national_id}</td>
    <td class="one" colspan="1">رقم الهوية/الإقامة</td>

  </tr>
  <tr class="darkBg">
    <td class="one">nationality</td>
    <td class="two">${country.country_name_en}</td>
    <td class="two">${country.country_name_ar}</td>
    <td class="one">الجنسية</td>
  </tr>
  <tr>
    <td class="one">empolyer</td>
    <td class="two" >${data.employer_en}</td>
    <td class="two" >${data.employer_ar}</td>
    <td class="one">جهة العمل</td>
  </tr>
  <tr class="darkBg">
    <td class="one">physician name</td>
    <td class="two">${data.physician_name_en}</td>
    <td class="two">${data.physician_name_ar}</td>
    <td class="one">إسم الطبيب المعالج</td>
  </tr>
  <tr>
    <td class="one">position</td>
    <td class="two" >${data.position_en}</td>
    <td class="two" >${data.position_ar}</td>
    <td class="one">المسمى الوظيفى</td>
  </tr>
</tbody>

      </table>

<div class="footer-section" >
    <!-- QR Code Section -->
    <div class="qr-section"  ">
    <div style="margin-left: 20px !important; margin-left: 20px !important;
">
             <img style="width: 70px; height: 70px;margin:0px " src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(verificationUrl)}" alt="QR Code">

      <p style='margin:0px ;margin-top : -5px !important ; font-size:8px !important' > للتحقق من بيانات التقرير يرجي التحقق من زيارة موقع منصه صحه الرسمي        </p>
      <p style='margin:0px ; font-size:8px !important' >To check the report please visit Seha's official website</p>
 

<a
           style="margin: 0px; font-size: 8px;"
          href='${verificationUrl}'
          target="_blank">
          <span style=" margin-bottom: 40px !important ;color:blue; text-decoration: underline;'">www.seha.sa/#/inquiries/skenquiry</span>
</a>    </div>




     <!-- Timestamp -->
  <div class="timestamp">
  <div style="margin-top: 80px !important; text-align:left !important ;  margin-left: 20px !important;">
      <p style='margin:0px'>${DateObj.currentTime}</p>
    <p style='margin:0px'>${DateObj.currentDate}</p></div>

  </div>
      </div>
    <div class="vertical-line"></div>
    <!-- Logo Section -->
    <div class="logo-section" >
      <div >
        <img style="width: 150px; height: 130px ;margin-right: 130px;" src='${process.env.SERVER_HOST}/public/images/1.PNG' alt="Ministry of Health Logo">
      </div>
      <div>
        <img style="width: 130px; height: 80px ;margin-left: 90px !important;" src='${process.env.SERVER_HOST}/public/images/national-center.PNG' alt="National Health Logo">
      </div>
    </div>
  </div>
 

    </body>
    </html>
  `;

    // Set the generated HTML as page content
    await page.setContent(htmlContent);

    // Create a PDF from the page
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
