import { useState, useEffect, useMemo, useRef } from 'react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

/**
 * Searchable modal picker for nationality / residency status.
 *
 * A native <select> gave no usable picker on mobile (and rendered empty when the
 * countries table had no rows), so selection happens in an explicit overlay with
 * a search box. Custom entries are stored with BOTH an Arabic and an English
 * name, because the printed report renders each language in its own column.
 */
function NationalityPicker({ value, options, onSelect, onOptionsChanged, token, error }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [newAr, setNewAr] = useState('')
  const [newEn, setNewEn] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const searchRef = useRef(null)

  useEffect(() => {
    if (open && searchRef.current) {
      // Delay so the overlay is painted before we steal focus.
      const t = setTimeout(() => searchRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [open])

  // Close on Escape.
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(o =>
      (o.country_name_ar || '').toLowerCase().includes(q) ||
      (o.country_name_en || '').toLowerCase().includes(q)
    )
  }, [options, query])

  const selectedEn = useMemo(
    () => options.find(o => o.country_name_ar === value)?.country_name_en || '',
    [options, value]
  )

  const close = () => {
    setOpen(false); setQuery(''); setAdding(false)
    setNewAr(''); setNewEn(''); setMsg('')
  }

  const pick = (opt) => { onSelect(opt.country_name_ar); close() }

  // Fill the opposite language via the backend translation endpoint.
  const translate = async () => {
    const src = newAr.trim()
      ? { text: newAr, to: 'en', set: setNewEn }
      : (newEn.trim() ? { text: newEn, to: 'ar', set: setNewAr } : null)
    if (!src) { setMsg('اكتب النص أولاً (عربي أو إنجليزي)'); return }
    setBusy(true); setMsg('')
    try {
      const res = await fetch(`${API_BASE_URL}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ text: src.text, to: src.to })
      })
      const data = await res.json()
      if (res.ok && data.success && data.data?.translation) src.set(data.data.translation)
      else setMsg(data.message || 'تعذّرت الترجمة التلقائية — اكتب النص يدوياً')
    } catch {
      setMsg('تعذّر الاتصال بالخادم — اكتب النص يدوياً')
    } finally { setBusy(false) }
  }

  const save = async () => {
    const ar = newAr.trim(), en = newEn.trim()
    if (!ar || !en) { setMsg('يرجى تعبئة العربي والإنجليزي'); return }
    setBusy(true); setMsg('')
    try {
      const res = await fetch(`${API_BASE_URL}/countries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ country_name_ar: ar, country_name_en: en })
      })
      const data = await res.json()
      const alreadyExists = res.status === 400 && (data.message || '').includes('موجود')
      if ((res.ok && (data.success || data.data)) || alreadyExists) {
        await onOptionsChanged?.()
        onSelect(ar)
        close()
      } else {
        setMsg(data.message || 'تعذّر إضافة الجنسية')
      }
    } catch {
      setMsg('تعذّر الاتصال بالخادم')
    } finally { setBusy(false) }
  }

  const S = {
    trigger: {
      width: '100%', textAlign: 'right', padding: '12px 14px', borderRadius: '10px',
      border: `1px solid ${error ? '#dc2626' : '#cbd5e1'}`, background: '#fff',
      cursor: 'pointer', fontFamily: 'inherit', fontSize: '15px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px',
    },
    overlay: {
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
    },
    sheet: {
      background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '520px',
      maxHeight: '82vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      boxShadow: '0 24px 60px rgba(0,0,0,.35)',
    },
    head: {
      padding: '14px 16px', borderBottom: '1px solid #e2e8f0',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
    },
    search: {
      width: '100%', padding: '11px 13px', borderRadius: '10px',
      border: '1px solid #cbd5e1', fontSize: '15px', fontFamily: 'inherit',
    },
    list: { overflowY: 'auto', flex: 1, padding: '6px' },
    row: (active) => ({
      width: '100%', textAlign: 'right', padding: '12px 14px', borderRadius: '10px',
      border: 'none', background: active ? '#e0f2fe' : 'transparent', cursor: 'pointer',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      gap: '10px', fontFamily: 'inherit', fontSize: '15px',
      color: active ? '#075985' : '#0f172a', fontWeight: active ? 700 : 400,
    }),
    en: { color: '#64748b', fontSize: '13px', direction: 'ltr', fontWeight: 400 },
    foot: { padding: '12px 16px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' },
    input: {
      width: '100%', padding: '11px 13px', borderRadius: '10px',
      border: '1px solid #cbd5e1', fontSize: '15px', fontFamily: 'inherit',
    },
    btn: (bg) => ({
      padding: '11px 16px', borderRadius: '10px', border: 'none', background: bg,
      color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '15px',
    }),
  }

  return (
    <>
      <button type="button" style={S.trigger} onClick={() => setOpen(true)}>
        <span>{value || 'اختر الجنسية…'}</span>
        <span style={{ color: '#94a3b8', fontSize: '13px' }}>
          {selectedEn ? <span style={S.en}>{selectedEn}</span> : null} ▾
        </span>
      </button>

      {open && (
        <div style={S.overlay} onClick={(e) => { if (e.target === e.currentTarget) close() }}>
          <div style={S.sheet} dir="rtl" role="dialog" aria-modal="true" aria-label="اختيار الجنسية">
            <div style={S.head}>
              <strong style={{ fontSize: '16px' }}>اختر الجنسية / الحالة</strong>
              <button type="button" onClick={close} aria-label="إغلاق"
                style={{ border: 'none', background: 'transparent', fontSize: '22px', cursor: 'pointer', color: '#64748b', lineHeight: 1 }}>
                ×
              </button>
            </div>

            <div style={{ padding: '12px 16px 8px' }}>
              <input
                ref={searchRef}
                style={S.search}
                placeholder="ابحث… (بالعربي أو English)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <div style={S.list}>
              {filtered.length === 0 && (
                <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
                  لا توجد نتائج لـ «{query}» — أضِفها بالأسفل ⬇️
                </div>
              )}
              {filtered.map((o) => (
                <button key={o.id} type="button" style={S.row(o.country_name_ar === value)} onClick={() => pick(o)}>
                  <span>{o.country_name_ar}</span>
                  <span style={S.en}>{o.country_name_en}</span>
                </button>
              ))}
            </div>

            <div style={S.foot}>
              {!adding ? (
                <button type="button" onClick={() => { setAdding(true); setNewAr(query.trim()); setMsg('') }}
                  style={{ ...S.btn('#0f766e'), width: '100%' }}>
                  ➕ إضافة جنسية / حالة جديدة
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input style={S.input} dir="rtl" placeholder="بالعربية (مثال: مقيم نازح)"
                    value={newAr} onChange={(e) => setNewAr(e.target.value)} />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input style={{ ...S.input, flex: 1 }} dir="ltr" placeholder="English (e.g. Displaced Resident)"
                      value={newEn} onChange={(e) => setNewEn(e.target.value)} />
                    <button type="button" onClick={translate} disabled={busy} style={S.btn('#0ea5e9')}>
                      {busy ? '…' : 'ترجمة 🔄'}
                    </button>
                  </div>
                  {msg && <span style={{ color: '#dc2626', fontSize: '13px' }}>{msg}</span>}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="button" onClick={save} disabled={busy} style={{ ...S.btn('#16a34a'), flex: 1 }}>
                      {busy ? 'جارٍ الحفظ…' : 'إضافة واختيار'}
                    </button>
                    <button type="button" onClick={() => { setAdding(false); setMsg('') }}
                      style={{ padding: '11px 16px', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                      إلغاء
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default NationalityPicker
