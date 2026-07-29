import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MediaPicker from '../components/MediaPicker'
import { fetchLeavePdfBlob, sharePdfFiles } from '../utils/pdfShare'

// إنشاء عدة إجازات مرضية دفعة واحدة لنفس الزبون (أيام/فترات متفرقة):
// بيانات مشتركة مرة واحدة + طبيب/مستشفى/شعار افتراضي، مع إمكانية تخصيص كل ملف
// (طبيب ومستشفى وشعار مختلف). خطوتان: «توليد» يجهّز الملفات، ثم «مشاركة» يشاركها
// فورًا ضمن ضغطة المستخدم (يعالج خطأ user gesture في المتصفح).

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
const API_SICK_LEAVES = import.meta.env.VITE_API_SICK_LEAVES || '/sick-leaves'
const API_URL = `${API_BASE_URL}${API_SICK_LEAVES}`
const DEFAULT_FOOTER_LOGO = '/images/1.png' // الشعار الافتراضي (نفس النموذج الأول)

const NAVY = '#0f2547'
const ORANGE = '#F5883E'
const GREEN = '#16a34a'

const generateId = (type) =>
  type === 'PSL'
    ? `PSL261${Math.floor(10000000 + Math.random() * 90000000)}`
    : `GSL261${Math.floor(100000000 + Math.random() * 900000000)}`

const todayISO = () => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

let _pid = 0
// حقول الطبيب/المستشفى/الشعار لكل ملف (فارغة = استخدم المشتركة).
const newPeriod = (single = false, from = '', to = '') => ({
  id: ++_pid, single, from, to, custom: false,
  doctorName: '', doctorNameArabic: '', physicianPosition: '', physicianPositionArabic: '',
  hospitalNameEnglish: '', hospitalNameArabic: '', licenseNumber: '', footerLogo: '',
})

const CUSTOM_KEYS = [
  'doctorName', 'doctorNameArabic', 'physicianPosition', 'physicianPositionArabic',
  'hospitalNameEnglish', 'hospitalNameArabic', 'licenseNumber', 'footerLogo',
]

function BatchSickLeave() {
  const navigate = useNavigate()
  const token = localStorage.getItem('token')

  const [shared, setShared] = useState({
    nationalID: '', name: '', nameArabic: '', nationality: 'السعودية', countryId: null,
    employer: '', issueDate: todayISO(), serviceNumType: 'GSL',
    // الافتراضيات المشتركة للطبيب/المستشفى/الشعار
    doctorName: '', doctorNameArabic: '', physicianPosition: '', physicianPositionArabic: '',
    hospitalNameEnglish: 'AL NOOR SPECIALIST HOSPITAL', hospitalNameArabic: 'مستشفى النور التخصصي',
    licenseNumber: '1410845906', footerLogo: '',
  })
  const [periods, setPeriods] = useState([newPeriod(true, todayISO(), todayISO())])
  const [quickDay, setQuickDay] = useState(todayISO())
  const [busy, setBusy] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0, phase: '' })
  const [msg, setMsg] = useState(null)
  const [prefillNote, setPrefillNote] = useState('')
  const [prepared, setPrepared] = useState(null) // { files: File[], count } بعد التوليد
  const [showPicker, setShowPicker] = useState(false)
  const [pickerTarget, setPickerTarget] = useState(null) // 'shared' | periodId

  // أي تعديل يُلغي الملفات المُجهَّزة (يجب إعادة التوليد).
  const dirty = () => setPrepared(null)
  const setField = (k, v) => { setShared((p) => ({ ...p, [k]: v })); dirty() }

  const lookupClient = async (id) => {
    const nid = (id || '').trim()
    if (!/^\d{10}$/.test(nid)) return
    try {
      const res = await fetch(`${API_BASE_URL}/clients/${nid}`, { headers: { Authorization: `Bearer ${token}` } })
      const body = await res.json()
      if (!res.ok || !body.found || !body.data) { setPrefillNote(''); return }
      const d = body.data
      setShared((p) => ({
        ...p,
        name: d.name || p.name, nameArabic: d.nameArabic || p.nameArabic,
        nationality: d.nationality || p.nationality, countryId: d.countryId ?? p.countryId,
        employer: d.employer || p.employer,
        doctorName: d.doctorName || p.doctorName, doctorNameArabic: d.doctorNameArabic || p.doctorNameArabic,
        physicianPosition: d.physicianPosition || p.physicianPosition,
        physicianPositionArabic: d.physicianPositionArabic || p.physicianPositionArabic,
        hospitalNameEnglish: d.hospitalNameEnglish || p.hospitalNameEnglish,
        hospitalNameArabic: d.hospitalNameArabic || p.hospitalNameArabic,
        licenseNumber: d.licenseNumber || p.licenseNumber,
      }))
      setPrefillNote(`✓ عميل معروف — طلباته السابقة: ${d.previousRequests ?? '—'}. عُبّئت بياناته تلقائيًا.`)
      dirty()
    } catch { setPrefillNote('') }
  }

  // ── الفترات ────────────────────────────────────────────────────────────
  const addDay = () => { if (quickDay) { setPeriods((p) => [...p, newPeriod(true, quickDay, quickDay)]); dirty() } }
  const addRange = () => { setPeriods((p) => [...p, newPeriod(false, '', '')]); dirty() }
  const removePeriod = (id) => { setPeriods((p) => p.filter((x) => x.id !== id)); dirty() }
  const duplicatePeriod = (id) => {
    setPeriods((p) => {
      const src = p.find((x) => x.id === id)
      if (!src) return p
      return [...p, { ...src, id: ++_pid }]
    })
    dirty()
  }
  const updatePeriod = (id, patch) => { setPeriods((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x))); dirty() }
  const toggleCustom = (id) => {
    setPeriods((p) => p.map((x) => {
      if (x.id !== id) return x
      if (x.custom) return { ...x, custom: false } // العودة للمشتركة
      // تفعيل التخصيص: انسخ الافتراضيات المشتركة كنقطة بداية
      const seed = {}
      CUSTOM_KEYS.forEach((k) => { seed[k] = x[k] || shared[k] })
      return { ...x, custom: true, ...seed }
    }))
    dirty()
  }

  const validPeriods = periods
    .map((p) => ({ ...p, to: p.single ? p.from : p.to }))
    .filter((p) => p.from && p.to && new Date(p.from) <= new Date(p.to))

  const srcFor = (period) => (period.custom ? period : shared)

  // ── التحقق ─────────────────────────────────────────────────────────────
  const validate = () => {
    if (!/^\d{6,}$/.test(shared.nationalID.trim())) return 'أدخل رقم هوية صحيحًا'
    if (!shared.name.trim() || !shared.nameArabic.trim()) return 'اسم الزبون (عربي/إنجليزي) مطلوب'
    if (!shared.issueDate) return 'تاريخ إصدار التقرير مطلوب'
    if (!validPeriods.length) return 'أضف فترة واحدة صحيحة على الأقل'
    for (const p of validPeriods) {
      const s = srcFor(p)
      if (!s.doctorName.trim() || !s.doctorNameArabic.trim() || !s.physicianPosition.trim() || !s.physicianPositionArabic.trim())
        return 'أكمل بيانات الطبيب والمسمّى (المشتركة أو المخصّصة لكل ملف)'
    }
    return null
  }

  const buildPayload = (period) => {
    const s = srcFor(period)
    const service_num = generateId(shared.serviceNumType)
    return {
      service_num, leave_id: service_num,
      national_id: shared.nationalID.trim(),
      name_en: shared.name.trim(), name_ar: shared.nameArabic.trim(),
      admission_date_en: period.from, discharge_date_en: period.to, issue_date: shared.issueDate,
      employer_en: shared.employer, employer_ar: shared.employer,
      physician_name_en: s.doctorName.trim(), physician_name_ar: s.doctorNameArabic.trim(),
      position_en: s.physicianPosition.trim(), position_ar: s.physicianPositionArabic.trim(),
      nationality: shared.nationality || 'السعودية', countryId: shared.countryId || undefined,
      hospital_name_en: s.hospitalNameEnglish, hospital_name_ar: s.hospitalNameArabic,
      license_number: s.licenseNumber || '1410845906', show_license_number: true,
      footer_logo: s.footerLogo || null, // null = الشعار الافتراضي (صحة)
    }
  }

  // الخطوة 1: توليد كل الملفات وتجهيزها (بدون مشاركة — حتى لا تنتهي مهلة الضغطة).
  const generate = async () => {
    const err = validate()
    if (err) { setMsg({ type: 'error', text: err }); return }

    setBusy(true); setMsg(null); setPrepared(null)
    const list = validPeriods
    setProgress({ done: 0, total: list.length, phase: 'إنشاء السجلات' })
    try {
      let created = 0
      const records = await Promise.all(list.map(async (period) => {
        const payload = buildPayload(period)
        const res = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        })
        setProgress((s) => ({ ...s, done: ++created }))
        if (!res.ok) return null
        return { service_num: payload.service_num, national_id: payload.national_id }
      }))
      const ok = records.filter(Boolean)
      if (!ok.length) throw new Error('تعذّر إنشاء السجلات')

      setProgress({ done: 0, total: ok.length, phase: 'توليد الملفات' })
      let built = 0
      const files = []
      const CONCURRENCY = 3
      let idx = 0
      const worker = async () => {
        while (idx < ok.length) {
          const i = idx++
          const blob = await fetchLeavePdfBlob(ok[i])
          files[i] = new File([blob], `sickLeaves-${i + 1}.pdf`, { type: 'application/pdf' })
          setProgress((s) => ({ ...s, done: ++built }))
        }
      }
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, ok.length) }, worker))
      const readyFiles = files.filter(Boolean)

      const failed = list.length - ok.length
      setPrepared({ files: readyFiles, count: readyFiles.length })
      setMsg({ type: 'success', text: `تم تجهيز ${readyFiles.length} ملف${failed ? ` (فشل ${failed})` : ''} — اضغط «مشاركة» لإرسالها.` })
    } catch (e) {
      console.error('Batch generate error:', e)
      setMsg({ type: 'error', text: `تعذّر التوليد: ${e.message || 'خطأ غير معروف'}` })
    } finally {
      setBusy(false); setProgress((s) => ({ ...s, phase: '' }))
    }
  }

  // الخطوة 2: مشاركة الملفات المُجهَّزة — تُستدعى فورًا ضمن ضغطة المستخدم.
  const shareNow = async () => {
    if (!prepared?.files?.length || sharing) return
    setSharing(true)
    try {
      const result = await sharePdfFiles(prepared.files)
      if (result?.downloaded) setMsg({ type: 'info', text: 'المتصفح لا يدعم مشاركة عدة ملفات فتم تنزيلها كلها.' })
      else if (result?.shared) setMsg({ type: 'success', text: `تمت مشاركة ${prepared.count} ملف بنجاح.` })
    } catch (e) {
      console.error('Batch share error:', e)
      setMsg({ type: 'error', text: 'تعذّرت المشاركة، الملفات جاهزة — اضغط «مشاركة» مرة أخرى.' })
    } finally {
      setSharing(false)
    }
  }

  // ── مكتبة الشعارات ─────────────────────────────────────────────────────
  const openPicker = (target) => { setPickerTarget(target); setShowPicker(true) }
  const onPickLogo = (media) => {
    const url = media.url.startsWith('http') ? media.url : `${API_BASE_URL}${media.url}`
    if (pickerTarget === 'shared') setField('footerLogo', url)
    else if (pickerTarget != null) updatePeriod(pickerTarget, { footerLogo: url, custom: true })
    setShowPicker(false)
  }

  const validCount = validPeriods.length

  const LogoField = ({ value, onPick, onReset }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <img src={value || DEFAULT_FOOTER_LOGO} alt="logo" style={{ height: 42, border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', padding: 2 }} />
      <button type="button" style={btn(ORANGE)} onClick={onPick}>اختر من المكتبة</button>
      <button type="button" style={btn('#64748b')} onClick={onReset}>الافتراضي (صحة)</button>
    </div>
  )

  return (
    <div style={page} dir="rtl">
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <h1 style={{ color: NAVY, margin: 0, fontSize: 22 }}>🗂️ إجازات متعددة (دفعة واحدة)</h1>
          <button style={btn('#64748b')} onClick={() => navigate('/dashboard')}>لوحة التحكم</button>
        </div>
        <p style={{ color: '#64748b', marginTop: 6, fontSize: 14 }}>
          عبّئ بيانات الزبون مرة واحدة، أضِف الأيام/الفترات المتفرقة (ويمكن تخصيص طبيب/مستشفى/شعار لكل ملف)، ثم «توليد» ثم «مشاركة» الكل دفعة واحدة.
        </p>

        {/* بيانات الزبون */}
        <div style={card}>
          <h3 style={h3}>بيانات الزبون المشتركة</h3>
          <div style={grid2}>
            <Field label="رقم الهوية / الإقامة *">
              <input style={input} dir="ltr" inputMode="numeric" value={shared.nationalID}
                onChange={(e) => setField('nationalID', e.target.value)} onBlur={(e) => lookupClient(e.target.value)} placeholder="10 أرقام" />
            </Field>
            <Field label="نوع الرقم">
              <select style={input} value={shared.serviceNumType} onChange={(e) => setField('serviceNumType', e.target.value)}>
                <option value="GSL">GSL</option><option value="PSL">PSL</option>
              </select>
            </Field>
            <Field label="الاسم (بالعربية) *"><input style={input} value={shared.nameArabic} onChange={(e) => setField('nameArabic', e.target.value)} /></Field>
            <Field label="الاسم (بالإنجليزية) *"><input style={input} dir="ltr" value={shared.name} onChange={(e) => setField('name', e.target.value)} /></Field>
            <Field label="الجنسية"><input style={input} value={shared.nationality} onChange={(e) => setField('nationality', e.target.value)} /></Field>
            <Field label="جهة العمل"><input style={input} value={shared.employer} onChange={(e) => setField('employer', e.target.value)} /></Field>
            <Field label="تاريخ إصدار التقرير *"><input style={input} type="date" value={shared.issueDate} onChange={(e) => setField('issueDate', e.target.value)} /></Field>
          </div>
          {prefillNote && <div style={{ marginTop: 8, color: GREEN, fontSize: 13 }}>{prefillNote}</div>}
        </div>

        {/* الطبيب/المستشفى/الشعار الافتراضي */}
        <div style={card}>
          <h3 style={h3}>الطبيب والمستشفى والشعار (افتراضي لكل الملفات)</h3>
          <div style={grid2}>
            <Field label="اسم الطبيب (بالعربية) *"><input style={input} value={shared.doctorNameArabic} onChange={(e) => setField('doctorNameArabic', e.target.value)} /></Field>
            <Field label="اسم الطبيب (بالإنجليزية) *"><input style={input} dir="ltr" value={shared.doctorName} onChange={(e) => setField('doctorName', e.target.value)} /></Field>
            <Field label="مسمّى الطبيب (بالعربية) *"><input style={input} value={shared.physicianPositionArabic} onChange={(e) => setField('physicianPositionArabic', e.target.value)} /></Field>
            <Field label="مسمّى الطبيب (بالإنجليزية) *"><input style={input} dir="ltr" value={shared.physicianPosition} onChange={(e) => setField('physicianPosition', e.target.value)} /></Field>
            <Field label="المستشفى (بالعربية)"><input style={input} value={shared.hospitalNameArabic} onChange={(e) => setField('hospitalNameArabic', e.target.value)} /></Field>
            <Field label="المستشفى (بالإنجليزية)"><input style={input} dir="ltr" value={shared.hospitalNameEnglish} onChange={(e) => setField('hospitalNameEnglish', e.target.value)} /></Field>
            <Field label="رقم الترخيص"><input style={input} dir="ltr" value={shared.licenseNumber} onChange={(e) => setField('licenseNumber', e.target.value)} /></Field>
          </div>
          <div style={{ marginTop: 10 }}>
            <label style={{ fontSize: 12, color: '#475569', display: 'block', marginBottom: 6 }}>الشعار (افتراضي)</label>
            <LogoField value={shared.footerLogo} onPick={() => openPicker('shared')} onReset={() => setField('footerLogo', '')} />
          </div>
        </div>

        {/* الفترات */}
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <h3 style={{ ...h3, margin: 0 }}>الأيام / الفترات ({validCount})</h3>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input style={{ ...input, width: 'auto' }} type="date" value={quickDay} onChange={(e) => setQuickDay(e.target.value)} />
              <button style={btn(ORANGE)} onClick={addDay}>+ أضف يومًا</button>
              <button style={btn(NAVY)} onClick={addRange}>+ أضف فترة</button>
            </div>
          </div>

          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {periods.length === 0 && <div style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center', padding: 12 }}>لا توجد فترات — أضِف يومًا أو فترة.</div>}
            {periods.map((p, i) => (
              <div key={p.id} style={{ ...row, flexDirection: 'column', alignItems: 'stretch' }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ color: '#64748b', fontSize: 13, minWidth: 22 }}>{i + 1}.</span>
                  {p.single ? (
                    <Field label="اليوم" inline><input style={input} type="date" value={p.from} onChange={(e) => updatePeriod(p.id, { from: e.target.value, to: e.target.value })} /></Field>
                  ) : (
                    <>
                      <Field label="من" inline><input style={input} type="date" value={p.from} onChange={(e) => updatePeriod(p.id, { from: e.target.value })} /></Field>
                      <Field label="إلى" inline><input style={input} type="date" value={p.to} onChange={(e) => updatePeriod(p.id, { to: e.target.value })} /></Field>
                    </>
                  )}
                  <button style={miniBtn(p.custom ? GREEN : '#64748b')} onClick={() => toggleCustom(p.id)} title="طبيب/مستشفى/شعار خاص لهذا الملف">{p.custom ? '✓ مخصّص' : '⚙️ تخصيص'}</button>
                  <button style={miniBtn('#0ea5e9')} onClick={() => duplicatePeriod(p.id)} title="نسخ">⧉</button>
                  <button style={miniBtn('#b91c1c')} onClick={() => removePeriod(p.id)} title="حذف">✕</button>
                </div>

                {p.custom && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #cbd5e1' }}>
                    <div style={grid2}>
                      <Field label="طبيب (عربي)"><input style={input} value={p.doctorNameArabic} onChange={(e) => updatePeriod(p.id, { doctorNameArabic: e.target.value })} /></Field>
                      <Field label="طبيب (إنجليزي)"><input style={input} dir="ltr" value={p.doctorName} onChange={(e) => updatePeriod(p.id, { doctorName: e.target.value })} /></Field>
                      <Field label="مسمّى (عربي)"><input style={input} value={p.physicianPositionArabic} onChange={(e) => updatePeriod(p.id, { physicianPositionArabic: e.target.value })} /></Field>
                      <Field label="مسمّى (إنجليزي)"><input style={input} dir="ltr" value={p.physicianPosition} onChange={(e) => updatePeriod(p.id, { physicianPosition: e.target.value })} /></Field>
                      <Field label="مستشفى (عربي)"><input style={input} value={p.hospitalNameArabic} onChange={(e) => updatePeriod(p.id, { hospitalNameArabic: e.target.value })} /></Field>
                      <Field label="مستشفى (إنجليزي)"><input style={input} dir="ltr" value={p.hospitalNameEnglish} onChange={(e) => updatePeriod(p.id, { hospitalNameEnglish: e.target.value })} /></Field>
                      <Field label="رقم الترخيص"><input style={input} dir="ltr" value={p.licenseNumber} onChange={(e) => updatePeriod(p.id, { licenseNumber: e.target.value })} /></Field>
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <label style={{ fontSize: 12, color: '#475569', display: 'block', marginBottom: 6 }}>شعار هذا الملف</label>
                      <LogoField value={p.footerLogo} onPick={() => openPicker(p.id)} onReset={() => updatePeriod(p.id, { footerLogo: '' })} />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* التوليد والمشاركة */}
        <div style={{ ...card, position: 'sticky', bottom: 12 }}>
          {busy && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 13, color: NAVY, marginBottom: 4 }}>{progress.phase} — {progress.done}/{progress.total}</div>
              <div style={{ height: 8, background: '#e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`, height: '100%', background: GREEN, transition: 'width .3s' }} />
              </div>
            </div>
          )}
          {msg && (
            <div style={{ marginBottom: 10, fontSize: 14, color: msg.type === 'error' ? '#b91c1c' : msg.type === 'success' ? GREEN : '#92400e' }}>{msg.text}</div>
          )}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              style={{ ...btn(NAVY), flex: '1 1 200px', fontSize: 16, padding: '14px', opacity: busy || !validCount ? 0.6 : 1, cursor: busy || !validCount ? 'not-allowed' : 'pointer' }}
              disabled={busy || !validCount} onClick={generate}
            >
              {busy ? '⏳ جارٍ التوليد…' : `🛠️ توليد الملفات (${validCount})`}
            </button>
            <button
              style={{ ...btn(GREEN), flex: '1 1 200px', fontSize: 16, padding: '14px', opacity: !prepared?.count || sharing ? 0.5 : 1, cursor: !prepared?.count || sharing ? 'not-allowed' : 'pointer' }}
              disabled={!prepared?.count || sharing} onClick={shareNow}
            >
              {sharing ? '⏳ جارٍ المشاركة…' : `📤 مشاركة (${prepared?.count || 0})`}
            </button>
          </div>
          {prepared?.count > 0 && !busy && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>الملفات جاهزة في الذاكرة — يمكنك المشاركة الآن أو أكثر من مرة.</div>
          )}
        </div>
      </div>

      <MediaPicker isOpen={showPicker} onClose={() => setShowPicker(false)} onSelect={onPickLogo} accept="image" category="all" />
    </div>
  )
}

function Field({ label, children, inline }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: inline ? '1 1 140px' : undefined }}>
      <label style={{ fontSize: 12, color: '#475569' }}>{label}</label>
      {children}
    </div>
  )
}

const page = { minHeight: '100vh', background: '#f1f5f9', padding: 16, fontFamily: "'IBM Plex Sans Arabic','Cairo',sans-serif" }
const card = { background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,.08)', marginTop: 14 }
const h3 = { color: NAVY, marginTop: 0, marginBottom: 12, fontSize: 16 }
const grid2 = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12 }
const row = { display: 'flex', gap: 10, background: '#f8fafc', padding: 10, borderRadius: 10 }
const input = { width: '100%', padding: '9px 11px', borderRadius: 9, border: '1px solid #cbd5e1', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }
const btn = (bg) => ({ background: bg, color: '#fff', border: 'none', padding: '9px 16px', borderRadius: 9, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 })
const miniBtn = (bg) => ({ background: bg, color: '#fff', border: 'none', padding: '8px 11px', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 })

export default BatchSickLeave
