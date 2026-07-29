import { useRef, useState, useEffect } from 'react';
import { fetchLeavePdfBlob, downloadLeavePdf, shareLeavePdf, prefetchLeavePdf } from '../utils/pdfShare';

// استخدام الصور والخطوط من مجلد public في الفرونت اند
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

const SickLeavePDFOriginal = ({ data, onClose }) => {
  const pdfRef = useRef();
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [preparing, setPreparing] = useState(true);

  // نجهّز ملف الـ PDF فور فتح المعاينة، ونُبقي زر المشاركة معطّلاً حتى يجهز الملف —
  // بذلك تنجح المشاركة من أول ضغطة (الملف حاضر ضمن نافذة تفعيل المستخدم).
  useEffect(() => {
    let alive = true;
    if (data?.service_num && data?.national_id) {
      setPreparing(true);
      prefetchLeavePdf(data)
        .then(() => { if (alive) setPreparing(false); })
        .catch(() => { if (alive) setPreparing(false); });
    }
    return () => { alive = false; };
  }, [data?.service_num, data?.national_id]);

  // التحقق من وجود البيانات
  if (!data) {
    return null;
  }

  // تنزيل ملف PDF حقيقي (نصوص قابلة للنسخ والبحث + جودة متجهية حادة) باسم sickLeaves.pdf.
  const generatePDF = async () => {
    if (downloading) return;

    setDownloading(true);
    try {
      // نعيد استخدام الملف المُجهَّز مسبقًا إن وُجد (أسرع)، وإلا نجلبه الآن.
      const blob = await (prefetchLeavePdf(data) || fetchLeavePdfBlob(data));
      downloadLeavePdf(blob);
    } catch (error) {
      console.error('❌ PDF download error:', error);
      alert('حدث خطأ أثناء تنزيل ملف PDF. يرجى المحاولة مرة أخرى.');
    } finally {
      setDownloading(false);
    }
  };

  // مشاركة ملف التقرير نفسه لأي تطبيق (المنطق المشترك في utils/pdfShare).
  const shareFile = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const result = await shareLeavePdf(data);
      if (result?.downloaded) {
        // الجهاز لا يدعم مشاركة الملفات (سطح المكتب غالبًا)، فنُزِّل الملف.
        alert('هذا المتصفح لا يدعم مشاركة الملفات مباشرةً، فتم تنزيل الملف. للمشاركة استخدم الهاتف.');
      }
    } catch (error) {
      console.error('❌ PDF share error:', error);
      alert('تعذّرت المشاركة، الملف جاهز الآن — اضغط «مشاركة الملف» مرة أخرى.');
    } finally {
      setSharing(false);
    }
  };

  // حساب مدة الإجازة - محسّن وفوري
  const calculateDuration = () => {
    // التحقق من وجود تاريخ الدخول على الأقل
    if (!data.admission_date_en) return 0;

    const start = new Date(data.admission_date_en);

    // إذا لم يوجد تاريخ خروج، احسب من تاريخ الدخول إلى اليوم الحالي
    if (!data.discharge_date_en) {
      const now = new Date();
      const diffTime = Math.abs(now - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      return diffDays;
    }

    // حساب المدة الكاملة إذا كان التاريخان موجودان
    const end = new Date(data.discharge_date_en);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  const leaveDays = calculateDuration();

  // استخدام التاريخ والوقت من قاعدة البيانات أو القيم الحالية كافتراضية
  const padTwo = (value) => String(value).padStart(2, '0');

  const currentDate = data.report_date || (() => {
    const now = new Date();
    const weekday = now.toLocaleDateString('en-US', { weekday: 'long' });
    const day = padTwo(now.getDate());
    const month = now.toLocaleDateString('en-US', { month: 'long' });
    const year = now.getFullYear();
    return `${weekday}, ${day} ${month} ${year}`;
  })();

  const currentTime = data.report_time || (() => {
    const now = new Date();
    const hours24 = now.getHours();
    const minute = padTwo(now.getMinutes());
    const hour12 = padTwo((hours24 % 12) === 0 ? 12 : hours24 % 12);
    const ampm = hours24 >= 12 ? 'PM' : 'AM';
    return `${hour12}:${minute} ${ampm}`;
  })();
  const DEFAULT_FOOTER_LOGO = '/images/1.png';
  const footerLogoSrc = data.footer_logo
    ? (data.footer_logo.startsWith('http') || data.footer_logo.startsWith('data:') ? data.footer_logo : `${API_BASE_URL}${data.footer_logo}`)
    : DEFAULT_FOOTER_LOGO;

  const frontendUrl = window.location.origin;
  const verificationUrl = `${frontendUrl}/inquiries/slenquiry?service_num=${data.service_num}&national_id=${data.national_id}`;
  const displayUrl = `${frontendUrl.replace(/^https?:\/\//, '')}/inquiries/slenquiry`;

  // تحويل leave_days للاستخدام في template
  const leave_days = leaveDays;

  // دالة لتحويل التاريخ من YYYY-MM-DD إلى DD-MM-YYYY
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const parts = dateString.split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      return `${padTwo(day)}-${padTwo(month)}-${year}`; // DD-MM-YYYY
    }
    return dateString;
  };

  const formatHijriDate = (dateString) => {
    if (!dateString) return '';
    const delimiter = dateString.includes('/') ? '/' : '-';
    const parts = dateString.split(delimiter);
    if (parts.length >= 3) {
      return parts
        .map((part) => (isNaN(part) ? part : padTwo(part)))
        .join(delimiter);
    }
    return dateString;
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 9999,
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '900px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px',
          borderBottom: '2px solid #e0e0e0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #2f6db4 0%, #366fb4 100%)',
          color: 'white',
          borderRadius: '12px 12px 0 0'
        }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontFamily: 'Cairo, sans-serif' }}>معاينة تقرير الإجازة المرضية</h2>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={generatePDF} disabled={downloading} style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: '6px',
              cursor: downloading ? 'wait' : 'pointer',
              fontSize: '1rem',
              fontFamily: 'Cairo, sans-serif',
              background: downloading ? '#8bc34a' : '#4CAF50',
              color: 'white',
              opacity: downloading ? 0.8 : 1
            }}>
              {downloading ? '⏳ جاري التحميل...' : '📥 تحميل PDF'}
            </button>
            <button onClick={shareFile} disabled={sharing || preparing} style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: '6px',
              cursor: sharing || preparing ? 'wait' : 'pointer',
              fontSize: '1rem',
              fontFamily: 'Cairo, sans-serif',
              background: '#2f6db4',
              color: 'white',
              opacity: sharing || preparing ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              {preparing ? '⏳ جاري التجهيز...' : sharing ? '⏳ جاري المشاركة...' : '📤 مشاركة الملف'}
            </button>
            <button onClick={onClose} style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontFamily: 'Cairo, sans-serif',
              background: '#f44336',
              color: 'white'
            }}>
              ✖ إغلاق
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '30px',
          background: '#f5f5f5'
        }}>
          <div ref={pdfRef} style={{
            background: 'white',
            padding: '0',
            margin: '0 auto',
            fontFamily: 'NotoSansArabic, Cairo, sans-serif',
            width: '210mm',
            height: '297mm',
            overflow: 'hidden',
            position: 'relative',
            direction: 'ltr',
            boxSizing: 'border-box'
          }} dangerouslySetInnerHTML={{
            __html: `
               <link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@200..1000&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap" rel="stylesheet">
<style>

  @font-face {
          font-family: 'NotoSansArabic';
          src: url('/fonts/NotoSansArabic-Bold.ttf') format('truetype');
          font-weight: 700;
          font-style: normal;
        }
        
        @font-face {
          font-family: 'NotoSansArabic';
          src: url('/fonts/NotoSansArabic-Regular.ttf') format('truetype');
          font-weight: 400;
          font-style: normal;
        }
      body {
font-family: "NotoSansArabic", sans-serif;
        margin: 0px 0px 20px 20px;
        max-height: 297mm;
        height: 297mm;
        overflow: hidden;
        page-break-inside: avoid;
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
        // padding-left: 38px;
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
      .custom-table tbody tr td:last-child {
        // width: 110px;
        // min-width: 110px;
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
          <img style="height: 80px; width: auto;" src='/images/seha.jpg' alt="seha logo"/>
        </div>
        <div class="logo-ksa"> 
          <img style="height: 54px; width: auto;" src='/images/saudia1.jpg' alt="KSA Logo" />
          <div class="english-text">Kingdom of Saudi Arabia</div>
        </div>
        <div class="logo-design">
          <img style="height: 100px; width: auto;margin-right: 10px;" src='/images/3.PNG' alt="design Logo" />
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
    <td class="two en-text" colspan="2">${data.leave_id || ''}</td>
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
    <td class="two en-text">${(data.name_en || '').toUpperCase()}</td>
    <td class="two ar-text">${data.name_ar || ''}</td>
    <td class="one ar-text">الاسم</td>
  </tr>
  <tr>
    <td class="one en-text" colspan="1">National ID / Iqama</td>
    <td class="two en-text" colspan="2">${data.national_id || ''}</td>
    <td class="one ar-text" colspan="1">رقم الهوية / الإقامة</td>
  </tr>
  <tr class="darkBg">
    <td class="one en-text">Nationality</td>
    <td class="two en-text">${data.country?.country_name_en || 'Saudi'}</td>
    <td class="two ar-text">${data.country?.country_name_ar || data.nationality || 'سعودي'}</td>
    <td class="one ar-text">الجنسية</td>
  </tr>
  <tr>
    <td class="one en-text">Employer</td>
    <td class="two en-text">${''}</td>
    <td class="two ar-text">${data.employer_ar || ''}</td>
    <td class="one ar-text">جهة العمل</td>
  </tr>
  <tr class="darkBg">
    <td class="one en-text">Physician Name</td>
    <td class="two en-text">${(data.physician_name_en || '').toUpperCase()}</td>
    <td class="two ar-text">${data.physician_name_ar || ''}</td>
    <td class="one ar-text">اسم الممارس</td>
  </tr>
  <tr>
    <td class="one en-text">Position</td>
    <td class="two en-text">${data.position_en || ''}</td>
    <td class="two ar-text">${data.position_ar || ''}</td>
    <td class="one ar-text">المسمى الوظيفى</td>
  </tr>
</tbody>

      </table>

<div class="pdf-footer-section" >
    <!-- QR Code Section -->
    <div class="qr-section">
    <div style="margin-left: 45px !important;">
             <img style="height: 90px;margin:0px " src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(verificationUrl)}" alt="QR Code">

      <p class="ar-text" style='margin:0px ;margin-top : -5px !important ; font-size:10px !important; font-weight: 900 !important; color: #000;' >للتحقق من بيانات التقرير يرجى التأكد من زيارة موقع منصة صحة الرسمي</p>
      <p class="en-text" style='margin:0px ; font-size:10px !important; font-weight: 900 !important; color: #000;' >To check the report please visit Seha's official website</p>
 

<a class="en-text"
           style="margin: 0px; margin-top : 7px !important ; font-size: 10px; font-weight: 900 !important; color:blue; text-decoration: underline;"
          href='${verificationUrl}'
          target="_blank">www.seha.sa/#/inquiries/skenquiry</a>
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
          <p class="ar-text" style="margin: 0px; font-size: 12.8px; font-weight: 900;font-weight: bold !important;color: #000;">${data.hospital_name_ar || 'مستشفى النور التخصصي'}</p>
          <p class="en-text" style="margin: 0px; font-size: 12.8px; font-weight: 900;font-weight: bold !important;color: #000;">${data.hospital_name_en || 'AL NOOR SPECIALIST HOSPITAL'}</p>
          ${data.show_license_number !== false ? `<p class="ar-text" style="margin: 0px; font-size: 12px; font-weight: 900;color: #000;">رقم الترخيص: <span class="ar-date">${data.license_number || '1410845906'}</span></p>` : ''}
        </div>
      </div>
      <div>
        <img style="width: 140px; height: 90px ;margin-left: 147px !important; margin-top:30px !important;" src='/images/national-center.jpg' alt="National Health Logo">
      </div>
    </div>
  </div>
            `
          }} />
        </div>
      </div>
    </div>
  );
};

export default SickLeavePDFOriginal;
