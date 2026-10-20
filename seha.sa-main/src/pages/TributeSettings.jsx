import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import MediaPicker from '../components/MediaPicker'
import RoyalTribute, { TributeSky } from '../components/RoyalTribute'
import {
  DEFAULT_AUDIO,
  TRIBUTE_ADMIN_URL,
  TRIBUTE_DEFAULTS,
  TRIBUTE_LIMITS,
  TRIBUTE_PUBLIC_URL,
  normalizeTribute,
  resolveMediaUrl,
} from '../config/loginTribute'
import styles from './TributeSettings.module.css'

// ───────────────────────────────────────────────────────────────────────────
// «إدارة التكريم الملكي» — لوحة صاحب المنصة لقسم التكريم في صفحة الدخول.
//
// saved: آخر ما أعاده الخادم كما هو (مع photoUrl / audioUrl).
// draft: نسخة قابلة للتعديل = المحفوظ مدموجاً فوق المحتوى الافتراضي.
// زر الإظهار/الإخفاء يحفظ فوراً «المحفوظ + القيمة الجديدة» ولا يمسّ المسودة،
// وبقية التعديلات تبقى مسودة حتى «حفظ التغييرات».
// ───────────────────────────────────────────────────────────────────────────

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

// نفس الأنواع التي يقبلها الخادم لكل نوع وسائط (SVG غير مسموح للصورة)
const PHOTO_MIMES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
const AUDIO_MIMES = [
  'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/aac',
  'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/webm',
]

const EFFECT_KEYS = Object.keys(TRIBUTE_DEFAULTS.effects)
const TEXT_MAX = TRIBUTE_LIMITS.text
const LEAVE_WARNING = 'لديك تغييرات غير محفوظة على التكريم. هل تريد المغادرة وتجاهلها؟'

// ── تحويلات الإعداد ─────────────────────────────────────────────────────────

// رابط عنصر من مكتبة الوسائط — بنفس طريقة MediaPicker
const mediaItemUrl = (url) =>
  typeof url === 'string' && (url.startsWith('http') || url.startsWith('data:'))
    ? url
    : `${API_BASE_URL}${url || ''}`

/** الرد الخام من الخادم ← مسودة كاملة قابلة للتعديل */
function toEditable(raw) {
  const n = normalizeTribute(raw)
  return structuredClone({
    enabled: n.enabled,
    badge: n.badge,
    poem: n.poem,
    hint: n.hint,
    kashkha: n.kashkha,
    meter: n.meter,
    shela: n.shela,
    effects: n.effects,
    photo: n.photo,
    audio: n.audio,
    photoUrl: n.photo.mediaId && typeof raw?.photoUrl === 'string' ? raw.photoUrl : null,
    audioUrl: n.audio.mediaId && typeof raw?.audioUrl === 'string' ? raw.audioUrl : null,
  })
}

const trimText = (v) => (typeof v === 'string' ? v.trim().slice(0, TEXT_MAX) : '')
const cleanLines = (list, max) => (Array.isArray(list) ? list.map(trimText).filter(Boolean).slice(0, max) : [])
const spotOf = (s) => ({ x: s.x, y: s.y, size: s.size })

/**
 * المسودة ← جسم طلب الحفظ (نفس شكل الإعداد المخزَّن). الأسطر الفارغة تُسقط.
 * مرجع وسائط بلا رابط صالح (حُذف الملف أو لم يعد نوعه مقبولاً) يُعامل كأنه
 * غير موجود — صفحة الدخول تعرض الأصلي في هذه الحالة أصلاً، والخادم يرفضه.
 */
function toPayload(d) {
  return {
    enabled: d.enabled,
    badge: { main: trimText(d.badge.main), sub: trimText(d.badge.sub) },
    poem: cleanLines(d.poem, TRIBUTE_LIMITS.poemLines),
    hint: trimText(d.hint),
    kashkha: trimText(d.kashkha),
    meter: {
      enabled: d.meter.enabled,
      loading: trimText(d.meter.loading),
      lines: cleanLines(d.meter.lines, TRIBUTE_LIMITS.listItems),
    },
    shela: {
      enabled: d.shela.enabled,
      lyrics: cleanLines(d.shela.lyrics, TRIBUTE_LIMITS.listItems),
    },
    effects: Object.fromEntries(EFFECT_KEYS.map(k => [k, Boolean(d.effects[k])])),
    photo: {
      mediaId: d.photo.mediaId && d.photoUrl ? d.photo.mediaId : null,
      crown: spotOf(d.photo.crown),
      glasses: spotOf(d.photo.glasses),
    },
    audio: { mediaId: d.audio.mediaId && d.audioUrl ? d.audio.mediaId : null },
  }
}

/** آخر إعداد محفوظ كما هو (بلا حقول العرض) + قيمة الإظهار الجديدة */
function savedWithEnabled(saved, enabled) {
  const { photoUrl, audioUrl, updatedAt: _updatedAt, ...stored } = saved || {}
  const config = { ...stored, enabled }
  if (stored.photo?.mediaId && !photoUrl) config.photo = { ...stored.photo, mediaId: null }
  if (stored.audio?.mediaId && !audioUrl) config.audio = { ...stored.audio, mediaId: null }
  return config
}

// ── طلبات الخادم ────────────────────────────────────────────────────────────

async function fetchTribute(signal) {
  const res = await fetch(TRIBUTE_PUBLIC_URL, { signal, cache: 'no-store' })
  const body = await res.json().catch(() => null)
  if (!res.ok || !body?.data || typeof body.data !== 'object') {
    throw new Error(body?.message || `HTTP ${res.status}`)
  }
  return body.data
}

async function putTribute(config) {
  let res
  try {
    res = await fetch(TRIBUTE_ADMIN_URL, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify(config),
    })
  } catch {
    return { ok: false, status: 0, message: 'تعذّر الاتصال بالخادم — تحقّق من الشبكة وحاول مرة أخرى' }
  }
  const body = await res.json().catch(() => null)
  if (res.ok && body?.success !== false && body?.data && typeof body.data === 'object') {
    return { ok: true, data: body.data, message: body.message }
  }
  if (res.status === 401) return { ok: false, status: 401, message: 'انتهت الجلسة — سجّل الدخول مرة أخرى' }
  if (res.status === 403) return { ok: false, status: 403, message: 'لا تملك صلاحية إدارة التكريم' }
  return { ok: false, status: res.status, message: body?.message || `تعذّر حفظ إعدادات التكريم (HTTP ${res.status})` }
}

// ── أدوات صغيرة ─────────────────────────────────────────────────────────────

const WIDE_QUERY = '(min-width: 1100px)'

function useMediaQuery(query) {
  const subscribe = useCallback((onChange) => {
    const list = window.matchMedia(query)
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }, [query])
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false)
}

const round1 = (n) => Math.round(n * 10) / 10
const clamp = (n, { min, max }) => Math.min(max, Math.max(min, n))
const formatNumber = (n) => String(round1(n))

function formatDate(iso) {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return null
  return new Date(t).toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' })
}

// ── مكوّنات المحرّر ──────────────────────────────────────────────────────────

function Card({ icon, title, description, children }) {
  const id = useId()
  return (
    <section className={styles.card} aria-labelledby={id}>
      <header className={styles.cardHeader}>
        <span className={styles.cardIcon} aria-hidden="true">{icon}</span>
        <div>
          <h2 id={id}>{title}</h2>
          {description && <p>{description}</p>}
        </div>
      </header>
      <div className={styles.cardBody}>{children}</div>
    </section>
  )
}

function Toggle({ label, description, checked, onChange, disabled = false, large = false }) {
  const id = useId()
  return (
    <div className={`${styles.toggleRow} ${large ? styles.toggleLarge : ''}`}>
      <div className={styles.toggleText}>
        <label htmlFor={id} className={styles.toggleLabel}>{label}</label>
        {description && <p id={`${id}-d`} className={styles.toggleDesc}>{description}</p>}
      </div>
      <span className={styles.switch}>
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          onChange={e => onChange(e.target.checked)}
          aria-describedby={description ? `${id}-d` : undefined}
        />
        <span className={styles.switchTrack} aria-hidden="true">
          <span className={styles.switchThumb} />
        </span>
      </span>
    </div>
  )
}

function TextField({ label, value, onChange, placeholder, help }) {
  const id = useId()
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.fieldLabel}>{label}</label>
      <input
        id={id}
        type="text"
        className={styles.input}
        value={value}
        maxLength={TEXT_MAX}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        aria-describedby={help ? `${id}-h` : undefined}
      />
      {help && <small id={`${id}-h`} className={styles.help}>{help}</small>}
    </div>
  )
}

function RangeField({ label, value, limits, onChange }) {
  const id = useId()
  return (
    <div className={styles.rangeField}>
      <div className={styles.rangeHead}>
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id} className={styles.rangeValue}>{formatNumber(value)}٪</output>
      </div>
      <input
        id={id}
        type="range"
        dir="ltr"
        className={styles.range}
        min={limits.min}
        max={limits.max}
        step="0.1"
        value={value}
        onChange={e => onChange(round1(Number(e.target.value)))}
      />
    </div>
  )
}

/** محرّر قائمة أسطر: إضافة وحذف وترتيب، مع حدّ أقصى */
function LinesEditor({ label, lines, max, onChange, placeholder, help }) {
  const id = useId()
  const listRef = useRef(null)
  const full = lines.length >= max

  const focusRow = (index) => {
    requestAnimationFrame(() => {
      const inputs = listRef.current?.querySelectorAll('input')
      if (!inputs?.length) return
      inputs[Math.max(0, Math.min(index, inputs.length - 1))]?.focus()
    })
  }

  const update = (i, value) => onChange(lines.map((line, j) => (j === i ? value : line)))
  const remove = (i) => {
    onChange(lines.filter((_, j) => j !== i))
    focusRow(i)
  }
  const move = (i, step) => {
    const j = i + step
    if (j < 0 || j >= lines.length) return
    const next = [...lines]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
    focusRow(j)
  }
  const add = () => {
    if (full) return
    onChange([...lines, ''])
    focusRow(lines.length)
  }

  return (
    <div className={styles.linesEditor} role="group" aria-labelledby={id}>
      <div className={styles.linesHead}>
        <span id={id} className={styles.fieldLabel}>{label}</span>
        <span className={`${styles.counter} ${full ? styles.counterFull : ''}`} dir="ltr" aria-live="polite">
          {lines.length} / {max}
        </span>
      </div>
      {help && <small className={styles.help}>{help}</small>}

      {lines.length === 0 ? (
        <p className={styles.linesEmpty}>لا توجد أسطر — لن يظهر هذا الجزء.</p>
      ) : (
        <ol className={styles.lines} ref={listRef}>
          {lines.map((line, i) => (
            <li key={i} className={styles.lineRow}>
              <span className={styles.lineNo} aria-hidden="true">{i + 1}</span>
              <input
                type="text"
                className={`${styles.input} ${styles.lineInput}`}
                value={line}
                maxLength={TEXT_MAX}
                placeholder={placeholder}
                aria-label={`${label} — السطر ${i + 1}`}
                onChange={e => update(i, e.target.value)}
              />
              <div className={styles.lineActions}>
                <button
                  type="button"
                  className={styles.iconBtn}
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label={`تحريك السطر ${i + 1} للأعلى`}
                  title="للأعلى"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6" /></svg>
                </button>
                <button
                  type="button"
                  className={styles.iconBtn}
                  onClick={() => move(i, 1)}
                  disabled={i === lines.length - 1}
                  aria-label={`تحريك السطر ${i + 1} للأسفل`}
                  title="للأسفل"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
                </button>
                <button
                  type="button"
                  className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                  onClick={() => remove(i)}
                  aria-label={`حذف السطر ${i + 1}`}
                  title="حذف"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <button type="button" className={styles.addLineBtn} onClick={add} disabled={full}>
        + إضافة سطر
      </button>
      {full && <small className={styles.help}>وصلت للحد الأقصى ({max} أسطر).</small>}
    </div>
  )
}

// رسم مبسّط للتاج والنظارة لمعرفة الموضع على الصورة المصغّرة
const MINI_CROWN = 'M20 124 L10 44 L36 90 L56 30 L79 80 L100 12 L121 80 L144 30 L164 90 L190 44 L180 124 Z'
const MINI_BAND = 'M14 114 Q100 132 186 114 L188 142 Q100 162 12 142 Z'

function MiniCrown() {
  return (
    <svg viewBox="0 -14 200 180" aria-hidden="true">
      <path d={MINI_CROWN} fill="#ffd84d" stroke="#6e4100" strokeWidth="6" strokeLinejoin="round" />
      <path d={MINI_BAND} fill="#f0aa16" stroke="#6e4100" strokeWidth="6" strokeLinejoin="round" />
    </svg>
  )
}

function MiniShades() {
  return (
    <svg viewBox="0 0 22 4" shapeRendering="crispEdges" aria-hidden="true">
      <path fill="#0b0b0b" d="M0 0h22v1H0z M2 1h8v2H2z M3 3h6v1H3z M10 1h2v1h-2z M12 1h8v2h-8z M13 3h6v1h-6z" />
      <path fill="#ffffff" d="M3 1h1v1H3z M4 2h1v1H4z M13 1h1v1h-1z M14 2h1v1h-1z" />
    </svg>
  )
}

/** الصورة المصغّرة: النقر أو السحب عليها يضع العنصر المختار في مكانه */
function PositionPad({ src, crown, glasses, crownOn, glassesOn, target, onPlace }) {
  const dragging = useRef(false)

  const place = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    onPlace({
      x: round1(clamp(((e.clientX - rect.left) / rect.width) * 100, TRIBUTE_LIMITS.position)),
      y: round1(clamp(((e.clientY - rect.top) / rect.height) * 100, TRIBUTE_LIMITS.position)),
    })
  }

  return (
    <div
      className={styles.pad}
      onPointerDown={e => {
        if (e.button !== 0) return
        dragging.current = true
        e.currentTarget.setPointerCapture?.(e.pointerId)
        place(e)
      }}
      onPointerMove={e => {
        if (dragging.current) place(e)
      }}
      onPointerUp={() => { dragging.current = false }}
      onPointerCancel={() => { dragging.current = false }}
    >
      <img src={src} alt="الصورة الحالية للتكريم" draggable={false} className={styles.padPhoto} />
      <span
        className={`${styles.padCrown} ${crownOn ? '' : styles.padOff} ${target === 'crown' ? styles.padActive : ''}`}
        style={{ left: `${crown.x}%`, top: `${crown.y}%`, width: `${crown.size}%` }}
        aria-hidden="true"
      >
        <MiniCrown />
      </span>
      <span
        className={`${styles.padGlasses} ${glassesOn ? '' : styles.padOff} ${target === 'glasses' ? styles.padActive : ''}`}
        style={{ left: `${glasses.x}%`, top: `${glasses.y}%`, width: `${glasses.size}%` }}
        aria-hidden="true"
      >
        <MiniShades />
      </span>
    </div>
  )
}

// ── الصفحة ─────────────────────────────────────────────────────────────────

function TributeSettings() {
  const navigate = useNavigate()
  const isWide = useMediaQuery(WIDE_QUERY)

  const [status, setStatus] = useState('loading') // loading | error | ready
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [saved, setSaved] = useState(null)
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [notice, setNotice] = useState(null) // { kind: 'error' | 'forbidden', text }
  const [picker, setPicker] = useState(null) // 'image' | 'audio' | null
  const [mediaNames, setMediaNames] = useState({})
  const [padTarget, setPadTarget] = useState('crown')
  const [previewKey, setPreviewKey] = useState(0)
  const [previewOpen, setPreviewOpen] = useState(false)
  const busy = saving || toggling

  // تحميل الإعداد الحالي (المسار العام نفسه الذي تقرؤه صفحة الدخول)
  useEffect(() => {
    const ctrl = new AbortController()
    fetchTribute(ctrl.signal)
      .then(data => {
        setSaved(data)
        setDraft(toEditable(data))
        setStatus('ready')
      })
      .catch(err => {
        if (ctrl.signal.aborted) return
        setLoadError(err?.message || 'خطأ غير معروف')
        setStatus('error')
      })
    return () => ctrl.abort()
  }, [reloadKey])

  const retryLoad = () => {
    setStatus('loading')
    setReloadKey(k => k + 1)
  }

  const savedEditable = useMemo(() => (saved ? toEditable(saved) : null), [saved])
  const dirty = useMemo(
    () => Boolean(draft && savedEditable)
      && JSON.stringify(toPayload(draft)) !== JSON.stringify(toPayload(savedEditable)),
    [draft, savedEditable]
  )
  const previewConfig = useMemo(() => (draft ? normalizeTribute(draft) : null), [draft])

  // تنبيه قبل إغلاق الصفحة أو تحديثها مع تغييرات غير محفوظة
  useEffect(() => {
    if (!dirty) return
    const warn = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const handleFailure = (result) => {
    window.showToast?.(result.message, 'error')
    if (result.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      navigate('/login', { replace: true })
      return
    }
    setNotice({ kind: result.status === 403 ? 'forbidden' : 'error', text: result.message })
  }

  // الإظهار/الإخفاء: يحفظ فوراً آخر إعداد محفوظ مع القيمة الجديدة فقط
  const handleVisibility = async (enabled) => {
    if (busy || !saved) return
    setToggling(true)
    setNotice(null)
    const result = await putTribute(savedWithEnabled(saved, enabled))
    setToggling(false)
    if (!result.ok) return handleFailure(result)
    const isOn = result.data.enabled === true
    setSaved(result.data)
    setDraft(d => (d ? { ...d, enabled: isOn } : d))
    window.showToast?.(isOn ? 'التكريم ظاهر الآن في صفحة الدخول 👑' : 'تم إخفاء التكريم من صفحة الدخول', 'success')
  }

  const handleSave = async () => {
    if (busy || !draft) return
    setSaving(true)
    setNotice(null)
    const result = await putTribute(toPayload(draft))
    setSaving(false)
    if (!result.ok) return handleFailure(result)
    setSaved(result.data)
    setDraft(toEditable(result.data))
    window.showToast?.(result.message || 'تم حفظ إعدادات التكريم', 'success')
  }

  const handleDiscard = () => {
    if (savedEditable) setDraft(structuredClone(savedEditable))
    setNotice(null)
  }

  const handleRestoreDefaults = () => {
    const ok = window.confirm(
      'سيتم استبدال النصوص والصورة والشيلة والمؤثرات ومواضع التاج والنظارة بالمحتوى الافتراضي.\n'
      + 'لن يُحفظ شيء حتى تضغط «حفظ التغييرات». هل تريد المتابعة؟'
    )
    if (!ok) return
    setDraft(d => ({ ...toEditable({}), enabled: d ? d.enabled : saved?.enabled === true }))
  }

  const handleBack = (e) => {
    if (dirty && !window.confirm(LEAVE_WARNING)) e.preventDefault()
  }

  // ── تحديث المسودة ──
  const setField = (key, value) => setDraft(d => ({ ...d, [key]: value }))
  const setGroup = (group, key, value) => setDraft(d => ({ ...d, [group]: { ...d[group], [key]: value } }))
  const setSpot = (which, patch) =>
    setDraft(d => ({ ...d, photo: { ...d.photo, [which]: { ...d.photo[which], ...patch } } }))
  const resetSpots = () =>
    setDraft(d => ({
      ...d,
      photo: { ...d.photo, crown: { ...TRIBUTE_DEFAULTS.photo.crown }, glasses: { ...TRIBUTE_DEFAULTS.photo.glasses } },
    }))

  const handlePickPhoto = (item) => {
    if (!item) return
    if (!PHOTO_MIMES.includes(item.mime_type)) {
      window.showToast?.('نوع الصورة غير مدعوم — اختر JPG أو PNG أو WebP أو GIF', 'error')
      return
    }
    setMediaNames(m => ({ ...m, [item.id]: item.original_name }))
    setDraft(d => ({ ...d, photo: { ...d.photo, mediaId: item.id }, photoUrl: mediaItemUrl(item.url) }))
  }

  const handlePickAudio = (item) => {
    if (!item) return
    if (!AUDIO_MIMES.includes(item.mime_type)) {
      window.showToast?.('نوع الملف غير مدعوم — اختر مقطعاً صوتياً (MP3 أو M4A أو AAC أو OGG أو WAV)', 'error')
      return
    }
    setMediaNames(m => ({ ...m, [item.id]: item.original_name }))
    setDraft(d => ({ ...d, audio: { mediaId: item.id }, audioUrl: mediaItemUrl(item.url) }))
  }

  const pickers = (
    <>
      <MediaPicker isOpen={picker === 'image'} onClose={() => setPicker(null)} onSelect={handlePickPhoto} accept="image" />
      <MediaPicker isOpen={picker === 'audio'} onClose={() => setPicker(null)} onSelect={handlePickAudio} accept="audio" />
    </>
  )

  const header = (
    <header className={styles.header}>
      <div className={styles.headerContent}>
        <div className={styles.headerIcon} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 10H5L3 8z" />
            <path d="M5 21h14" />
          </svg>
        </div>
        <div className={styles.headerInfo}>
          <h1>التكريم الملكي</h1>
          <p>تحكّم في قسم التكريم بصفحة الدخول: الظهور والنصوص والصورة والشيلة والمؤثرات</p>
        </div>
      </div>
      <Link to="/dashboard" className={styles.backBtn} onClick={handleBack}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        لوحة التحكم
      </Link>
    </header>
  )

  if (status !== 'ready' || !draft || !saved) {
    return (
      <div className={styles.page} dir="rtl">
        {header}
        {status === 'error' ? (
          <div className={styles.stateCard} role="alert">
            <span className={styles.stateIcon} aria-hidden="true">⚠️</span>
            <h2>تعذّر تحميل إعدادات التكريم</h2>
            <p>تأكّد من اتصالك ومن أن الخادم يعمل، ثم حاول مرة أخرى.</p>
            <code className={styles.stateDetail}>{loadError}</code>
            <button type="button" className={styles.primaryBtn} onClick={retryLoad}>إعادة المحاولة</button>
          </div>
        ) : (
          <div className={styles.stateCard} aria-busy="true">
            <span className={styles.spinner} aria-hidden="true" />
            <p>جارٍ تحميل إعدادات التكريم…</p>
          </div>
        )}
      </div>
    )
  }

  const isVisible = saved.enabled === true
  const updatedAt = formatDate(saved.updatedAt)
  const photoCustom = Boolean(draft.photo.mediaId)
  const photoMissing = photoCustom && !draft.photoUrl
  const audioCustom = Boolean(draft.audio.mediaId)
  const audioMissing = audioCustom && !draft.audioUrl
  const audioName = audioCustom
    ? mediaNames[draft.audio.mediaId] || `مقطع من مكتبة الوسائط (#${draft.audio.mediaId})`
    : 'الشيلة الأصلية'
  const photoName = photoCustom
    ? mediaNames[draft.photo.mediaId] || `صورة من مكتبة الوسائط (#${draft.photo.mediaId})`
    : 'الصورة الأصلية'
  const audioPreviewSrc = audioCustom ? resolveMediaUrl(draft.audioUrl) || DEFAULT_AUDIO : DEFAULT_AUDIO
  const showPreview = isWide || previewOpen
  const spotsAreDefault =
    JSON.stringify(spotOf(draft.photo.crown)) === JSON.stringify(TRIBUTE_DEFAULTS.photo.crown)
    && JSON.stringify(spotOf(draft.photo.glasses)) === JSON.stringify(TRIBUTE_DEFAULTS.photo.glasses)

  return (
    <div className={styles.page} dir="rtl">
      {header}

      {/* الإظهار والإخفاء — يُحفظ فوراً */}
      <section className={`${styles.visibility} ${isVisible ? styles.visibilityOn : ''}`} aria-label="ظهور التكريم">
        <Toggle
          large
          label="إظهار التكريم في صفحة الدخول"
          description="يُحفظ فوراً عند التبديل — بقية التعديلات تحتاج «حفظ التغييرات»."
          checked={isVisible}
          disabled={busy}
          onChange={handleVisibility}
        />
        <div className={styles.visibilityMeta}>
          <span className={`${styles.statusPill} ${isVisible ? styles.statusOn : styles.statusOff}`} aria-live="polite">
            <span className={styles.statusDot} aria-hidden="true" />
            {toggling ? 'جارٍ الحفظ…' : isVisible ? 'ظاهر الآن' : 'مخفي'}
          </span>
          <span className={styles.metaText}>
            {updatedAt ? `آخر حفظ: ${updatedAt}` : 'لم يُحفظ أي إعداد بعد — يُعرض المحتوى الافتراضي'}
          </span>
          <a href="/login" target="_blank" rel="noopener noreferrer" className={styles.metaLink}>
            فتح صفحة الدخول ↗
          </a>
        </div>
      </section>

      {notice && (
        <div className={`${styles.alert} ${notice.kind === 'forbidden' ? styles.alertForbidden : ''}`} role="alert">
          <span aria-hidden="true">{notice.kind === 'forbidden' ? '🔒' : '⚠️'}</span>
          <p>{notice.text}</p>
          <button type="button" className={styles.alertClose} onClick={() => setNotice(null)} aria-label="إغلاق التنبيه">✕</button>
        </div>
      )}

      <div className={`${styles.layout} ${dirty ? styles.layoutDirty : ''}`}>
        <div className={styles.editor}>
          {/* ١) الصورة والتاج */}
          <Card icon="🖼️" title="الصورة والتاج" description="الصورة داخل الإطار الذهبي، ومكان التاج ونظارة الكشخة عليها.">
            <div className={styles.photoLayout}>
              <div className={styles.padColumn}>
                <PositionPad
                  src={previewConfig.photoSrc}
                  crown={draft.photo.crown}
                  glasses={draft.photo.glasses}
                  crownOn={draft.effects.crown}
                  glassesOn={draft.effects.sunglasses}
                  target={padTarget}
                  onPlace={pos => setSpot(padTarget === 'crown' ? 'crown' : 'glasses', pos)}
                />
                <div className={styles.segmented} role="group" aria-label="العنصر الذي يُوضع بالنقر على الصورة">
                  <button type="button" aria-pressed={padTarget === 'crown'} onClick={() => setPadTarget('crown')}>👑 التاج</button>
                  <button type="button" aria-pressed={padTarget === 'glasses'} onClick={() => setPadTarget('glasses')}>🕶️ النظارة</button>
                </div>
                <small className={styles.help}>
                  انقر على الصورة أو اسحب لوضع {padTarget === 'crown' ? 'قاعدة التاج فوق الرأس' : 'النظارة على العينين'}.
                </small>
              </div>

              <div className={styles.photoControls}>
                <div className={styles.mediaRow}>
                  <div className={styles.mediaInfo}>
                    <span className={styles.mediaLabel}>الصورة الحالية</span>
                    <strong className={styles.mediaName} title={photoName}>{photoName}</strong>
                  </div>
                  <div className={styles.mediaActions}>
                    <button type="button" className={styles.secondaryBtn} onClick={() => setPicker('image')}>اختيار صورة</button>
                    <button
                      type="button"
                      className={styles.ghostBtn}
                      disabled={!photoCustom}
                      onClick={() => setDraft(d => ({ ...d, photo: { ...d.photo, mediaId: null }, photoUrl: null }))}
                    >
                      الصورة الأصلية
                    </button>
                  </div>
                </div>
                {photoMissing && (
                  <p className={styles.warn}>الصورة المختارة لم تعد متاحة، فتظهر الأصلية. اختر صورة أخرى أو احفظ لاعتماد الأصلية.</p>
                )}
                <small className={styles.help}>صورة شخصية بالطول (تقريباً 9:10) تعطي أفضل نتيجة. الأنواع: JPG, PNG, WebP, GIF.</small>

                <div className={styles.spotGroup}>
                  <Toggle
                    label="👑 التاج الذهبي"
                    description="تاج متلألئ فوق الرأس"
                    checked={draft.effects.crown}
                    onChange={v => setGroup('effects', 'crown', v)}
                  />
                  <RangeField label="الموضع الأفقي (من اليسار)" value={draft.photo.crown.x} limits={TRIBUTE_LIMITS.position} onChange={v => setSpot('crown', { x: v })} />
                  <RangeField label="الموضع الرأسي (من الأعلى)" value={draft.photo.crown.y} limits={TRIBUTE_LIMITS.position} onChange={v => setSpot('crown', { y: v })} />
                  <RangeField label="الحجم" value={draft.photo.crown.size} limits={TRIBUTE_LIMITS.size} onChange={v => setSpot('crown', { size: v })} />
                </div>

                <div className={styles.spotGroup}>
                  <Toggle
                    label="🕶️ نظارة الكشخة"
                    description="تظهر مع تقريب الصورة عند لمسها"
                    checked={draft.effects.sunglasses}
                    onChange={v => setGroup('effects', 'sunglasses', v)}
                  />
                  <RangeField label="الموضع الأفقي (من اليسار)" value={draft.photo.glasses.x} limits={TRIBUTE_LIMITS.position} onChange={v => setSpot('glasses', { x: v })} />
                  <RangeField label="الموضع الرأسي (من الأعلى)" value={draft.photo.glasses.y} limits={TRIBUTE_LIMITS.position} onChange={v => setSpot('glasses', { y: v })} />
                  <RangeField label="الحجم" value={draft.photo.glasses.size} limits={TRIBUTE_LIMITS.size} onChange={v => setSpot('glasses', { size: v })} />
                </div>

                <button type="button" className={styles.ghostBtn} onClick={resetSpots} disabled={spotsAreDefault}>
                  إعادة المواضع الأصلية
                </button>
              </div>
            </div>

            <div className={styles.fieldsGrid}>
              <TextField
                label="التلميح تحت الصورة"
                value={draft.hint}
                onChange={v => setField('hint', v)}
                placeholder={TRIBUTE_DEFAULTS.hint}
                help="اتركه فارغاً لإخفائه."
              />
              <TextField
                label="عبارة الكشخة"
                value={draft.kashkha}
                onChange={v => setField('kashkha', v)}
                placeholder={TRIBUTE_DEFAULTS.kashkha}
                help="تظهر مع النظارة عند لمس الصورة."
              />
            </div>
          </Card>

          {/* ٢) اللقب */}
          <Card icon="🏷️" title="اللقب" description="الشارة الذهبية أعلى الصورة. اترك الحقلين فارغين لإخفائها.">
            <div className={styles.fieldsGrid}>
              <TextField label="اللقب الرئيسي" value={draft.badge.main} onChange={v => setGroup('badge', 'main', v)} placeholder={TRIBUTE_DEFAULTS.badge.main} />
              <TextField label="العبارة الفرعية" value={draft.badge.sub} onChange={v => setGroup('badge', 'sub', v)} placeholder={TRIBUTE_DEFAULTS.badge.sub} />
            </div>
          </Card>

          {/* ٣) بيت الشعر */}
          <Card icon="📜" title="بيت الشعر" description="أبيات بخط ذهبي تحت الصورة. بلا أسطر يختفي هذا الجزء.">
            <LinesEditor
              label="الأبيات"
              lines={draft.poem}
              max={TRIBUTE_LIMITS.poemLines}
              onChange={v => setField('poem', v)}
              placeholder="اكتب الشطر…"
            />
          </Card>

          {/* ٤) عدّاد الهيبة */}
          <Card icon="📊" title="عدّاد الهيبة" description="شريط يمتلئ حتى ١٠٠٪ ثم تتبدّل تحته عبارات لطيفة.">
            <Toggle
              label="إظهار عدّاد الهيبة"
              checked={draft.meter.enabled}
              onChange={v => setGroup('meter', 'enabled', v)}
            />
            <TextField
              label="نص التحميل"
              value={draft.meter.loading}
              onChange={v => setGroup('meter', 'loading', v)}
              placeholder={TRIBUTE_DEFAULTS.meter.loading}
            />
            <LinesEditor
              label="العبارات المتبدّلة"
              lines={draft.meter.lines}
              max={TRIBUTE_LIMITS.listItems}
              onChange={v => setGroup('meter', 'lines', v)}
              placeholder="عبارة…"
              help="تتبدّل كل ثلاث ثوانٍ تقريباً بعد اكتمال العدّاد."
            />
          </Card>

          {/* ٥) الشيلة */}
          <Card icon="🎵" title="الشيلة" description="مقطع صوتي يبدأ بلمس الصورة أو بزر «شغّل الشيلة»، مع كلمات تظهر أثناء التشغيل.">
            <Toggle
              label="تفعيل الشيلة"
              checked={draft.shela.enabled}
              onChange={v => setGroup('shela', 'enabled', v)}
            />
            <div className={styles.mediaRow}>
              <div className={styles.mediaInfo}>
                <span className={styles.mediaLabel}>المقطع الحالي</span>
                <strong className={styles.mediaName} title={audioName}>🎧 {audioName}</strong>
              </div>
              <div className={styles.mediaActions}>
                <button type="button" className={styles.secondaryBtn} onClick={() => setPicker('audio')}>اختيار مقطع صوتي</button>
                <button
                  type="button"
                  className={styles.ghostBtn}
                  disabled={!audioCustom}
                  onClick={() => setDraft(d => ({ ...d, audio: { mediaId: null }, audioUrl: null }))}
                >
                  المقطع الأصلي
                </button>
              </div>
            </div>
            {audioMissing && (
              <p className={styles.warn}>المقطع المختار لم يعد متاحاً، فتُشغَّل الشيلة الأصلية. اختر مقطعاً آخر أو احفظ لاعتماد الأصلي.</p>
            )}
            <audio className={styles.audio} controls preload="metadata" src={audioPreviewSrc}>
              متصفحك لا يدعم تشغيل الصوت.
            </audio>
            <small className={styles.help}>الأنواع: MP3, M4A, AAC, OGG, WAV — حتى 10MB.</small>
            <LinesEditor
              label="كلمات الشيلة"
              lines={draft.shela.lyrics}
              max={TRIBUTE_LIMITS.listItems}
              onChange={v => setGroup('shela', 'lyrics', v)}
              placeholder="سطر من الكلمات…"
              help="تتوزّع الأسطر بالتساوي على طول المقطع."
            />
          </Card>

          {/* ٦) المؤثرات */}
          <Card icon="✨" title="المؤثرات" description="لمسات الاحتفال حول التكريم.">
            <Toggle
              label="⭐ النجوم الذهبية"
              description="سماء نجوم متلألئة خلف صفحة الدخول"
              checked={draft.effects.stars}
              onChange={v => setGroup('effects', 'stars', v)}
            />
            <Toggle
              label="🎊 القصاصات الذهبية"
              description="تتساقط عند فتح الصفحة وعند لمس الصورة"
              checked={draft.effects.confetti}
              onChange={v => setGroup('effects', 'confetti', v)}
            />
            <Toggle
              label="🎆 الألعاب النارية"
              description={draft.shela.enabled ? 'تنطلق أثناء تشغيل الشيلة' : 'تنطلق أثناء تشغيل الشيلة — الشيلة متوقفة حالياً'}
              checked={draft.effects.fireworks}
              onChange={v => setGroup('effects', 'fireworks', v)}
            />
            <Toggle
              label="💛 القلوب الطائرة"
              description={draft.shela.enabled ? 'قلوب وتيجان تطير من الصورة أثناء الشيلة' : 'تطير أثناء تشغيل الشيلة — الشيلة متوقفة حالياً'}
              checked={draft.effects.hearts}
              onChange={v => setGroup('effects', 'hearts', v)}
            />
          </Card>

          <section className={styles.restore} aria-label="استعادة المحتوى الافتراضي">
            <div>
              <h2>استعادة المحتوى الافتراضي</h2>
              <p>يعيد كل النصوص والصورة والشيلة والمؤثرات إلى الأصل في المسودة دون حفظ تلقائي، ولا يغيّر الإظهار.</p>
            </div>
            <button type="button" className={styles.dangerBtn} onClick={handleRestoreDefaults} disabled={busy}>
              استعادة المحتوى الافتراضي
            </button>
          </section>
        </div>

        {/* المعاينة الحيّة */}
        <aside className={styles.previewCol} aria-label="معاينة حيّة">
          <div className={styles.previewPanel}>
            <div className={styles.previewHead}>
              <div>
                <h2>معاينة حيّة</h2>
                <p>{dirty ? 'تعرض المسودة الحالية — لم تُحفظ بعد' : 'مطابقة لما هو محفوظ'}</p>
              </div>
              <div className={styles.previewActions}>
                {showPreview && (
                  <button type="button" className={styles.ghostBtn} onClick={() => setPreviewKey(k => k + 1)}>
                    ↻ إعادة تشغيل المعاينة
                  </button>
                )}
                {!isWide && (
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    aria-expanded={previewOpen}
                    aria-controls="tribute-preview"
                    onClick={() => setPreviewOpen(o => !o)}
                  >
                    {previewOpen ? 'إخفاء المعاينة' : 'إظهار المعاينة'}
                  </button>
                )}
              </div>
            </div>

            {showPreview && (
              <div id="tribute-preview" className={styles.previewBox}>
                <div className={styles.previewScroll}>
                  <div className={styles.previewStage}>
                    {draft.effects.stars && <TributeSky />}
                    <RoyalTribute key={previewKey} config={previewConfig} preview />
                    <div className={styles.previewLoginStub} aria-hidden="true">
                      <span>تسجيل الدخول</span>
                      <i />
                      <i />
                    </div>
                  </div>
                </div>
              </div>
            )}
            {!isVisible && showPreview && (
              <p className={styles.previewNote}>التكريم مخفي حالياً عن صفحة الدخول — فعّله من الأعلى ليظهر للزوار.</p>
            )}
          </div>
        </aside>
      </div>

      {dirty && (
        <div className={styles.saveBar} role="region" aria-label="حفظ التغييرات">
          <p className={styles.saveText}>
            <span className={styles.saveDot} aria-hidden="true" />
            لديك تغييرات غير محفوظة
          </p>
          <div className={styles.saveActions}>
            <button type="button" className={styles.ghostBtn} onClick={handleDiscard} disabled={busy}>تراجع</button>
            <button type="button" className={styles.primaryBtn} onClick={handleSave} disabled={busy}>
              {saving ? (
                <>
                  <span className={styles.btnSpinner} aria-hidden="true" />
                  جارٍ الحفظ…
                </>
              ) : 'حفظ التغييرات'}
            </button>
          </div>
        </div>
      )}

      {pickers}
    </div>
  )
}

export default TributeSettings
