import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { fetchLeavePdfBlob, downloadLeavePdf, shareLeavePdf, prefetchLeavePdf } from '../utils/pdfShare'
import { escapeHtml, defaultReportDate, defaultReportTime } from '../utils/documentFormat'
import { wrapName, wrapText } from '../utils/nameWrap'
import {
  TEMPLATE5_ID,
  TEMPLATE5_NAME_AR,
  TEMPLATE5_MOCKUP_NOTICE,
  renderTemplate5,
} from '../templates/template5'

// ───────────────────────────────────────────────────────────────────────────
// معاينة القالب الخامس — «تقرير إجازة مرضية - محسن»
//
// هذا المكوّن لا يعرّف تخطيطاً ولا تنسيقاً بنفسه: كل شكل الورقة يأتي من
// src/templates/template5 (نفس الوحدة التي يستخدمها مولّد الـ PDF في الخادم)،
// فالمعاينة هي المستند نفسه لا شبيهه. ما يخصّ هذا الملف وحده هو غلاف النافذة:
// الأزرار، التحجيم لعرض الشاشة، وأنماط الطباعة.
//
// القالب مستقلٌّ تماماً عن «تقرير إجازة مرضية» القائم: ملفات مختلفة، معرّف
// مختلف، وتنسيقات بأسماء أصناف مسبوقة بـ t5- فلا تتقاطع مع أي قالب آخر.
//
// طبيعته: نموذج تصميم قابل للتحرير (mockup) داخل التطبيق — لذلك تحمل ترويسة
// النافذة تنبيهاً صريحاً بذلك، ولا يحوي القالب رمز تحقّق ولا رابط توثيق.
// ───────────────────────────────────────────────────────────────────────────
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

// مقاس A4 بالبكسل عند 96dpi — لحساب معامل التحجيم داخل النافذة فقط.
const A4_WIDTH_PX = 794
const A4_HEIGHT_PX = 1123

const DEFAULT_FOOTER_LOGO = '/images/1.png'

// خطوط المعاينة تُحمّل من مجلد public. الخادم يضمّنها base64 بدلاً من ذلك،
// وهي نفس ملفات الـ TTF في الحالتين فتتطابق القياسات.
const PREVIEW_FONT_FACE_CSS = `
@font-face { font-family: 'NotoSansArabic'; src: url('/fonts/NotoSansArabic-Bold.ttf') format('truetype'); font-weight: 700; font-style: normal; }
@font-face { font-family: 'NotoSansArabic'; src: url('/fonts/NotoSansArabic-Regular.ttf') format('truetype'); font-weight: 400; font-style: normal; }
@font-face { font-family: 'Amiri'; src: url('/fonts/Amiri-Bold.ttf') format('truetype'); font-weight: 700; font-style: normal; }
@font-face { font-family: 'Amiri'; src: url('/fonts/Amiri-Regular.ttf') format('truetype'); font-weight: 400; font-style: normal; }
`

const SickLeaveEnhancedPDFTemplate5 = ({ data, onClose }) => {
  const pdfRef = useRef()
  const scaleBoxRef = useRef()
  const [downloading, setDownloading] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [preparing, setPreparing] = useState(true)
  const [scale, setScale] = useState(1)

  // نجهّز ملف الـ PDF فور فتح المعاينة حتى تنجح المشاركة من أول ضغطة.
  useEffect(() => {
    let alive = true
    if (data?.service_num && data?.national_id) {
      setPreparing(true)
      prefetchLeavePdf(data)
        .then(() => { if (alive) setPreparing(false) })
        .catch(() => { if (alive) setPreparing(false) })
    }
    return () => { alive = false }
  }, [data?.service_num, data?.national_id])

  // تحجيم المعاينة لتناسب عرض الشاشة: الورقة تبقى 210mm حقيقية (فلا يتغيّر
  // شيء عند الطباعة) لكنها تُعرض مصغّرة على الشاشات الضيقة.
  const applyScale = useCallback(() => {
    const box = scaleBoxRef.current
    if (!box) return
    const available = box.clientWidth
    if (!available) return
    setScale(Math.min(1, available / A4_WIDTH_PX))
  }, [])

  useEffect(() => {
    applyScale()
    const observer = new ResizeObserver(applyScale)
    if (scaleBoxRef.current) observer.observe(scaleBoxRef.current)
    window.addEventListener('resize', applyScale)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', applyScale)
    }
  }, [applyScale])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // الورقة نفسها — تُبنى من وحدة القالب المشتركة مع الخادم.
  const document5 = useMemo(() => {
    if (!data) return null
    const footerLogo = data.footer_logo
      ? (data.footer_logo.startsWith('http') || data.footer_logo.startsWith('data:')
        ? data.footer_logo
        : `${API_BASE_URL}${data.footer_logo}`)
      : DEFAULT_FOOTER_LOGO

    return renderTemplate5({
      data,
      leaveDays: data.leave_days,
      country: data.country,
      reportDate: defaultReportDate(),
      reportTime: defaultReportTime(),
      fontFaceCss: PREVIEW_FONT_FACE_CSS,
      assets: {
        seha: '/images/seha.jpg',
        crest: '/images/saudia1.jpg',
        decor: '/images/3.PNG',
        facilityLogo: footerLogo,
        centerLogo: '/images/national-center.jpg',
      },
      helpers: { wrapName, wrapText, escapeHtml },
    })
  }, [data])

  if (!data || !document5) {
    return null
  }

  const generatePDF = async () => {
    if (downloading) return
    setDownloading(true)
    try {
      const blob = await (prefetchLeavePdf(data) || fetchLeavePdfBlob(data))
      downloadLeavePdf(blob)
    } catch (error) {
      console.error('❌ PDF download error:', error)
      alert('حدث خطأ أثناء تنزيل ملف PDF. يرجى المحاولة مرة أخرى.')
    } finally {
      setDownloading(false)
    }
  }

  const shareFile = async () => {
    if (sharing) return
    setSharing(true)
    try {
      const result = await shareLeavePdf(data)
      if (result?.downloaded) {
        alert('هذا المتصفح لا يدعم مشاركة الملفات مباشرةً، فتم تنزيل الملف. للمشاركة استخدم الهاتف.')
      }
    } catch (error) {
      console.error('❌ PDF share error:', error)
      alert('تعذّرت المشاركة، الملف جاهز الآن — اضغط «مشاركة الملف» مرة أخرى.')
    } finally {
      setSharing(false)
    }
  }

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
  })

  return createPortal(
    <div className="t5-modal" data-template-id={TEMPLATE5_ID} style={{
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
      padding: '20px',
    }}>
      <style>{`
        ${document5.css}

        @media print {
          /* لا نطبع واجهة النافذة — الورقة وحدها بمقاسها الأصلي بلا تحجيم.
             عناصر التحجيم تحمل أنماطاً سطرية يحسبها الـ JS، فلا يتغلّب عليها
             إلا !important — لذلك تُبطَّل هنا صراحةً. */
          @page { size: A4; margin: 0; }
          body > *:not(.t5-modal) { display: none !important; }
          .t5-modal {
            position: static !important;
            background: none !important;
            padding: 0 !important;
            display: block !important;
            z-index: auto !important;
          }
          .t5-modal .t5-chrome { display: none !important; }
          .t5-modal .t5-shell {
            display: block !important;
            max-width: none !important;
            max-height: none !important;
            width: auto !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }
          .t5-modal .t5-scroll {
            display: block !important;
            overflow: visible !important;
            padding: 0 !important;
            background: none !important;
            flex: none !important;
          }
          .t5-modal .t5-scale-box {
            width: auto !important;
            height: auto !important;
            position: static !important;
          }
          .t5-modal .t5-root {
            transform: none !important;
            position: relative !important;
            top: auto !important;
            left: auto !important;
            margin: 0 !important;
            box-shadow: none !important;
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
          }
          .t5-modal .t5-root * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      <div className="t5-shell" style={{
        background: 'white',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '900px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
      }}>
        <div className="t5-chrome" style={{
          padding: '20px',
          borderBottom: '2px solid #e0e0e0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
          background: 'linear-gradient(135deg, #2c3e77 0%, #366fb5 100%)',
          color: 'white',
          borderRadius: '12px 12px 0 0',
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.5rem', fontFamily: 'Cairo, sans-serif' }}>
              {`معاينة ${TEMPLATE5_NAME_AR}`}
            </h2>
            {/* تعريف صريح بطبيعة القالب داخل الواجهة. */}
            <p style={{
              margin: '6px 0 0',
              fontSize: '0.85rem',
              fontFamily: 'Cairo, sans-serif',
              opacity: 0.92,
            }}>
              🧩 {TEMPLATE5_MOCKUP_NOTICE}
            </p>
          </div>
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
            })}>
              {preparing ? '⏳ جاري التجهيز...' : sharing ? '⏳ جاري المشاركة...' : '📤 مشاركة الملف'}
            </button>
            <button onClick={onClose} style={btn('#f44336')}>
              ✖ إغلاق
            </button>
          </div>
        </div>

        <div className="t5-scroll" style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '30px 16px',
          background: '#f5f5f5',
        }}>
          <div
            ref={scaleBoxRef}
            className="t5-scale-box"
            style={{ width: '100%', height: A4_HEIGHT_PX * scale, position: 'relative' }}
          >
            {/* الورقة: HTML القالب كما يبنيه المولّد المشترك، مصغّراً بصرياً فقط. */}
            <div
              ref={pdfRef}
              className="t5-paper"
              style={{
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                position: 'absolute',
                top: 0,
                left: '50%',
                marginLeft: -(A4_WIDTH_PX * scale) / 2,
                boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
                width: A4_WIDTH_PX,
              }}
              dangerouslySetInnerHTML={{ __html: document5.html }}
            />
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default SickLeaveEnhancedPDFTemplate5
