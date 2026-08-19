import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { downloadLeavePdf, shareLeavePdf } from '../utils/pdfShare'
import {
  TEMPLATE5_ID,
  TEMPLATE5_NAME_AR,
  TEMPLATE5_MOCKUP_NOTICE,
  fetchTemplate5PreviewBlob,
} from '../config/template5'

// ───────────────────────────────────────────────────────────────────────────
// معاينة القالب الخامس — «تقرير إجازة مرضية - محسن»
//
// هذه النافذة لا ترسم المستند ولا تحاكيه: القالب ملف PDF أصلي، والخادم يحقن
// فيه البيانات ويعيد الملف نفسه، وهنا نعرضه كما هو داخل إطار عرض المتصفح.
// لذلك ما يظهر في المعاينة هو الملف المُنزَّل نفسه بايتاً ببايت — لا فرق بين
// «الشكل في الشاشة» و«الشكل في الطباعة»، ولا نسخة HTML موازية يمكن أن تنحرف.
// ───────────────────────────────────────────────────────────────────────────

const SickLeaveEnhancedPDFTemplate5 = ({ data, onClose }) => {
  const [blob, setBlob] = useState(null)
  const [error, setError] = useState('')
  const [sharing, setSharing] = useState(false)

  // نُعيد التوليد كلما تغيّرت البيانات — القالب واحد والبيانات هي المتغيّر.
  const dataKey = useMemo(() => JSON.stringify(data || {}), [data])

  useEffect(() => {
    let alive = true
    setBlob(null)
    setError('')
    fetchTemplate5PreviewBlob(data)
      .then((result) => { if (alive) setBlob(result) })
      .catch((err) => {
        console.error('❌ Template 5 preview error:', err)
        if (alive) setError('تعذّر توليد المعاينة. تأكّد من اتصال الخادم ثم أعد المحاولة.')
      })
    return () => { alive = false }
  }, [dataKey])

  // رابط العرض داخل الإطار — يُحرَّر عند الإغلاق فلا يتسرّب.
  const objectUrl = useMemo(() => (blob ? URL.createObjectURL(blob) : ''), [blob])
  useEffect(() => () => { if (objectUrl) URL.revokeObjectURL(objectUrl) }, [objectUrl])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!data) return null

  const download = () => {
    if (blob) downloadLeavePdf(blob)
  }

  const print = () => {
    // الطباعة من عارض الـ PDF نفسه — فتخرج الورقة كما هي بلا أي تدخّل.
    const frame = document.getElementById('t5-frame')
    if (frame?.contentWindow) {
      try {
        frame.contentWindow.focus()
        frame.contentWindow.print()
        return
      } catch { /* بعض المتصفحات تمنع الطباعة عبر الإطار — نفتح الملف بدلها */ }
    }
    if (objectUrl) window.open(objectUrl, '_blank')
  }

  const share = async () => {
    if (!blob || sharing) return
    setSharing(true)
    try {
      const result = await shareLeavePdf(data, blob)
      if (result?.downloaded) {
        alert('هذا المتصفح لا يدعم مشاركة الملفات مباشرةً، فتم تنزيل الملف. للمشاركة استخدم الهاتف.')
      }
    } catch (err) {
      console.error('❌ PDF share error:', err)
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
      inset: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 9999,
      padding: '20px',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '900px',
        height: '92vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
      }}>
        <div style={{
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
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontFamily: 'Cairo, sans-serif' }}>
              {`معاينة ${TEMPLATE5_NAME_AR}`}
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: '0.85rem', fontFamily: 'Cairo, sans-serif', opacity: 0.92 }}>
              🧩 {TEMPLATE5_MOCKUP_NOTICE}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={download} disabled={!blob} style={btn('#4CAF50', {
              cursor: blob ? 'pointer' : 'wait', opacity: blob ? 1 : 0.7,
            })}>📥 تحميل PDF</button>
            <button onClick={print} disabled={!blob} style={btn('#0f766e', {
              cursor: blob ? 'pointer' : 'wait', opacity: blob ? 1 : 0.7,
            })}>🖨️ طباعة</button>
            <button onClick={share} disabled={!blob || sharing} style={btn('#2f6db4', {
              cursor: blob && !sharing ? 'pointer' : 'wait', opacity: blob && !sharing ? 1 : 0.7,
            })}>{sharing ? '⏳ جاري المشاركة...' : '📤 مشاركة الملف'}</button>
            <button onClick={onClose} style={btn('#f44336')}>✖ إغلاق</button>
          </div>
        </div>

        <div style={{ flex: 1, background: '#f5f5f5', display: 'flex', minHeight: 0 }}>
          {error ? (
            <p style={{ margin: 'auto', color: '#b91c1c', fontFamily: 'Cairo, sans-serif' }}>{error}</p>
          ) : !objectUrl ? (
            <p style={{ margin: 'auto', color: '#475569', fontFamily: 'Cairo, sans-serif' }}>
              ⏳ جاري تجهيز المعاينة...
            </p>
          ) : (
            <iframe
              id="t5-frame"
              title={TEMPLATE5_NAME_AR}
              src={objectUrl}
              style={{ flex: 1, border: 'none', width: '100%', height: '100%' }}
            />
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

export default SickLeaveEnhancedPDFTemplate5
