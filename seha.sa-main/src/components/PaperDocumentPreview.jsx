import { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { fetchLeavePdfBlob, downloadLeavePdf, shareLeavePdf, prefetchLeavePdf } from '../utils/pdfShare';

// ───────────────────────────────────────────────────────────────────────────
// معاينة التقارير الورقية.
//
// لا يحوي هذا المكوّن أي تصميم للمستند إطلاقاً: يطلب HTML الجاهز من الخادم
// (POST /documents/preview-html) وهو نفس الـ HTML الذي يُطبع في الـ PDF
// حرفاً بحرف. مصدر واحد للتصميم، فلا يمكن أن تنحرف المعاينة عن المطبوع.
//
// يُعرض داخل <iframe> لسببين: عزل تام لأنماط المستند عن أنماط الموقع،
// ومقاس A4 حقيقي. والطباعة تُنفَّذ على الإطار نفسه فتخرج الورقة وحدها.
// ───────────────────────────────────────────────────────────────────────────
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

const A4_W = 794
const A4_H = 1123

const PaperDocumentPreview = ({ data, onClose }) => {
  const frameRef = useRef(null)
  const boxRef = useRef(null)
  const [html, setHtml] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [scale, setScale] = useState(1)
  const [downloading, setDownloading] = useState(false)
  const [sharing, setSharing] = useState(false)

  // HTML المستند من الخادم — يُعاد الطلب كلما تغيّرت البيانات أو الخط،
  // فتعكس المعاينة أي تعديل فوراً.
  const payload = JSON.stringify(data || {})
  useEffect(() => {
    let alive = true
    setLoading(true); setError('')
    fetch(`${API_BASE_URL}/documents/preview-html`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`preview failed (${r.status})`)
        return r.text()
      })
      .then((t) => { if (alive) { setHtml(t); setLoading(false) } })
      .catch((e) => { if (alive) { setError(e.message); setLoading(false) } })
    return () => { alive = false }
  }, [payload])

  // تصغير الورقة لتناسب الشاشة — المقاس الحقيقي داخل الإطار يبقى A4.
  const applyScale = useCallback(() => {
    const box = boxRef.current
    if (!box || !box.clientWidth) return
    setScale(Math.min(1, box.clientWidth / A4_W))
  }, [])

  useEffect(() => {
    applyScale()
    const ro = new ResizeObserver(applyScale)
    if (boxRef.current) ro.observe(boxRef.current)
    window.addEventListener('resize', applyScale)
    return () => { ro.disconnect(); window.removeEventListener('resize', applyScale) }
  }, [applyScale])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // تجهيز ملف الـ PDF مسبقاً للسجلات المحفوظة حتى تنجح المشاركة من أول ضغطة.
  useEffect(() => {
    if (data?.service_num && data?.national_id) prefetchLeavePdf(data)?.catch(() => {})
  }, [data?.service_num, data?.national_id])

  if (!data) return null

  const isSaved = Boolean(data.service_num && data.national_id)

  const printDoc = () => {
    const w = frameRef.current?.contentWindow
    if (!w) return
    w.focus()
    w.print()
  }

  const downloadPdf = async () => {
    if (downloading) return
    setDownloading(true)
    try {
      const blob = await (prefetchLeavePdf(data) || fetchLeavePdfBlob(data))
      downloadLeavePdf(blob)
    } catch (e) {
      console.error('❌ PDF download error:', e)
      alert('تعذّر تنزيل الـ PDF. احفظ المستند أولاً ثم أعد المحاولة.')
    } finally { setDownloading(false) }
  }

  const share = async () => {
    if (sharing) return
    setSharing(true)
    try {
      const r = await shareLeavePdf(data)
      if (r?.downloaded) alert('هذا المتصفح لا يدعم مشاركة الملفات، فتم تنزيل الملف.')
    } catch (e) {
      console.error('❌ share error:', e)
      alert('تعذّرت المشاركة، حاول مرة أخرى.')
    } finally { setSharing(false) }
  }

  const btn = (bg, extra = {}) => ({
    padding: '10px 18px', border: 'none', borderRadius: 6, cursor: 'pointer',
    fontSize: '.95rem', fontFamily: 'Cairo, sans-serif', background: bg, color: '#fff', ...extra,
  })

  return createPortal(
    <div className="pd-modal" style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <style>{`
        @media print {
          /* الطباعة تتم على الإطار نفسه؛ نخفي واجهة الموقع احتياطاً. */
          body > *:not(.pd-modal) { display: none !important; }
          .pd-modal { position: static !important; background: none !important; padding: 0 !important; }
          .pd-modal .pd-chrome { display: none !important; }
        }
      `}</style>

      <div style={{
        background: '#fff', borderRadius: 12, width: '100%', maxWidth: 900, maxHeight: '90vh',
        display: 'flex', flexDirection: 'column', boxShadow: '0 10px 40px rgba(0,0,0,.3)',
      }}>
        <div className="pd-chrome" style={{
          padding: 18, borderBottom: '2px solid #e0e0e0', display: 'flex', gap: 10,
          justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap',
          background: 'linear-gradient(135deg,#2f6db4,#366fb4)', color: '#fff', borderRadius: '12px 12px 0 0',
        }}>
          <h2 style={{ margin: 0, fontSize: '1.3rem', fontFamily: 'Cairo, sans-serif' }}>
            معاينة {data.__templateTitle || 'المستند'}
          </h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={printDoc} style={btn('#0f766e')}>🖨️ طباعة</button>
            <button onClick={downloadPdf} disabled={downloading || !isSaved} style={btn(isSaved ? '#4CAF50' : '#9e9e9e', {
              cursor: isSaved ? (downloading ? 'wait' : 'pointer') : 'not-allowed', opacity: isSaved ? 1 : .75,
            })} title={isSaved ? '' : 'احفظ المستند أولاً'}>
              {downloading ? '⏳ جاري التحميل...' : '📥 تحميل PDF'}
            </button>
            <button onClick={share} disabled={sharing || !isSaved} style={btn('#2f6db4', {
              cursor: isSaved ? 'pointer' : 'not-allowed', opacity: isSaved ? 1 : .75,
            })}>📤 مشاركة</button>
            <button onClick={onClose} style={btn('#f44336')}>✖ إغلاق</button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '24px 16px', background: '#f5f5f5' }}>
          {loading && <div style={{ textAlign: 'center', padding: 40, fontFamily: 'Cairo, sans-serif' }}>جاري تجهيز المعاينة...</div>}
          {error && (
            <div style={{ textAlign: 'center', padding: 30, color: '#b91c1c', fontFamily: 'Cairo, sans-serif' }}>
              تعذّر تحميل المعاينة: {error}
            </div>
          )}
          {!loading && !error && (
            <div ref={boxRef} style={{ width: '100%', height: A4_H * scale, position: 'relative' }}>
              <iframe
                ref={frameRef}
                title="paper-document"
                srcDoc={html}
                style={{
                  width: A4_W, height: A4_H, border: 0, background: '#fff',
                  transform: `scale(${scale})`, transformOrigin: 'top left',
                  position: 'absolute', top: 0, left: '50%',
                  marginLeft: -(A4_W * scale) / 2,
                  boxShadow: '0 2px 12px rgba(0,0,0,.12)',
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

export default PaperDocumentPreview
