import { useRef, useState, useEffect } from 'react';
import { fetchLeavePdfBlob, downloadLeavePdf, shareLeavePdf, prefetchLeavePdf } from '../utils/pdfShare';

// ───────────────────────────────────────────────────────────────────────────
// معاينة «مشهد مراجعة لمرافق» — Companion Statement of Visit
//
// نسخة موازية لـ SickLeavePDFOriginal.jsx: نفس نظام المعاينة، ونفس أزرار
// التحميل/المشاركة (utils/pdfShare)، ونفس ملف الـ PDF المُولَّد من الخادم.
// الفرق الوحيد هو جدول الحقول وعنوان المستند — ولا يمسّ هذا الملف أي شيء في
// قالب الإجازة المرضية.
// ───────────────────────────────────────────────────────────────────────────
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

const padTwo = (value) => String(value).padStart(2, '0');

// تاريخ ميلادي YYYY-MM-DD → DD-MM-YYYY
const formatDate = (dateString) => {
  if (!dateString) return '';
  const parts = String(dateString).split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${padTwo(day)}-${padTwo(month)}-${year}`;
  }
  return dateString;
};

// تاريخ هجري → أرقام بخانتين مع الحفاظ على الفاصل
const formatHijriDate = (dateString) => {
  if (!dateString) return '';
  const delimiter = String(dateString).includes('/') ? '/' : '-';
  const parts = String(dateString).split(delimiter);
  if (parts.length >= 3) {
    return parts.map((part) => (isNaN(part) ? part : padTwo(part))).join(delimiter);
  }
  return dateString;
};

// "11:52 AM" أو "23:15" → عدد الدقائق منذ منتصف الليل (null إن تعذّر التحليل)
const parseTimeMinutes = (value) => {
  if (!value) return null;
  const raw = String(value).trim();
  let m = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (m) {
    let hours = parseInt(m[1], 10) % 12;
    if (/pm/i.test(m[3])) hours += 12;
    return hours * 60 + parseInt(m[2], 10);
  }
  m = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  return null;
};

const formatTime12 = (value) => {
  const minutes = parseTimeMinutes(value);
  if (minutes === null) return '';
  const hours24 = Math.floor(minutes / 60);
  const ampm = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = (hours24 % 12) || 12;
  return `${hours12}:${padTwo(minutes % 60)} ${ampm}`;
};

const arabicMeridiem = (value) => {
  const minutes = parseTimeMinutes(value);
  if (minutes === null) return '';
  return minutes < 12 * 60 ? 'صباحاً' : 'مساءً';
};

const daysBetween = (startDate, endDate) => {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start) || isNaN(end)) return 0;
  return Math.round((end - start) / (1000 * 60 * 60 * 24));
};

// فترة الانتظار بين الدخول والخروج — نفس منطق الخادم بالضبط.
export const calcWaitingPeriod = (admissionDate, admissionTime, dischargeDate, dischargeTime) => {
  const startMinutes = parseTimeMinutes(admissionTime);
  const endMinutes = parseTimeMinutes(dischargeTime);
  if (startMinutes === null || endMinutes === null) {
    return { en: '-- hours and -- mins', ar: '-- ساعة و -- دقيقة' };
  }
  const total = daysBetween(admissionDate, dischargeDate) * 1440 + (endMinutes - startMinutes);
  if (total < 0) return { en: '-- hours and -- mins', ar: '-- ساعة و -- دقيقة' };

  const hours = Math.floor(total / 60);
  const mins = total % 60;
  const minsLabel = mins > 0 ? String(mins) : '--';
  return {
    en: `${hours} ${hours === 1 ? 'hour' : 'hours'} and ${minsLabel} mins`,
    ar: `${hours} ساعة و ${minsLabel} دقيقة`,
  };
};

const CompanionVisitPDFOriginal = ({ data, onClose }) => {
  const pdfRef = useRef();
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [preparing, setPreparing] = useState(true);

  // نجهّز ملف الـ PDF فور فتح المعاينة حتى تنجح المشاركة من أول ضغطة.
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

  if (!data) {
    return null;
  }

  const generatePDF = async () => {
    if (downloading) return;

    setDownloading(true);
    try {
      const blob = await (prefetchLeavePdf(data) || fetchLeavePdfBlob(data));
      downloadLeavePdf(blob);
    } catch (error) {
      console.error('❌ PDF download error:', error);
      alert('حدث خطأ أثناء تنزيل ملف PDF. يرجى المحاولة مرة أخرى.');
    } finally {
      setDownloading(false);
    }
  };

  const shareFile = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const result = await shareLeavePdf(data);
      if (result?.downloaded) {
        alert('هذا المتصفح لا يدعم مشاركة الملفات مباشرةً، فتم تنزيل الملف. للمشاركة استخدم الهاتف.');
      }
    } catch (error) {
      console.error('❌ PDF share error:', error);
      alert('تعذّرت المشاركة، الملف جاهز الآن — اضغط «مشاركة الملف» مرة أخرى.');
    } finally {
      setSharing(false);
    }
  };

  const padTwoLocal = padTwo;

  const currentDate = data.report_date || (() => {
    const now = new Date();
    const weekday = now.toLocaleDateString('en-US', { weekday: 'long' });
    const day = padTwoLocal(now.getDate());
    const month = now.toLocaleDateString('en-US', { month: 'long' });
    const year = now.getFullYear();
    return `${weekday}, ${day} ${month} ${year}`;
  })();

  const currentTime = data.report_time || (() => {
    const now = new Date();
    const hours24 = now.getHours();
    const minute = padTwoLocal(now.getMinutes());
    const hour12 = padTwoLocal((hours24 % 12) === 0 ? 12 : hours24 % 12);
    const ampm = hours24 >= 12 ? 'PM' : 'AM';
    return `${hour12}:${minute} ${ampm}`;
  })();

  const DEFAULT_FOOTER_LOGO = '/images/1.png';
  const footerLogoSrc = data.footer_logo
    ? (data.footer_logo.startsWith('http') || data.footer_logo.startsWith('data:') ? data.footer_logo : `${API_BASE_URL}${data.footer_logo}`)
    : DEFAULT_FOOTER_LOGO;

  // رابط واحد لرمز الـ QR وللرابط الظاهر أسفله، يحمل رمز الخدمة ورقم الهوية.
  const frontendUrl = window.location.origin;
  const verificationUrl = `${frontendUrl}/inquiries/slenquiry?service_num=${encodeURIComponent(data.service_num || '')}&national_id=${encodeURIComponent(data.national_id || '')}`;

  const admissionTimeEn = formatTime12(data.admission_time);
  const dischargeTimeEn = formatTime12(data.discharge_time);
  const admissionTimeAr = admissionTimeEn ? `${admissionTimeEn.replace(/\s*(AM|PM)$/i, '')} ${arabicMeridiem(data.admission_time)}` : '';
  const dischargeTimeAr = dischargeTimeEn ? `${dischargeTimeEn.replace(/\s*(AM|PM)$/i, '')} ${arabicMeridiem(data.discharge_time)}` : '';

  const admissionEn = [formatDate(data.admission_date_en), admissionTimeEn].filter(Boolean).join(' - ');
  const dischargeEn = [formatDate(data.discharge_date_en), dischargeTimeEn].filter(Boolean).join(' - ');
  const admissionAr = [formatHijriDate(data.admission_date_ar), admissionTimeAr].filter(Boolean).join(' - ');
  const dischargeAr = [formatHijriDate(data.discharge_date_ar), dischargeTimeAr].filter(Boolean).join(' - ');

  const waiting = calcWaitingPeriod(
    data.admission_date_en, data.admission_time,
    data.discharge_date_en, data.discharge_time
  );

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
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontFamily: 'Cairo, sans-serif' }}>معاينة مشهد مراجعة لمرافق</h2>
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
    <td class="two en-text">${(data.name_en || '').toUpperCase()}</td>
    <td class="two ar-text">${data.name_ar || ''}</td>
    <td class="one ar-text">اسم المرافق</td>
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
    <td class="two en-text">${(data.physician_name_en || '').toUpperCase()}</td>
    <td class="two ar-text">${data.physician_name_ar || ''}</td>
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
             <img style="height: 90px;margin:0px " src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(verificationUrl)}" alt="QR Code">

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

export default CompanionVisitPDFOriginal;
