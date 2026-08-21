import { useEffect, useMemo, useRef, useState } from 'react'
import MediaPicker from './MediaPicker'

// ───────────────────────────────────────────────────────────────────────────
// محرّر حقول التقارير الورقية.
//
// لا يعرف هذا المكوّن أي قالب بعينه: يقرأ وصف الحقول من الخادم
// (GET /documents/templates) ويبني المدخلات تلقائياً مجمَّعةً حسب أقسامها.
// فأي تقرير يُضاف في الخادم تظهر حقوله هنا بلا تعديل سطر واحد.
//
// حقول الصور (الشعارات والأختام والتواقيع) تُعرض كخانات رفع: معاينة مصغّرة،
// ورفع من الجهاز، واختيار من معرض الوسائط، وإعادة للأصل، وإفراغ.
// ───────────────────────────────────────────────────────────────────────────
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

// ذاكرة مشتركة: وصف القوالب يُجلب مرة واحدة لكل جلسة.
let _catalogPromise = null
export function fetchPaperCatalog() {
  if (!_catalogPromise) {
    _catalogPromise = fetch(`${API_BASE_URL}/documents/templates`)
      .then((r) => r.json())
      .then((j) => j.data)
      .catch((e) => { _catalogPromise = null; throw e })
  }
  return _catalogPromise
}

// عرض مسار محلي كرابط كامل حتى تظهر المعاينة المصغّرة.
const thumbSrc = (v) => {
  if (!v) return ''
  if (v.startsWith('http') || v.startsWith('data:')) return v
  return `${API_BASE_URL}/public${v.startsWith('/') ? v : `/${v}`}`
}

function ImageSlot({ field, value, fallback, onChange }) {
  const inputRef = useRef(null)
  const [picking, setPicking] = useState(false)
  const [err, setErr] = useState('')
  const shown = value !== undefined && value !== null && value !== '' ? value : fallback
  const isOverridden = value !== undefined && value !== null && value !== ''
  const isCleared = value === ''

  const onFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setErr('الرجاء اختيار ملف صورة صالح'); e.target.value = ''; return }
    if (file.size > MAX_IMAGE_BYTES) { setErr('حجم الصورة يجب ألا يتجاوز 5 ميجابايت'); e.target.value = ''; return }
    const rd = new FileReader()
    rd.onloadend = () => { onChange(rd.result); setErr('') }
    rd.readAsDataURL(file)
  }

  return (
    <div style={S.slot}>
      <div style={S.slotHead}>
        <span style={S.slotLabel}>{field.labelAr}</span>
        {isOverridden && <span style={S.badge}>مخصّص</span>}
        {isCleared && <span style={{ ...S.badge, background: '#fee2e2', color: '#b91c1c' }}>مُفرَغ</span>}
      </div>

      <div style={S.slotBody}>
        <div style={S.thumb}>
          {shown
            ? <img src={thumbSrc(shown)} alt="" style={S.thumbImg} />
            : <span style={S.thumbEmpty}>لا توجد صورة</span>}
        </div>

        <div style={S.slotBtns}>
          <button type="button" style={S.btnPrimary} onClick={() => inputRef.current?.click()}>⬆️ رفع صورة</button>
          <button type="button" style={S.btnGhost} onClick={() => setPicking(true)}>🖼️ من المعرض</button>
          {fallback && (
            <button type="button" style={S.btnGhost} onClick={() => onChange(undefined)}>↩︎ الأصل</button>
          )}
          <button type="button" style={S.btnDanger} onClick={() => onChange('')}>🗑️ إفراغ</button>
        </div>
      </div>

      {err && <div style={S.err}>{err}</div>}
      <input ref={inputRef} type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />

      <MediaPicker
        isOpen={picking}
        onClose={() => setPicking(false)}
        onSelect={(media) => {
          const url = media.url?.startsWith('http') || media.url?.startsWith('data:')
            ? media.url : `${API_BASE_URL}${media.url}`
          onChange(url); setPicking(false)
        }}
      />
    </div>
  )
}

function Field({ field, value, fallback, onChange }) {
  const v = value !== undefined && value !== null ? value : (fallback ?? '')

  if (field.type === 'image') {
    return <ImageSlot field={field} value={value} fallback={fallback} onChange={onChange} />
  }

  if (field.type === 'checkbox') {
    const checked = value !== undefined ? Boolean(value) : Boolean(fallback)
    return (
      <label style={S.checkRow}>
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span>{field.labelAr}</span>
      </label>
    )
  }

  if (field.type === 'select') {
    return (
      <div style={S.field}>
        <label style={S.label}>{field.labelAr}</label>
        <select style={S.input} value={v} onChange={(e) => onChange(e.target.value)}>
          {(field.options || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    )
  }

  if (field.type === 'textarea') {
    return (
      <div style={{ ...S.field, gridColumn: '1 / -1' }}>
        <label style={S.label}>{field.labelAr}</label>
        <textarea style={{ ...S.input, minHeight: 74, resize: 'vertical' }} value={v}
          onChange={(e) => onChange(e.target.value)} placeholder={field.hint || ''} />
        {field.hint && <small style={S.hint}>{field.hint}</small>}
      </div>
    )
  }

  return (
    <div style={S.field}>
      <label style={S.label}>{field.labelAr}</label>
      <input style={S.input} type="text" value={v} onChange={(e) => onChange(e.target.value)}
        placeholder={field.hint || ''} />
    </div>
  )
}

export default function PaperFieldsEditor({ templateId, value, onChange, font, onFontChange }) {
  const [catalog, setCatalog] = useState(null)
  const [err, setErr] = useState('')
  const [open, setOpen] = useState({})

  useEffect(() => {
    fetchPaperCatalog().then(setCatalog).catch((e) => setErr(e.message))
  }, [])

  const tpl = useMemo(
    () => catalog?.templates?.find((t) => t.id === templateId) || null,
    [catalog, templateId]
  )

  // الحقول مجمَّعة حسب القسم، بترتيب أول ظهور.
  const groups = useMemo(() => {
    if (!tpl) return []
    const m = new Map()
    for (const f of tpl.fields) {
      const g = f.group || 'أخرى'
      if (!m.has(g)) m.set(g, [])
      m.get(g).push(f)
    }
    return [...m.entries()]
  }, [tpl])

  useEffect(() => {
    // القسم الأول مفتوح، والبقية مطويّة حتى لا يطول النموذج.
    if (groups.length) setOpen({ [groups[0][0]]: true })
  }, [templateId, groups.length])

  if (err) return <div style={S.err}>تعذّر تحميل حقول القالب: {err}</div>
  if (!catalog) return <div style={S.muted}>جاري تحميل حقول القالب...</div>
  if (!tpl) return null

  const td = value || {}
  const set = (key, val) => {
    const next = { ...td }
    if (val === undefined) delete next[key]
    else next[key] = val
    onChange(next)
  }
  // القيمة الافتراضية المعلنة للقالب (تظهر في المستند ما لم تُستبدل).
  const fallbackOf = (f) => (tpl.defaults?.[f.key] !== undefined ? tpl.defaults[f.key] : f.default)

  return (
    <div style={S.wrap}>
      <div style={S.headRow}>
        <div>
          <div style={S.title}>حقول «{tpl.titleAr}»</div>
          <div style={S.muted}>كل قيمة قابلة للتعديل. الحقل الفارغ لا يُطبع.</div>
        </div>
        <div style={S.field}>
          <label style={S.label}>خط المستند</label>
          <select style={S.input} value={font || tpl.defaultFont}
            onChange={(e) => onFontChange?.(e.target.value)}>
            {(catalog.fonts || []).map((f) => (
              <option key={f.id} value={f.id}>{f.label_ar}</option>
            ))}
          </select>
        </div>
      </div>

      {groups.map(([group, fields]) => {
        const imgCount = fields.filter((f) => f.type === 'image').length
        return (
          <section key={group} style={S.group}>
            <button type="button" style={S.groupHead}
              onClick={() => setOpen((o) => ({ ...o, [group]: !o[group] }))}>
              <span>{open[group] ? '▾' : '▸'} {group}</span>
              <span style={S.count}>
                {fields.length} حقل{imgCount ? ` · ${imgCount} صورة` : ''}
              </span>
            </button>
            {open[group] && (
              <div style={S.grid}>
                {fields.map((f) => (
                  <Field key={f.key} field={f} value={td[f.key]} fallback={fallbackOf(f)}
                    onChange={(v) => set(f.key, v)} />
                ))}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

const S = {
  wrap: { border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, background: '#fff', marginBottom: 18 },
  headRow: { display: 'flex', gap: 16, justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 12 },
  title: { fontWeight: 800, fontSize: '1.05rem', color: '#1e293b' },
  muted: { color: '#64748b', fontSize: '.85rem' },
  group: { border: '1px solid #e2e8f0', borderRadius: 10, marginTop: 10, overflow: 'hidden' },
  groupHead: {
    width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 12px', background: '#f8fafc', border: 0, cursor: 'pointer',
    fontFamily: 'inherit', fontWeight: 700, fontSize: '.95rem', color: '#334155',
  },
  count: { fontSize: '.78rem', color: '#94a3b8', fontWeight: 600 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 12, padding: 12 },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: { fontSize: '.83rem', fontWeight: 700, color: '#475569' },
  input: {
    padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 7,
    fontFamily: 'inherit', fontSize: '.9rem', background: '#fff', width: '100%',
  },
  hint: { color: '#94a3b8', fontSize: '.75rem' },
  checkRow: { display: 'flex', alignItems: 'center', gap: 8, fontSize: '.9rem', fontWeight: 600, color: '#334155', cursor: 'pointer' },
  slot: { gridColumn: 'span 1', border: '1px dashed #cbd5e1', borderRadius: 10, padding: 10, background: '#fbfdff' },
  slotHead: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  slotLabel: { fontSize: '.83rem', fontWeight: 700, color: '#475569' },
  badge: { fontSize: '.68rem', fontWeight: 700, background: '#e0f2fe', color: '#0369a1', borderRadius: 999, padding: '1px 7px' },
  slotBody: { display: 'flex', gap: 10, alignItems: 'flex-start' },
  thumb: {
    width: 92, height: 68, flexShrink: 0, border: '1px solid #e2e8f0', borderRadius: 8,
    background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  thumbImg: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' },
  thumbEmpty: { fontSize: '.68rem', color: '#94a3b8', textAlign: 'center', padding: 4 },
  slotBtns: { display: 'flex', flexDirection: 'column', gap: 5, flex: 1 },
  btnPrimary: { padding: '6px 8px', border: 0, borderRadius: 6, background: '#2f6db4', color: '#fff', fontFamily: 'inherit', fontSize: '.78rem', fontWeight: 700, cursor: 'pointer' },
  btnGhost: { padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: 6, background: '#fff', color: '#334155', fontFamily: 'inherit', fontSize: '.78rem', fontWeight: 700, cursor: 'pointer' },
  btnDanger: { padding: '6px 8px', border: '1px solid #fecaca', borderRadius: 6, background: '#fff', color: '#b91c1c', fontFamily: 'inherit', fontSize: '.78rem', fontWeight: 700, cursor: 'pointer' },
  err: { color: '#b91c1c', fontSize: '.82rem', marginTop: 6 },
}
