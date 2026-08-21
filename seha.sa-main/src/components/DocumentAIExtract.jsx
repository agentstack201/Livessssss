import { useRef, useState } from 'react'

// ───────────────────────────────────────────────────────────────────────────
// استخراج البيانات من ملف مرفوع.
//
// الملف مصدر بيانات فقط: يرفعه المستخدم، فيقرأه الذكاء الاصطناعي في الخادم
// ويعيد القيم ونوع القالب المطابق. التصميم لا يأتي من الملف إطلاقاً — بل من
// القالب المحفوظ في النظام. وما لا يجده يبقى فارغاً، ثم يعدّل المستخدم يدوياً.
// ───────────────────────────────────────────────────────────────────────────
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
const MAX_BYTES = 12 * 1024 * 1024

const ACCEPT = '.pdf,.docx,.txt,image/*'

export default function DocumentAIExtract({ onExtracted }) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [result, setResult] = useState(null)
  const [drag, setDrag] = useState(false)

  const handleFile = async (file) => {
    if (!file) return
    setErr(''); setResult(null)
    if (file.size > MAX_BYTES) { setErr('حجم الملف يتجاوز 12 ميجابايت'); return }

    setBusy(true)
    try {
      const dataBase64 = await new Promise((resolve, reject) => {
        const rd = new FileReader()
        rd.onerror = () => reject(new Error('تعذّرت قراءة الملف'))
        rd.onloadend = () => resolve(String(rd.result).split(',')[1] || '')
        rd.readAsDataURL(file)
      })

      const token = localStorage.getItem('token')
      const r = await fetch(`${API_BASE_URL}/documents/ai-extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ file: { dataBase64, mimeType: file.type, fileName: file.name } }),
      })
      const j = await r.json()
      if (!r.ok || !j.success) throw new Error(j.message || 'تعذّر الاستخراج')

      setResult(j.data)
      onExtracted?.(j.data)
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div
      style={{ ...S.wrap, ...(drag ? S.wrapDrag : null) }}
      onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files?.[0]) }}
    >
      <div style={S.head}>
        <span style={S.title}>📎 استخراج البيانات من ملف</span>
        <span style={S.sub}>PDF · Word · صورة · مستند ممسوح</span>
      </div>

      <p style={S.note}>
        ارفع المستند وسيقرأه النظام ويحدّد القالب المطابق ويعبّئ الحقول.
        التصميم يأتي دائماً من القالب المحفوظ، والملف مصدر بيانات فقط.
        ما لا يوجد في الملف يبقى فارغاً، ويمكنك تعديل كل شيء بعدها.
      </p>

      <div style={S.row}>
        <button type="button" style={S.btn} disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? '⏳ جاري القراءة...' : '⬆️ اختر ملفاً'}
        </button>
        <span style={S.hint}>أو اسحب الملف وأفلته هنا</span>
      </div>

      <input ref={inputRef} type="file" accept={ACCEPT} style={{ display: 'none' }}
        onChange={(e) => handleFile(e.target.files?.[0])} />

      {err && <div style={S.err}>⚠️ {err}</div>}

      {result && (
        <div style={S.res}>
          <div style={S.resRow}>
            <b>القالب المطابق:</b>
            <span>{result.template_title || 'لم يُطابق أي قالب محفوظ'}</span>
            {result.confidence != null && <span style={S.badge}>ثقة {Math.round(result.confidence * 100)}%</span>}
          </div>
          <div style={S.resRow}>
            <b>حقول مُعبّأة:</b> <span>{result.filled}</span>
            <span style={S.badge}>{result.source}</span>
          </div>
          {result.notes && <div style={S.notes}>{result.notes}</div>}
        </div>
      )}
    </div>
  )
}

const S = {
  wrap: { border: '2px dashed #cbd5e1', borderRadius: 12, padding: 16, background: '#fbfdff', marginBottom: 18 },
  wrapDrag: { borderColor: '#2f6db4', background: '#eff6ff' },
  head: { display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' },
  title: { fontWeight: 800, fontSize: '1rem', color: '#1e293b' },
  sub: { fontSize: '.78rem', color: '#94a3b8', fontWeight: 600 },
  note: { fontSize: '.82rem', color: '#64748b', lineHeight: 1.75, margin: '6px 0 10px' },
  row: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  btn: { padding: '9px 18px', border: 0, borderRadius: 8, background: '#2f6db4', color: '#fff', fontFamily: 'inherit', fontWeight: 700, fontSize: '.9rem', cursor: 'pointer' },
  hint: { fontSize: '.8rem', color: '#94a3b8' },
  err: { marginTop: 10, color: '#b91c1c', fontSize: '.85rem', fontWeight: 600 },
  res: { marginTop: 12, padding: 10, borderRadius: 8, background: '#ecfdf5', border: '1px solid #a7f3d0' },
  resRow: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: '.86rem', color: '#065f46', marginBottom: 4 },
  badge: { fontSize: '.72rem', fontWeight: 700, background: '#d1fae5', color: '#047857', borderRadius: 999, padding: '1px 8px' },
  notes: { fontSize: '.8rem', color: '#475569', marginTop: 4 },
}
