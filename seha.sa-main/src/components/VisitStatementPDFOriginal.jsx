import { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { fetchLeavePdfBlob, downloadLeavePdf, shareLeavePdf, prefetchLeavePdf } from '../utils/pdfShare';
import {
  formatDate,
  formatHijriDate,
  formatTime12,
  arabicMeridiem,
  calcWaitingPeriod,
  escapeHtml,
  defaultReportDate,
  defaultReportTime,
} from '../utils/documentFormat';
import { wrapName } from '../utils/nameWrap';

// ───────────────────────────────────────────────────────────────────────────
// معاينة «مشهد مراجعة» — Statement of Visit
//
// نسخة موازية لـ CompanionVisitPDFOriginal.jsx: نفس نظام المعاينة، ونفس أزرار
// التحميل/المشاركة (utils/pdfShare)، ونفس ملف الـ PDF المُولَّد من الخادم
// (middlewares/generateVisitStatementPdf.js) — يجب أن يبقى جدول الحقول هنا
// مطابقاً لما في الخادم حرفاً بحرف حتى تكون المعاينة صادقة.
//
// ثلاثة فروق مقصودة عن القالبين السابقين، كلها تحسينات لا تمسّهما:
//   • أنماط CSS مُنطّقة تحت .vs-doc بدل تسريب قواعد body على التطبيق كله.
//   • تحجيم تلقائي (transform: scale) ليظهر مقاس A4 كاملاً على الجوال.
//   • زر طباعة مع @media print يطبع الورقة وحدها بلا واجهة النافذة.
// ───────────────────────────────────────────────────────────────────────────
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

// مقاس A4 بالبكسل عند 96dpi — يُستخدم لحساب معامل التحجيم في المعاينة.
const A4_WIDTH_PX = 794
const A4_HEIGHT_PX = 1123

const VisitStatementPDFOriginal = ({ data, onClose }) => {
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

  const admissionTimeEn = formatTime12(data.admission_time);
  const dischargeTimeEn = formatTime12(data.discharge_time);
  const admissionTimeAr = admissionTimeEn ? `${admissionTimeEn.replace(/\s*(AM|PM)$/i, '')} ${arabicMeridiem(data.admission_time)}` : '';
  const dischargeTimeAr = dischargeTimeEn ? `${dischargeTimeEn.replace(/\s*(AM|PM)$/i, '')} ${arabicMeridiem(data.discharge_time)}` : '';

  const admissionEn = [formatDate(data.admission_date_en), admissionTimeEn].filter(Boolean).join(' - ');
  const dischargeEn = [formatDate(data.discharge_date_en), dischargeTimeEn].filter(Boolean).join(' - ');
  // العمود العربي يعرض التاريخ الهجري — كما في بقية القوالب، وبنفس منطق الخادم
  // بالضبط. القيمة مأخوذة من admission_date_ar المحفوظ، وهو مشتقّ خوارزمياً من
  // نفس التاريخ الميلادي عبر convertDates (hijri-converter) عند الحفظ والتعديل.
  const admissionAr = [formatHijriDate(data.admission_date_ar), admissionTimeAr].filter(Boolean).join(' - ');
  const dischargeAr = [formatHijriDate(data.discharge_date_ar), dischargeTimeAr].filter(Boolean).join(' - ');

  // نفس منطق الخادم: حقل «جهة العمل» واحد يملأ اللغتين، والمستند الأصلي يترك
  // الخانة الإنجليزية فارغة — فلا نعرضها إلا إن كانت مختلفة فعلاً عن العربية.
  const employerEn = (data.employer_en && data.employer_en !== data.employer_ar) ? data.employer_en : '';

  const waiting = calcWaitingPeriod(
    data.admission_date_en, data.admission_time,
    data.discharge_date_en, data.discharge_time
  );

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
    <div className="vs-modal" style={{
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
        .vs-doc {
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
        .vs-doc h3 { color: #3773b9; text-align: center; }
        .vs-doc .Top-head { text-align: center; }
        .vs-doc .dark-head {
          color: #2b3d77;
          font-size: 19px;
          font-family: 'Amiri', serif;
          font-weight: 700;
        }
        .vs-doc .custom-table {
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
        .vs-doc .custom-table td {
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
        .vs-doc .en-text { font-family: 'Amiri', serif; }
        .vs-doc .ar-text { font-family: "NotoSansArabic", sans-serif; }
        .vs-doc .ar-date { font-family: 'Amiri', serif; }
        .vs-doc .custom-table tr:first-child td {
          background-color: white !important;
          border: 1px solid #dee2e6;
        }
        .vs-doc .custom-table tr:first-child td:first-child {
          border-left: 1px solid #dee2e6;
          border-top: 1px solid #dee2e6;
          border-radius: 8px 0px 0px 0px;
        }
        .vs-doc .custom-table tr:first-child td:last-child {
          border-right: 1px solid #dee2e6;
          border-top: 1px solid #dee2e6;
          border-radius: 0px 8px 0px 0px;
        }
        .vs-doc .custom-table tr:last-child td:first-child {
          border-left: 1px solid #dee2e6;
          border-bottom: 1px solid #dee2e6;
          border-radius: 0px 0px 0px 8px;
        }
        .vs-doc .custom-table tr:last-child td:last-child {
          border-right: 1px solid #dee2e6;
          border-bottom: 1px solid #dee2e6;
          border-radius: 0px 0px 8px 0px;
        }
        .vs-doc .custom-table tr:first-child .one { font-weight: bold; }
        .vs-doc .custom-table tr:first-child .two { font-weight: 400; }
        .vs-doc .custom-table .one {
          width: 130px;
          min-width: 130px;
          color: #366fb4 !important;
          font-weight: 700;
          padding: 6px 0px;
          font-size: 13.5px;
        }
        .vs-doc .custom-table .two {
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
        .vs-doc .nb {
          white-space: nowrap;
        }
        /* كلمة واحدة أطول من أي عمود: يُسمح بالكسر داخلها وحدها حتى لا يتمدّد
           الجدول أعرض من الصفحة. */
        .vs-doc .brk {
          overflow-wrap: anywhere;
        }
        /* خلية اسم: توزيع الكلمات على الأسطر بالتساوي بدل ملء السطر الأول ثم
           ترك اللقب وحده في السطر التالي. حجم الخط وعرض الخلية وعدد الأسطر كما هي. */
        .vs-doc .name-cell {
          text-wrap: pretty;
          text-wrap: balance;
        }
        .vs-doc .darkBg, .vs-doc .darkBg td { background-color: #f7f7f7 !important; }
        /* الصفوف الثلاثة الزرقاء الداكنة: الدخول، الخروج، فترة الانتظار */
        .vs-doc .navy-row td {
          background-color: #2b3d76 !important;
          color: #ffffff !important;
        }
        .vs-doc .navy-row .one, .vs-doc .navy-row .two { color: #ffffff !important; }
        .vs-doc .custom-table tbody tr td:last-child { padding: 6px 4px; }
        .vs-doc .custom-table tbody tr td:last-child.ar-text {
          font-weight: 700;
          font-size: 13px;
        }
        .vs-doc .custom-table tbody tr .two.ar-text {
          font-weight: 400 !important;
          font-size: 14px;
        }
        .vs-doc .custom-table tbody tr .ar-text:not(.one) { font-weight: 400 !important; }
        .vs-doc .custom-table tbody tr td:nth-child(2),
        .vs-doc .custom-table tbody tr td:nth-child(3) { width: 50%; }
        .vs-doc .transparnt-bg td { background-color: transparent !important; }
        .vs-doc .header-logos {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 10px 20px;
          padding-top: 36px;
          background-color: #fff;
        }
        .vs-doc .logo-seha {
          flex: 1;
          display: flex;
          justify-content: flex-start;
          align-items: flex-start;
          margin-top: -8px;
        }
        .vs-doc .logo-ksa {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          padding-top: 20px;
        }
        .vs-doc .logo-ksa img { margin-bottom: -4px; }
        .vs-doc .logo-ksa .english-text {
          font-size: 15px;
          font-weight: 400;
          color: #000;
          margin: 0;
          text-align: center;
          font-family: 'Amiri', serif;
        }
        .vs-doc .logo-design {
          flex: 1;
          display: flex;
          justify-content: flex-end;
          align-items: flex-start;
        }
        .vs-doc .pdf-footer-section { display: flex; justify-content: space-between; }
        .vs-doc .qr-section {
          text-align: center;
          position: relative;
          margin-top: 21px;
          margin-right: -93px;
          flex: 1;
        }
        .vs-doc .qr-section a { position: absolute; bottom: 10; right: 25%; }
        .vs-doc .logo-section {
          display: flex;
          flex-direction: column;
          margin-top: 18px !important;
          flex: 1;
          margin-left: 65px;
        }
        .vs-doc .logo-section .text { font-size: 12px; text-align: right; }
        .vs-doc .timestamp { font-size: 13px; font-weight: 700; color: #000000; }
        .vs-doc .leave-report { font-size: 22px; color: #2f6db4; font-weight: 700; }
        .vs-doc .vertical-line {
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
          body > *:not(.vs-modal) { display: none !important; }
          .vs-modal {
            position: static !important;
            background: none !important;
            padding: 0 !important;
            display: block !important;
            z-index: auto !important;
          }
          .vs-modal .vs-chrome { display: none !important; }
          .vs-modal .vs-shell {
            display: block !important;
            max-width: none !important;
            max-height: none !important;
            width: auto !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }
          .vs-modal .vs-scroll {
            display: block !important;
            overflow: visible !important;
            padding: 0 !important;
            background: none !important;
            flex: none !important;
          }
          .vs-modal .vs-scale-box {
            width: auto !important;
            height: auto !important;
            position: static !important;
          }
          .vs-doc {
            transform: none !important;
            position: static !important;
            top: auto !important;
            left: auto !important;
            margin: 0 !important;
            box-shadow: none !important;
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
          }
          .vs-doc * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      <div className="vs-shell" style={{
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
        <div className="vs-chrome" style={{
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
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontFamily: 'Cairo, sans-serif' }}>معاينة مشهد مراجعة</h2>
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
        <div className="vs-scroll" style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '30px 16px',
          background: '#f5f5f5'
        }}>
          {/* صندوق التحجيم: يحجز الارتفاع بعد التصغير حتى لا يبقى فراغ أسفل الورقة */}
          <div
            ref={scaleBoxRef}
            className="vs-scale-box"
            style={{ width: '100%', height: A4_HEIGHT_PX * scale, position: 'relative' }}
          >
            <div ref={pdfRef} className="vs-doc" style={{
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
        <h3 class='leave-report' style="margin: 0px; padding: 0px; margin-bottom: -5px;">مشهد مراجعة</h3>
        <div class="dark-head" style="margin: 0px; padding: 0px;">Statement of Visit</div>
      </div>

    </div>
   <table class="custom-table">
<tbody>
  <tr class="transparnt-bg">
    <td class="one en-text" colspan="1">Leave ID</td>
    <td class="two en-text" colspan="2">${escapeHtml(data.leave_id)}</td>
    <td class="one ar-text" colspan="1">رمز الإجازة</td>
  </tr>
  <tr class="navy-row">
    <td class="one en-text">Admission Date</td>
    <td class="two en-text">${escapeHtml(admissionEn)}</td>
    <td class="two ar-text" style="direction: rtl;">${escapeHtml(admissionAr)}</td>
    <td class="one ar-text">تاريخ الدخول</td>
  </tr>
  <tr class="navy-row">
    <td class="one en-text">Discharge Date</td>
    <td class="two en-text">${escapeHtml(dischargeEn)}</td>
    <td class="two ar-text" style="direction: rtl;">${escapeHtml(dischargeAr)}</td>
    <td class="one ar-text">تاريخ الخروج</td>
  </tr>
  <tr class="navy-row">
    <td class="one en-text">Waiting Period</td>
    <td class="two en-text">${escapeHtml(waiting.en)}</td>
    <td class="two ar-text" style="direction: rtl;">${escapeHtml(waiting.ar)}</td>
    <td class="one ar-text">فترة الانتظار</td>
  </tr>
  <tr>
    <td class="one en-text" colspan="1">Issue Date</td>
    <td class="two en-text" colspan="2">${escapeHtml(formatDate(data.issue_date))}</td>
    <td class="one ar-text" colspan="1">تاريخ اصدار التقرير</td>
  </tr>
  <tr class="darkBg">
    <td class="one en-text">Name</td>
    <td class="two en-text name-cell">${wrapName((data.name_en || '').toUpperCase())}</td>
    <td class="two ar-text name-cell">${wrapName(data.name_ar)}</td>
    <td class="one ar-text">الاسم</td>
  </tr>
  <tr>
    <td class="one en-text" colspan="1">National ID / Iqama</td>
    <td class="two en-text" colspan="2">${escapeHtml(data.national_id)}</td>
    <td class="one ar-text" colspan="1">رقم الهوية/الإقامة</td>
  </tr>
  <tr class="darkBg">
    <td class="one en-text">Nationality</td>
    <td class="two en-text">${escapeHtml(data.country?.country_name_en || 'Saudi')}</td>
    <td class="two ar-text">${escapeHtml(data.country?.country_name_ar || data.nationality || 'سعودي')}</td>
    <td class="one ar-text">الجنسية</td>
  </tr>
  <tr>
    <td class="one en-text">Employer</td>
    <td class="two en-text">${escapeHtml(employerEn)}</td>
    <td class="two ar-text">${escapeHtml(data.employer_ar)}</td>
    <td class="one ar-text">جهة العمل</td>
  </tr>
  <tr class="darkBg">
    <td class="one en-text">Practitioner Name</td>
    <td class="two en-text name-cell">${wrapName((data.physician_name_en || '').toUpperCase())}</td>
    <td class="two ar-text name-cell">${wrapName(data.physician_name_ar)}</td>
    <td class="one ar-text">اسم الممارس</td>
  </tr>
  <tr>
    <td class="one en-text">Position</td>
    <td class="two en-text">${escapeHtml(data.position_en)}</td>
    <td class="two ar-text">${escapeHtml(data.position_ar)}</td>
    <td class="one ar-text">المسمى الوظيفي</td>
  </tr>
  <tr class="darkBg">
    <!-- "Visitn Type" مكتوبة هكذا في المستند الرسمي المرفق — أُبقيت مطابقةً للأصل. -->
    <td class="one en-text">Visitn Type</td>
    <td class="two en-text">${escapeHtml(data.visit_type_en)}</td>
    <td class="two ar-text">${escapeHtml(data.visit_type_ar)}</td>
    <td class="one ar-text">نوع الزيارة</td>
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

export default VisitStatementPDFOriginal;
