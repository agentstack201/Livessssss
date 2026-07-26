import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

const NAVY = '#0f2547'
const ORANGE = '#F5883E'

const STATUS = {
  active:    { label: 'نشط',      color: '#15803d', bg: '#dcfce7' },
  paused:    { label: 'موقوف',    color: '#92400e', bg: '#fef3c7' },
  cooldown:  { label: 'تهدئة',    color: '#b45309', bg: '#ffedd5' },
  exhausted: { label: 'مُستهلك',  color: '#9f1239', bg: '#ffe4e6' },
  invalid:   { label: 'غير صالح', color: '#b91c1c', bg: '#fee2e2' },
}

const arNum = (n) => (n == null ? '—' : Number(n).toLocaleString('en-US'))

function timeUntil(iso) {
  if (!iso) return '—'
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'الآن'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return h > 0 ? `بعد ${h}س ${m}د` : `بعد ${m}د`
}

function Bar({ percent, remaining, label }) {
  const p = percent == null ? 0 : percent
  const color = p >= 90 ? '#dc2626' : p >= 70 ? ORANGE : '#16a34a'
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b' }}>
        <span>{label}</span>
        <span>{percent == null ? 'بلا حد' : `متبقٍ ${arNum(remaining)}`}</span>
      </div>
      <div style={{ height: 6, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden', marginTop: 2 }}>
        <div style={{ width: `${p}%`, height: '100%', background: color, transition: 'width .3s' }} />
      </div>
    </div>
  )
}

function KeysManagement() {
  const navigate = useNavigate()
  const [data, setData] = useState([])
  const [totals, setTotals] = useState(null)
  const [providers, setProviders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [testResult, setTestResult] = useState({})
  const [showAdd, setShowAdd] = useState(false)
  const timer = useRef(null)

  const token = localStorage.getItem('token')
  const authHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/keys`, { headers: authHeaders })
      if (res.status === 403) { setError('هذه الصفحة للمدير فقط'); setLoading(false); return }
      const body = await res.json()
      if (res.ok && body.success) {
        setData(body.data); setTotals(body.totals); setProviders(body.providers); setError('')
      } else setError(body.message || 'تعذّر جلب المفاتيح')
    } catch {
      setError('تعذّر الاتصال بالخادم')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    load()
    timer.current = setInterval(load, 10000) // live refresh
    return () => clearInterval(timer.current)
  }, [load])

  const act = async (id, path, method = 'POST', okMsg) => {
    setBusyId(id)
    try {
      const res = await fetch(`${API_BASE_URL}/api/keys/${id}${path}`, { method, headers: authHeaders })
      const body = await res.json()
      if (path.endsWith('/test')) {
        setTestResult((prev) => ({ ...prev, [id]: { working: body.working, message: body.message } }))
      }
      await load()
    } finally { setBusyId(null) }
  }

  const patch = async (id, payload) => {
    setBusyId(id)
    try {
      await fetch(`${API_BASE_URL}/api/keys/${id}`, { method: 'PATCH', headers: authHeaders, body: JSON.stringify(payload) })
      await load()
    } finally { setBusyId(null) }
  }

  const del = async (id, label) => {
    if (!window.confirm(`حذف المفتاح "${label || id}"؟`)) return
    await act(id, '', 'DELETE')
  }

  if (error) {
    return (
      <div style={{ ...page, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#fff', padding: 30, borderRadius: 16, textAlign: 'center' }}>
          <h2 style={{ color: '#b91c1c' }}>⛔ {error}</h2>
          <button style={btn(NAVY)} onClick={() => navigate('/dashboard')}>العودة للوحة التحكم</button>
        </div>
      </div>
    )
  }

  return (
    <div style={page} dir="rtl">
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <h1 style={{ color: NAVY, margin: 0, fontSize: 24 }}>🔑 مفاتيح الذكاء الاصطناعي</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btn(ORANGE)} onClick={() => setShowAdd(true)}>➕ إضافة مفتاح</button>
            <button style={btn('#64748b')} onClick={() => navigate('/dashboard')}>لوحة التحكم</button>
          </div>
        </div>

        {totals && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, marginTop: 16 }}>
            <Stat label="إجمالي المفاتيح" value={totals.total} color={NAVY} />
            <Stat label="نشط" value={totals.active} color="#15803d" />
            <Stat label="موقوف / تهدئة" value={totals.paused + totals.cooldown} color={ORANGE} />
            <Stat label="غير صالح / مستهلك" value={totals.invalid + totals.exhausted} color="#b91c1c" />
            <Stat label="توكنات متبقية اليوم" value={arNum(totals.remainingTokensToday)} color={NAVY} />
          </div>
        )}

        {loading && !data.length && <p style={{ textAlign: 'center', color: '#64748b', marginTop: 30 }}>جارٍ التحميل…</p>}

        {!loading && !data.length && (
          <div style={{ background: '#fff', borderRadius: 16, padding: 30, marginTop: 20, textAlign: 'center' }}>
            <p style={{ color: '#64748b' }}>لا توجد مفاتيح بعد. أضِف مفتاحاً من أحد المزوّدين المجانيين:</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 12 }}>
              {providers.map((p) => (
                <a key={p.id} href={p.consoleUrl} target="_blank" rel="noreferrer" style={linkChip}>{p.label} ↗</a>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {data.map((k) => {
            const st = STATUS[k.status] || STATUS.active
            const prov = providers.find((p) => p.id === k.provider)
            const tr = testResult[k.id]
            return (
              <div key={k.id} style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <span style={{ fontWeight: 700, color: NAVY }}>{k.label || k.providerLabel}</span>
                    <span style={{ marginInlineStart: 8, color: '#64748b', fontSize: 13 }}>{k.providerLabel}</span>
                    <span style={{ marginInlineStart: 8, direction: 'ltr', display: 'inline-block', fontFamily: 'monospace', color: '#94a3b8', fontSize: 12 }}>{k.fingerprint}</span>
                  </div>
                  <span style={{ ...badge, color: st.color, background: st.bg }}>{st.label}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginTop: 10 }}>
                  <Bar label="الطلبات اليوم" percent={k.usagePercent.rpd} remaining={k.remaining.rpd} />
                  <Bar label="التوكنات اليوم" percent={k.usagePercent.tpd} remaining={k.remaining.tpd} />
                </div>

                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 10, fontSize: 12, color: '#64748b' }}>
                  <span>تصفير: {timeUntil(k.dayResetAt)}</span>
                  <span>متوسط الاستجابة: {k.avgLatencyMs ? `${k.avgLatencyMs}ms` : '—'}</span>
                  <span>الأولوية: {k.priority}</span>
                  {k.cooldownUntil && <span style={{ color: ORANGE }}>تهدئة حتى: {timeUntil(k.cooldownUntil)}</span>}
                </div>

                {k.lastError && (
                  <div style={{ marginTop: 8, fontSize: 12, color: '#b91c1c', direction: 'ltr', textAlign: 'left', background: '#fef2f2', padding: '6px 8px', borderRadius: 6 }}>{k.lastError}</div>
                )}
                {tr && (
                  <div style={{ marginTop: 8, fontSize: 13, color: tr.working ? '#15803d' : '#b91c1c' }}>
                    {tr.working ? '✅' : '❌'} {tr.message}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                  <button style={miniBtn('#0ea5e9')} disabled={busyId === k.id} onClick={() => act(k.id, '/test', 'POST')}>اختبار</button>
                  {k.status === 'paused'
                    ? <button style={miniBtn('#16a34a')} disabled={busyId === k.id} onClick={() => patch(k.id, { status: 'active' })}>تشغيل</button>
                    : <button style={miniBtn('#92400e')} disabled={busyId === k.id} onClick={() => patch(k.id, { status: 'paused' })}>إيقاف مؤقت</button>}
                  <button style={miniBtn('#64748b')} disabled={busyId === k.id} onClick={() => act(k.id, '/reset', 'POST')}>تصفير</button>
                  <button style={miniBtn('#b91c1c')} disabled={busyId === k.id} onClick={() => del(k.id, k.label)}>حذف</button>
                  {prov && <a href={prov.consoleUrl} target="_blank" rel="noreferrer" style={{ ...miniBtn(ORANGE), textDecoration: 'none', display: 'inline-block' }}>مفتاح جديد ↗</a>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {showAdd && (
        <AddKeyModal
          providers={providers}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); load() }}
          authHeaders={authHeaders}
        />
      )}
    </div>
  )
}

function AddKeyModal({ providers, onClose, onSaved, authHeaders }) {
  const [provider, setProvider] = useState('gemini')
  const [keys, setKeys] = useState(['', '', '']) // Gemini defaults to 3 slots
  const [oneKey, setOneKey] = useState('')
  const [priority, setPriority] = useState(100)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const prov = providers.find((p) => p.id === provider)
  const isGemini = provider === 'gemini'

  const submit = async () => {
    const list = isGemini ? keys.map((k) => k.trim()).filter(Boolean) : [oneKey.trim()].filter(Boolean)
    if (!list.length) { setMsg('أدخل مفتاحاً واحداً على الأقل'); return }
    setBusy(true); setMsg('')
    try {
      let added = 0
      for (let i = 0; i < list.length; i++) {
        const res = await fetch(`${API_BASE_URL}/api/keys`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            provider,
            key: list[i],
            label: isGemini ? `Gemini ${i + 1}` : prov?.label,
            models: isGemini ? ['gemini-2.5-flash'] : undefined,
            priority: Number(priority),
          }),
        })
        if (res.ok) added++
      }
      if (added) onSaved()
      else setMsg('تعذّرت إضافة المفاتيح')
    } catch {
      setMsg('تعذّر الاتصال بالخادم')
    } finally { setBusy(false) }
  }

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ ...card, maxWidth: 480, width: '100%' }} dir="rtl">
        <h2 style={{ color: NAVY, marginTop: 0 }}>إضافة مفتاح</h2>

        <label style={lbl}>المزوّد</label>
        <select style={input} value={provider} onChange={(e) => setProvider(e.target.value)}>
          {providers.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>

        {prov && (
          <a href={prov.consoleUrl} target="_blank" rel="noreferrer" style={{ ...linkChip, display: 'inline-block', margin: '8px 0' }}>
            احصل على مفتاح {prov.label} ↗
          </a>
        )}

        {isGemini ? (
          <>
            <label style={lbl}>مفاتيح Gemini (٣ حقول، موديل gemini-2.5-flash)</label>
            {keys.map((v, i) => (
              <input key={i} style={{ ...input, fontFamily: 'monospace' }} dir="ltr" placeholder={`AIzaSy… المفتاح ${i + 1}`}
                value={v} autoComplete="off" spellCheck={false}
                onChange={(e) => setKeys((p) => p.map((x, j) => (j === i ? e.target.value : x)))} />
            ))}
          </>
        ) : (
          <>
            <label style={lbl}>المفتاح</label>
            <input style={{ ...input, fontFamily: 'monospace' }} dir="ltr" placeholder="ألصق المفتاح هنا"
              value={oneKey} autoComplete="off" spellCheck={false} onChange={(e) => setOneKey(e.target.value)} />
          </>
        )}

        <label style={lbl}>الأولوية (الأعلى يُستخدم أولاً)</label>
        <input style={input} type="number" value={priority} onChange={(e) => setPriority(e.target.value)} />

        {msg && <div style={{ color: '#b91c1c', fontSize: 13, marginTop: 8 }}>{msg}</div>}

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button style={{ ...btn(ORANGE), flex: 1 }} disabled={busy} onClick={submit}>{busy ? 'جارٍ الحفظ…' : 'حفظ'}</button>
          <button style={btn('#64748b')} onClick={onClose}>إلغاء</button>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, color }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 14, textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{label}</div>
    </div>
  )
}

const page = { minHeight: '100vh', background: '#f1f5f9', padding: 16, fontFamily: "'IBM Plex Sans Arabic', 'Cairo', sans-serif", display: 'flex', flexDirection: 'column' }
const card = { background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,.08)' }
const badge = { padding: '3px 12px', borderRadius: 20, fontSize: 13, fontWeight: 700 }
const overlay = { position: 'fixed', inset: 0, background: 'rgba(15,37,71,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 9999 }
const lbl = { display: 'block', fontSize: 13, color: '#475569', margin: '10px 0 4px' }
const input = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 15, fontFamily: 'inherit', boxSizing: 'border-box' }
const linkChip = { background: '#fff7ed', color: '#c2410c', border: `1px solid ${ORANGE}`, padding: '6px 12px', borderRadius: 20, fontSize: 13, textDecoration: 'none' }
const btn = (bg) => ({ background: bg, color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 })
const miniBtn = (bg) => ({ background: bg, color: '#fff', border: 'none', padding: '7px 14px', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 })

export default KeysManagement
