import { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { fetchLeavePdfBlob, downloadLeavePdf, shareLeavePdf, prefetchLeavePdf } from '../utils/pdfShare';
import {
  formatDate,
  formatHijriDate,
  escapeHtml,
  defaultReportDate,
  defaultReportTime,
} from '../utils/documentFormat';

// ───────────────────────────────────────────────────────────────────────────
// معاينة «تقرير مرافقة مريض» — Companion Sick Leave Report
//
// نسخة موازية لبقية مكوّنات المعاينة: نفس أزرار التحميل/المشاركة/الطباعة،
// ونفس ملف الـ PDF المُولَّد من الخادم
// (middlewares/generateCompanionSickLeavePdf.js) — يجب أن يبقى جدول الحقول هنا
// مطابقاً لما في الخادم حرفاً بحرف حتى تكون المعاينة صادقة.
//
// القالب هو تقرير الإجازة المرضية مع «اسم المرافق» بدل «الاسم» وصف إضافي
// «صلة القرابة»، وبصف «مدة الإجازة» الأزرق الداكن وتواريخ هجرية.
// ───────────────────────────────────────────────────────────────────────────
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

// مقاس A4 بالبكسل عند 96dpi — يُستخدم لحساب معامل التحجيم في المعاينة.
const A4_WIDTH_PX = 794
const A4_HEIGHT_PX = 1123

const CompanionSickLeavePDFOriginal = ({ data, onClose }) => {
  const pdfRef = useRef();
  const scaleBoxRef = useRef();
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [preparing, setPreparing] = useState(true);
  const [scale, setScale] = useState(1);
  const [qrDataUri, setQrDataUri] = useState('');

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

  // رمز QR يُولَّد محلياً داخل المتصفح (حزمة qrcode) — بلا أي طلب لخدمة خارجية،
  // بنفس الإعدادات المستخدمة في الخادم فيخرج الرمز مطابقاً لما يُطبع في الـ PDF.
  // يُحسب هنا في تأثير مستقل ليبقى ترتيب الـ hooks ثابتاً قبل أي خروج مبكّر.
  useEffect(() => {
    let alive = true;
    const url = `${window.location.origin}/inquiries/slenquiry?service_num=${encodeURIComponent(data?.service_num || '')}&national_id=${encodeURIComponent(data?.national_id || '')}`;
    QRCode.toDataURL(url, { margin: 1, width: 150, errorCorrectionLevel: 'M' })
      .then((uri) => { if (alive) setQrDataUri(uri); })
      .catch((err) => { console.warn('⚠️ QR generation failed:', err?.message); });
    return () => { alive = false; };
  }, [data?.service_num, data?.national_id]);

  // تحجيم المعاينة لتناسب عرض الشاشة: الورقة تبقى 210mm حقيقية (فلا يتغيّر
  // شيء عند الطباعة) لكنها تُعرض مصغّرة على الشاشات الضيقة بدل التمرير الأفقي.
  const applyScale = useCallback(() => {
    const box = scaleBoxRef.current;
    if (!box) return;
    const available = box.clientWidth;
    if (!available) return;
    setScale(Math.min(1, available / A4_WIDTH_PX));
  }, []);

  useEffect(() => {
    applyScale();
    const observer = new ResizeObserver(applyScale);
    if (scaleBoxRef.current) observer.observe(scaleBoxRef.current);
    window.addEventListener('resize', applyScale);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', applyScale);
    };
  }, [applyScale]);

  // إغلاق بمفتاح Escape — سلوك متوقّع من أي نافذة منبثقة.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

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

  const currentDate = data.report_date || defaultReportDate();
  const currentTime = data.report_time || defaultReportTime();

  const DEFAULT_FOOTER_LOGO = '/images/1.png';
  const footerLogoSrc = data.footer_logo
    ? (data.footer_logo.startsWith('http') || data.footer_logo.startsWith('data:') ? data.footer_logo : `${API_BASE_URL}${data.footer_logo}`)
    : DEFAULT_FOOTER_LOGO;

  // رابط التحقق: نطاق موقعنا الحالي دائماً (window.location.origin) — لا نطاق
  // القالب الأصلي ولا أي موقع خارجي. نفس الرابط يُستخدم للـ QR وللنص أسفله.
  const frontendUrl = window.location.origin;
  const verificationUrl = `${frontendUrl}/inquiries/slenquiry?service_num=${encodeURIComponent(data.service_num || '')}&national_id=${encodeURIComponent(data.national_id || '')}`;
  // نصٌّ بصري ثابت مطابق للمستند الأصلي — الوجهة الحقيقية (href والـ QR) هي
  // verificationUrl على نطاق موقعنا. مقصود ألا يتطابق الظاهر مع الوجهة.
  const verificationLabel = 'www.seha.sa/#/inquiries/slenquiry';

  // نفس منطق الخادم: حقل «جهة العمل» واحد يملأ اللغتين، والمستند الأصلي يترك
  // الخانة الإنجليزية فارغة — فلا نعرضها إلا إن كانت مختلفة فعلاً عن العربية.
  const employerEn = (data.employer_en && data.employer_en !== data.employer_ar) ? data.employer_en : '';

  // مدة الإجازة شاملةً يومَي الدخول والخروج — نفس حساب calcDays في الخادم.
  const days = Number(data.leave_days) > 0
    ? Number(data.leave_days)
    : (() => {
        const a = new Date(data.admission_date_en), d = new Date(data.discharge_date_en);
        if (isNaN(a) || isNaN(d)) return 0;
        return Math.ceil((d - a) / 86400000) + 1;
      })();

  const btn = (background, extra = {}) => ({
    padding: '10px 20px',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '1rem',
    fontFamily: 'Cairo, sans-serif',
    background,
    color: 'white',
    ...extra,
  });

  // تُعرض النافذة عبر portal مباشرةً تحت <body> لا داخل #root. هذا شرط لعمل
  // أنماط الطباعة: قاعدة إخفاء ما عدا النافذة تعمل على أبناء body المباشرين،
  // ولو بقيت النافذة داخل #root لأخفى #root نفسه ولخرجت صفحة بيضاء.
  return createPortal(
    <div className="cs-modal" style={{
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
      {/* أنماط الطباعة: تُخفي التطبيق كله وتترك ورقة A4 وحدها بمقاسها الحقيقي،
          فتخرج الطباعة (وحفظ PDF من المتصفح) مطابقة لملف الخادم. */}
      <style>{`
        .cs-doc {
          font-family: "NotoSansArabic", Cairo, sans-serif;
          width: 210mm;
          height: 297mm;
          margin: 0;
          padding: 0 20px 20px 0;
          overflow: hidden;
          position: relative;
          direction: ltr;
          box-sizing: border-box;
          background: #fff;
        }
        .cs-doc h3 { color: #3773b9; text-align: center; }
        .cs-doc .Top-head { text-align: center; }
        .cs-doc .dark-head {
          color: #2b3d77;
          font-size: 19px;
          font-family: 'Amiri', serif;
          font-weight: 700;
        }
        .cs-doc .custom-table {
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
        .cs-doc .custom-table td {
          padding: 5px 7px;
          font-size: 14px;
          text-align: center;
          border: 1px solid #d0d0d0;
          vertical-align: middle;
          background-color: white;
          /* أمان النصوص الطويلة: تلتفّ داخل الخلية بدل توسيع الجدول. */
          word-break: break-word;
          overflow-wrap: anywhere;
        }
        .cs-doc .en-text { font-family: 'Amiri', serif; }
        .cs-doc .ar-text { font-family: "NotoSansArabic", sans-serif; }
        .cs-doc .ar-date { font-family: 'Amiri', serif; }
        .cs-doc .custom-table tr:first-child td {
          background-color: white !important;
          border: 1px solid #dee2e6;
        }
        .cs-doc .custom-table tr:first-child td:first-child {
          border-left: 1px solid #dee2e6;
          border-top: 1px solid #dee2e6;
          border-radius: 8px 0px 0px 0px;
        }
        .cs-doc .custom-table tr:first-child td:last-child {
          border-right: 1px solid #dee2e6;
          border-top: 1px solid #dee2e6;
          border-radius: 0px 8px 0px 0px;
        }
        .cs-doc .custom-table tr:last-child td:first-child {
          border-left: 1px solid #dee2e6;
          border-bottom: 1px solid #dee2e6;
          border-radius: 0px 0px 0px 8px;
        }
        .cs-doc .custom-table tr:last-child td:last-child {
          border-right: 1px solid #dee2e6;
          border-bottom: 1px solid #dee2e6;
          border-radius: 0px 0px 8px 0px;
        }
        .cs-doc .custom-table tr:first-child .one { font-weight: bold; }
        .cs-doc .custom-table tr:first-child .two { font-weight: 400; }
        .cs-doc .custom-table .one {
          width: 130px;
          min-width: 130px;
          color: #366fb4 !important;
          font-weight: 700;
          padding: 6px 0px;
          font-size: 13.5px;
        }
        .cs-doc .custom-table .two {
          color: #2b3d77 !important;
          font-size: 14px;
          font-weight: 400;
          line-height: 1.1;
          padding-top: 4px;
          padding-bottom: 4px;
        }
        /* صف «مدة الإجازة» الأزرق الداكن — منقول حرفياً من قالب الإجازة المرضية */
        .cs-doc .leave-duration {
          background-color: #2b3d76;
          color: #a8b9e0 !important;
          font-weight: 700;
        }
        .cs-doc .leave-duration td {
          font-size: 11px;
          background-color: #2b3d76 !important;
          color: #a8b9e0 !important;
        }
        .cs-doc .leave-duration .one { color: #ffffff !important; }
        .cs-doc .leave-duration .two { color: #ffffff !important; }
        .cs-doc .darkBg, .cs-doc .darkBg td { background-color: #f7f7f7 !important; }
        .cs-doc .custom-table tbody tr td:last-child { padding: 6px 4px; }
        .cs-doc .custom-table tbody tr td:last-child.ar-text {
          font-weight: 700;
          font-size: 13px;
        }
        .cs-doc .custom-table tbody tr .two.ar-text {
          font-weight: 400 !important;
          font-size: 14px;
        }
        .cs-doc .custom-table tbody tr .ar-text:not(.one) { font-weight: 400 !important; }
        .cs-doc .custom-table tbody tr td:nth-child(2),
        .cs-doc .custom-table tbody tr td:nth-child(3) { width: 50%; }
        .cs-doc .transparnt-bg td { background-color: transparent !important; }
        .cs-doc .header-logos {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 10px 20px;
          padding-top: 36px;
          background-color: #fff;
        }
        .cs-doc .logo-seha {
          flex: 1;
          display: flex;
          justify-content: flex-start;
          align-items: flex-start;
          margin-top: -8px;
        }
        .cs-doc .logo-ksa {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          padding-top: 20px;
        }
        .cs-doc .logo-ksa img { margin-bottom: -4px; }
        .cs-doc .logo-ksa .english-text {
          font-size: 15px;
          font-weight: 400;
          color: #000;
          margin: 0;
          text-align: center;
          font-family: 'Amiri', serif;
        }
        .cs-doc .logo-design {
          flex: 1;
          display: flex;
          justify-content: flex-end;
          align-items: flex-start;
        }
        .cs-doc .pdf-footer-section { display: flex; justify-content: space-between; }
        .cs-doc .qr-section {
          text-align: center;
          position: relative;
          margin-top: 21px;
          margin-right: -93px;
          flex: 1;
        }
        .cs-doc .qr-section a { position: absolute; bottom: 10; right: 25%; }
        .cs-doc .logo-section {
          display: flex;
          flex-direction: column;
          margin-top: 18px !important;
          flex: 1;
          margin-left: 65px;
        }
        .cs-doc .logo-section .text { font-size: 12px; text-align: right; }
        .cs-doc .timestamp { font-size: 13px; font-weight: 700; color: #000000; }
        .cs-doc .leave-report { font-size: 22px; color: #2f6db4; font-weight: 700; }
        .cs-doc .vertical-line {
          width: 1.5px;
          height: 190px;
          background-color: rgb(221, 221, 221);
          margin-top: 10px !important;
          margin-left: 174px;
          margin-right: 5px;
          flex-shrink: 0;
        }

        @media print {
          /* لا نطبع واجهة النافذة — الورقة وحدها بمقاسها الأصلي بلا تحجيم.
             ملاحظة: عناصر التحجيم تحمل أنماطاً سطرية (inline) لأن المعامل
             يُحسب في الـ JS، ولا يتغلّب عليها إلا !important — لذلك تُبطَّل هنا
             كل خاصية سطرية صراحةً (position/left/margin/transform/height).
             بدون ذلك تنهار الورقة إلى 0×0 وتخرج صفحة بيضاء. */
          @page { size: A4; margin: 0; }
          body > *:not(.cs-modal) { display: none !important; }
          .cs-modal {
            position: static !important;
            background: none !important;
            padding: 0 !important;
            display: block !important;
            z-index: auto !important;
          }
          .cs-modal .cs-chrome { display: none !important; }
          .cs-modal .cs-shell {
            display: block !important;
            max-width: none !important;
            max-height: none !important;
            width: auto !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }
          .cs-modal .cs-scroll {
            display: block !important;
            overflow: visible !important;
            padding: 0 !important;
            background: none !important;
            flex: none !important;
          }
          .cs-modal .cs-scale-box {
            width: auto !important;
            height: auto !important;
            position: static !important;
          }
          .cs-doc {
            transform: none !important;
            position: static !important;
            top: auto !important;
            left: auto !important;
            margin: 0 !important;
            box-shadow: none !important;
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
          }
          .cs-doc * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      <div className="cs-shell" style={{
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
        <div className="cs-chrome" style={{
          padding: '20px',
          borderBottom: '2px solid #e0e0e0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
          background: 'linear-gradient(135deg, #2f6db4 0%, #366fb4 100%)',
          color: 'white',
          borderRadius: '12px 12px 0 0'
        }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontFamily: 'Cairo, sans-serif' }}>معاينة تقرير مرافقة مريض</h2>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={generatePDF} disabled={downloading} style={btn(downloading ? '#8bc34a' : '#4CAF50', {
              cursor: downloading ? 'wait' : 'pointer',
              opacity: downloading ? 0.8 : 1,
            })}>
              {downloading ? '⏳ جاري التحميل...' : '📥 تحميل PDF'}
            </button>
            <button onClick={() => window.print()} style={btn('#0f766e')}>
              🖨️ طباعة
            </button>
            <button onClick={shareFile} disabled={sharing || preparing} style={btn('#2f6db4', {
              cursor: sharing || preparing ? 'wait' : 'pointer',
              opacity: sharing || preparing ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            })}>
              {preparing ? '⏳ جاري التجهيز...' : sharing ? '⏳ جاري المشاركة...' : '📤 مشاركة الملف'}
            </button>
            <button onClick={onClose} style={btn('#f44336')}>
              ✖ إغلاق
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="cs-scroll" style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '30px 16px',
          background: '#f5f5f5'
        }}>
          {/* صندوق التحجيم: يحجز الارتفاع بعد التصغير حتى لا يبقى فراغ أسفل الورقة */}
          <div
            ref={scaleBoxRef}
            className="cs-scale-box"
            style={{ width: '100%', height: A4_HEIGHT_PX * scale, position: 'relative' }}
          >
            <div ref={pdfRef} className="cs-doc" style={{
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              position: 'absolute',
              top: 0,
              left: '50%',
              marginLeft: -(A4_WIDTH_PX * scale) / 2,
              boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
            }} dangerouslySetInnerHTML={{
              __html: `
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
        <h3 class='leave-report' style="margin: 0px; padding: 0px; margin-bottom: -5px;">تقرير مرافقة مريض</h3>
        <div class="dark-head" style="margin: 0px; padding: 0px;">Companion Sick Leave Report</div>
      </div>

    </div>
   <table class="custom-table">
<tbody>
  <tr class="transparnt-bg">
    <td class="one en-text" colspan="1">Leave ID</td>
    <td class="two en-text" colspan="2">${escapeHtml(data.leave_id)}</td>
    <td class="one ar-text" colspan="1">رمز الإجازة</td>
  </tr>
  <tr class="leave-duration">
    <td class="one en-text">Leave Duration</td>
    <td class="two en-text">${days} ${days > 1 ? 'days' : 'day'} ( ${escapeHtml(formatDate(data.admission_date_en))} to ${escapeHtml(formatDate(data.discharge_date_en))} )</td>
    <td class="two ar-text" style="direction: rtl;"><span class="ar-date">${days}</span> ${days > 1 ? 'أيام' : 'يوم'} (<span class="ar-date" dir="ltr">${escapeHtml(formatHijriDate(data.admission_date_ar))}</span> الى <span class="ar-date" dir="ltr">${escapeHtml(formatHijriDate(data.discharge_date_ar))}</span>) </td>
    <td class="one ar-text">مدة الإجازة</td>
  </tr>
  <tr>
    <td class="one en-text">Admission Date</td>
    <td class="two en-text">${escapeHtml(formatDate(data.admission_date_en))}</td>
    <td class="two en-text">${escapeHtml(formatHijriDate(data.admission_date_ar))}</td>
    <td class="one ar-text">تاريخ الدخول</td>
  </tr>
  <tr class="darkBg">
    <td class="one en-text">Discharge Date</td>
    <td class="two en-text">${escapeHtml(formatDate(data.discharge_date_en))}</td>
    <td class="two en-text">${escapeHtml(formatHijriDate(data.discharge_date_ar))}</td>
    <td class="one ar-text">تاريخ الخروج</td>
  </tr>
  <tr>
    <td class="one en-text" colspan="1">Issue Date</td>
    <td class="two en-text" colspan="2">${escapeHtml(formatDate(data.issue_date))}</td>
    <td class="one ar-text" colspan="1">تاريخ إصدار التقرير</td>
  </tr>
  <tr class="darkBg">
    <td class="one en-text">Companion Name</td>
    <td class="two en-text">${escapeHtml((data.name_en || '').toUpperCase())}</td>
    <td class="two ar-text">${escapeHtml(data.name_ar)}</td>
    <td class="one ar-text">اسم المرافق</td>
  </tr>
  <tr>
    <td class="one en-text" colspan="1">National ID / Iqama</td>
    <td class="two en-text" colspan="2">${escapeHtml(data.national_id)}</td>
    <td class="one ar-text" colspan="1">رقم الهوية / الإقامة</td>
  </tr>
  <tr class="darkBg">
    <td class="one en-text">Nationality</td>
    <td class="two en-text">${escapeHtml(data.country?.country_name_en || 'Saudi')}</td>
    <td class="two ar-text">${escapeHtml(data.country?.country_name_ar || data.nationality || 'سعودي')}</td>
    <td class="one ar-text">الجنسية</td>
  </tr>
  <tr>
    <td class="one en-text">Relation</td>
    <td class="two en-text">${escapeHtml(data.relation_en)}</td>
    <td class="two ar-text">${escapeHtml(data.relation_ar)}</td>
    <td class="one ar-text">صلة القرابة</td>
  </tr>
  <tr class="darkBg">
    <td class="one en-text">Employer</td>
    <td class="two en-text">${escapeHtml(employerEn)}</td>
    <td class="two ar-text">${escapeHtml(data.employer_ar)}</td>
    <td class="one ar-text">جهة العمل</td>
  </tr>
  <tr>
    <td class="one en-text">Practitioner Name</td>
    <td class="two en-text">${escapeHtml((data.physician_name_en || '').toUpperCase())}</td>
    <td class="two ar-text">${escapeHtml(data.physician_name_ar)}</td>
    <td class="one ar-text">اسم الممارس</td>
  </tr>
  <tr class="darkBg">
    <td class="one en-text">Position</td>
    <td class="two en-text">${escapeHtml(data.position_en)}</td>
    <td class="two ar-text">${escapeHtml(data.position_ar)}</td>
    <td class="one ar-text">المسمى الوظيفى</td>
  </tr>
</tbody>

      </table>

<div class="pdf-footer-section" >
    <!-- QR Code Section -->
    <div class="qr-section">
    <div style="margin-left: 45px !important;">
             <img style="height: 90px;margin:0px " src="${escapeHtml(qrDataUri)}" alt="QR Code">

      <p class="ar-text" style='margin:0px ;margin-top : -5px !important ; font-size:10px !important; font-weight: 900 !important; color: #000;' >للتحقق من بيانات التقرير يرجى التأكد من زيارة موقع منصة صحة الرسمي</p>
      <p class="en-text" style='margin:0px ; font-size:10px !important; font-weight: 900 !important; color: #000;' >To check the report please visit Seha's official website</p>


<a class="en-text"
           style="margin: 0px; margin-top : 7px !important ; font-size: 10px; font-weight: 900 !important; color:blue; text-decoration: underline;"
          href='${escapeHtml(verificationUrl)}'
          target="_blank">${escapeHtml(verificationLabel)}</a>
    </div>
      <!-- Timestamp -->
  <div class="timestamp">
  <div style="margin-top: 46px !important; text-align:left !important ;  margin-left: 26px !important;">
      <p class="en-text" style='margin:0px;font-size:13px !important;font-weight: 700 !important;'>${escapeHtml(currentTime)}</p>
    <p class="en-text" style='margin:0px;font-size:13px !important;font-weight: 700 !important;'>${escapeHtml(currentDate)}</p></div>


  </div>




      </div>
    <div class="vertical-line"></div>
    <!-- Logo Section -->
    <div class="logo-section" >
      <div style="text-align: center; margin-right: 80px;">
        <img style="height: 100px ;" src='${escapeHtml(footerLogoSrc)}' alt="Health Facility Logo">
        <div style="line-height: 1.5; margin-top: 0px;">
          <p class="ar-text" style="margin: 0px; font-size: 12.8px; font-weight: 900;font-weight: bold !important;color: #000;">${escapeHtml(data.hospital_name_ar || 'مستشفى النور التخصصي')}</p>
          <p class="en-text" style="margin: 0px; font-size: 12.8px; font-weight: 900;font-weight: bold !important;color: #000;">${escapeHtml(data.hospital_name_en || 'AL NOOR SPECIALIST HOSPITAL')}</p>
          ${data.show_license_number !== false ? `<p class="ar-text" style="margin: 0px; font-size: 12px; font-weight: 900;color: #000;">رقم الترخيص: <span class="ar-date">${escapeHtml(data.license_number || '1410845906')}</span></p>` : ''}
        </div>
      </div>
      <div>
        <img style="width: 140px; height: 90px ;object-fit: contain;object-position: center;margin-left: 147px !important; margin-top:30px !important;" src='/images/national-center.jpg' alt="National Health Logo">
      </div>
    </div>
  </div>
            `
            }} />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CompanionSickLeavePDFOriginal;
