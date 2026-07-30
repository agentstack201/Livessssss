import { useState, useEffect, useMemo, useRef } from 'react'
import styles from './SmartLeaveDates.module.css'

// ─────────────────────────────────────────────────────────────
// أدوات التاريخ (محلية بدون مكتبات)
// ─────────────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, '0')
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const parseISO = (s) => {
  const [y, m, d] = String(s).split('-').map(Number)
  return new Date(y, m - 1, d)
}
const addDays = (s, n) => {
  const d = parseISO(s)
  d.setDate(d.getDate() + n)
  return fmt(d)
}
const todayStr = () => fmt(new Date())
// المدة شاملة لليومين (دخول الجمعة وخروج الأحد = 3 أيام)
const diffDays = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000) + 1

const AR_LONG = (() => {
  try {
    return new Intl.DateTimeFormat('ar', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  } catch { return null }
})()
const HIJRI = (() => {
  try {
    return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch { return null }
})()
const HIJRI_NUM = (() => {
  try {
    return new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'numeric', year: 'numeric' })
  } catch { return null }
})()
const arLong = (s) => { try { return AR_LONG ? AR_LONG.format(parseISO(s)) : s } catch { return s } }
const hijri = (s) => { try { return HIJRI ? HIJRI.format(parseISO(s)) : '' } catch { return '' } }

// تحويل ميلادي → هجري رقمي بصيغة الخادم نفسها (DD-MM-YYYY أم القرى)
export const toHijriDMY = (iso) => {
  if (!iso || !HIJRI_NUM) return ''
  try {
    const parts = HIJRI_NUM.formatToParts(parseISO(iso))
    const get = (t) => parts.find(p => p.type === t)?.value || ''
    const y = get('year').replace(/\D/g, '')
    const m = get('month')
    const d = get('day')
    if (!y || !m || !d) return ''
    return `${Number(d)}-${Number(m)}-${Number(y)}`
  } catch { return '' }
}

// ─────────────────────────────────────────────────────────────
// محلّل اللغة الطبيعية العربية
// يفهم: "اليوم" / "أمس" / "أول أمس" / "قبل ٣ أيام" / "لمدة ٣ أيام"
//        "يومين" / "أسبوع" / "25/7" / "من 25/7 إلى 27/7" / "2026-07-25"
// ─────────────────────────────────────────────────────────────
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'
const normalizeAr = (t) => String(t)
  .replace(/[٠-٩]/g, (d) => AR_DIGITS.indexOf(d))
  .replace(/[أإآ]/g, 'ا')
  .replace(/ة/g, 'ه')
  .replace(/ـ/g, '')
  .replace(/\s+/g, ' ')
  .trim()

const WORD_NUMS = {
  'واحد': 1, 'يومين': 2, 'اثنين': 2, 'ثلاثه': 3, 'ثلاث': 3, 'اربعه': 4, 'اربع': 4,
  'خمسه': 5, 'خمس': 5, 'سته': 6, 'ست': 6, 'سبعه': 7, 'سبع': 7,
  'ثمانيه': 8, 'ثماني': 8, 'ثمان': 8, 'تسعه': 9, 'تسع': 9, 'عشره': 10, 'عشر': 10
}
// الأطول أولاً حتى لا يبتلع البديل الأقصر بداية كلمة أطول (مثل ثمان قبل ثمانيه)
const WORD_NUM_ALT = 'يومين|اثنين|ثلاثه|ثلاث|اربعه|اربع|خمسه|خمس|سته|ست|سبعه|سبع|ثمانيه|ثماني|ثمان|تسعه|تسع|عشره|عشر|واحد'

// هل السلسلة تاريخ ميلادي حقيقي؟ (ترفض مثل 2026-02-31 التي "تدور" إلى مارس)
const isRealDate = (iso) => {
  const d = parseISO(iso)
  return !isNaN(d) && fmt(d) === iso
}

export function parseSmartArabic(input, today = todayStr()) {
  let rest = normalizeAr(input)
  if (!rest) return null

  const year = parseISO(today).getFullYear()
  const dates = [] // {iso, explicitYear}

  // 1) صيغة ISO الكاملة yyyy-mm-dd — مع رفض التواريخ المستحيلة
  rest = rest.replace(/(\d{4})-(\d{1,2})-(\d{1,2})/g, (_, y, m, d) => {
    const iso = `${y}-${pad(+m)}-${pad(+d)}`
    if (isRealDate(iso)) dates.push({ iso, explicitYear: true })
    return ' '
  })

  // 2) صيغة يوم/شهر (مع سنة اختيارية).
  // سنة من خانتين تُقبل فقط إن لم يلحقها فاصل/رقم — حتى لا تُبتلع الشرطة
  // الفاصلة بين تاريخين في مثل "25/7-27/7" على أنها سنة.
  rest = rest.replace(/(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](\d{4}|\d{2}(?![\/.\-\d])))?/g, (_, d, m, y) => {
    let yy = y ? +y : year
    if (yy < 100) yy += 2000
    const iso = `${yy}-${pad(+m)}-${pad(+d)}`
    if (+m >= 1 && +m <= 12 && isRealDate(iso)) dates.push({ iso, explicitYear: !!y })
    return ' '
  })

  // 3) كلمات نسبية للبداية
  // "قبل N أيام" (رقماً أو كلمة) تُزال من النص أولاً حتى لا تُفسَّر كمدة
  let startOffset = null
  const beforeNum = rest.match(/قبل (\d+) ?(?:ايام|يوم)/)
  const beforeWord = rest.match(new RegExp(`قبل (${WORD_NUM_ALT}) ?(?:ايام|يوم)?`))
  if (beforeNum) {
    startOffset = -Number(beforeNum[1])
    rest = rest.replace(beforeNum[0], ' ')
  } else if (/قبل اسبوع/.test(rest)) {
    startOffset = -7
    rest = rest.replace(/قبل اسبوع/, ' ')
  } else if (beforeWord && WORD_NUMS[beforeWord[1]]) {
    startOffset = -WORD_NUMS[beforeWord[1]]
    rest = rest.replace(beforeWord[0], ' ')
  }
  if (startOffset == null) {
    // ملاحظة: \b لا يعمل مع الحروف العربية فنستخدم حدوداً صريحة بالمسافات
    // حتى لا تتطابق "امس" داخل كلمة مثل "الخامس"
    if (/(اول امس|قبل امس)/.test(rest)) startOffset = -2
    else if (/بعد غد/.test(rest)) startOffset = 2
    else if (/(^|\s)غدا?($|\s)/.test(rest)) startOffset = 1
    else if (/(^|\s)[وبل]?(الامس|امس)($|\s)/.test(rest)) startOffset = -1
    else if (/(^|\s)اليوم($|\s)/.test(rest)) startOffset = 0
  }

  // 4) المدة — كل الأنماط مربوطة بحدود كلمات صريحة
  let duration = null
  const durNum = rest.match(/(\d+) ?(?:ايام|يوم)/)
  if (durNum) duration = Number(durNum[1])
  if (duration == null) {
    if (/اسبوعين/.test(rest)) duration = 14
    else if (/اسبوع/.test(rest)) duration = 7
    else if (/(^|\s)و?شهر($|\s)/.test(rest)) duration = 30
    else if (/(^|\s)و?يومين($|\s)/.test(rest)) duration = 2
    else {
      const wordMatch = rest.match(new RegExp(`(^|\\s)و?(${WORD_NUM_ALT}) ?(?:ايام|يوم)`))
      if (wordMatch) duration = WORD_NUMS[wordMatch[2]] || null
    }
  }

  let start = null
  let end = null
  if (dates.length >= 2) {
    let a = dates[0]
    let b = dates[1]
    // تاريخ ثانٍ أسبق من الأول بلا سنوات صريحة: إما خطأ ترتيب بسيط
    // (27/7 إلى 25/7) أو مدى يعبر رأس السنة (25/12 إلى 3/1).
    // نفاضل بالتفسير الأقصر مدةً — فهو المقصود دائماً في الإجازات
    if (!a.explicitYear && !b.explicitYear && b.iso < a.iso) {
      const d2 = parseISO(b.iso)
      d2.setFullYear(d2.getFullYear() + 1)
      const bumped = fmt(d2)
      if (diffDays(a.iso, bumped) < diffDays(b.iso, a.iso)) {
        b = { ...b, iso: bumped }
      }
    }
    start = a.iso <= b.iso ? a.iso : b.iso
    end = a.iso <= b.iso ? b.iso : a.iso
  } else if (dates.length === 1) {
    start = dates[0].iso
  } else if (startOffset != null) {
    start = addDays(today, startOffset)
  } else if (duration != null) {
    start = today
  }

  if (!start) return null
  if (!end) end = duration ? addDays(start, duration - 1) : start
  return { start, end, days: diffDays(start, end) }
}

// ─────────────────────────────────────────────────────────────
// المكوّن الرئيسي
// ─────────────────────────────────────────────────────────────
const WEEKDAYS = ['أحد', 'إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت']
const MONTH_FMT = (() => {
  try { return new Intl.DateTimeFormat('ar', { month: 'long', year: 'numeric' }) } catch { return null }
})()

function SmartLeaveDates({ admissionDate, dischargeDate, issueDate, errors = {}, onApply }) {
  const [nlText, setNlText] = useState('')
  const [calMonth, setCalMonth] = useState(() => {
    const base = admissionDate ? parseISO(admissionDate) : new Date()
    return new Date(base.getFullYear(), base.getMonth(), 1)
  })
  const [picking, setPicking] = useState(false) // هل ننتظر نقرة نهاية المدى؟
  // وضع تاريخ الإصدار: يتبع الخروج تلقائياً ما لم يغيّره المستخدم يدوياً
  const [issueMode, setIssueMode] = useState('discharge') // discharge | today | manual
  const issueModeRef = useRef(issueMode)
  issueModeRef.current = issueMode

  const today = todayStr()
  const days = admissionDate && dischargeDate ? diffDays(admissionDate, dischargeDate) : null

  const onApplyRef = useRef(onApply)
  onApplyRef.current = onApply

  // تتبع تاريخ الإصدار: نميّز مصدر التغيير عبر مقارنة القيم السابقة —
  // تعديل الإصدار نفسه = تحويل للوضع اليدوي، أما تغيّر الخروج وحده
  // (من الحقول الدقيقة) في وضع "يوم الخروج" = إعادة مزامنة الإصدار معه.
  const prevRef = useRef({ issueDate, dischargeDate })
  useEffect(() => {
    const prev = prevRef.current
    prevRef.current = { issueDate, dischargeDate }

    // تفريغ النموذج (نموذج جديد / حذف) يعيد الوضع الافتراضي
    if (!issueDate && !dischargeDate && !admissionDate) {
      setIssueMode('discharge')
      return
    }

    const mode = issueModeRef.current
    if (issueDate !== prev.issueDate) {
      const expected = mode === 'today' ? today : mode === 'discharge' ? dischargeDate : null
      if (expected != null && issueDate && issueDate !== expected) setIssueMode('manual')
    } else if (
      mode === 'discharge' && dischargeDate && dischargeDate !== prev.dischargeDate &&
      issueDate && issueDate !== dischargeDate
    ) {
      onApplyRef.current({ issueDate: dischargeDate })
    }
  }, [issueDate, dischargeDate, admissionDate, today])

  // مزامنة الشهر المعروض مع تاريخ الدخول أياً كان مصدره
  // (تحميل سجل للتعديل، البحث، الاستخراج الذكي، الحقول الدقيقة)
  useEffect(() => {
    if (!admissionDate) return
    const d = parseISO(admissionDate)
    if (isNaN(d)) return
    setCalMonth(new Date(d.getFullYear(), d.getMonth(), 1))
  }, [admissionDate])

  const nlPreview = useMemo(() => (nlText.trim() ? parseSmartArabic(nlText, today) : null), [nlText, today])

  // تطبيق مدى كامل: يملأ الدخول/الخروج/البداية/النهاية/المدة والإصدار حسب الوضع
  const applyRange = (start, end) => {
    const patch = {
      admissionDate: start,
      dischargeDate: end,
      startDate: start,
      endDate: end,
      duration: String(diffDays(start, end)),
    }
    const mode = issueModeRef.current
    if (mode === 'discharge') patch.issueDate = end
    else if (mode === 'today') patch.issueDate = today
    else if (!issueDate) patch.issueDate = end
    onApply(patch)
  }

  const applyNl = () => {
    if (nlPreview) {
      applyRange(nlPreview.start, nlPreview.end)
      setNlText('')
      setPicking(false)
    }
  }

  const setStart = (offset) => {
    const start = addDays(today, offset)
    const d = days && days > 0 ? days : 1
    applyRange(start, addDays(start, d - 1))
    setPicking(false)
  }

  const setDuration = (d) => {
    const start = admissionDate || today
    applyRange(start, addDays(start, d - 1))
    setPicking(false)
  }

  const stepDuration = (delta) => {
    const d = Math.max(1, (days || 1) + delta)
    setDuration(d)
  }

  const onDayClick = (dateStr) => {
    if (picking && admissionDate && dateStr >= admissionDate) {
      applyRange(admissionDate, dateStr)
      setPicking(false)
    } else {
      applyRange(dateStr, dateStr)
      setPicking(true)
    }
  }

  const setIssue = (mode) => {
    setIssueMode(mode)
    if (mode === 'discharge' && dischargeDate) onApply({ issueDate: dischargeDate })
    else if (mode === 'today') onApply({ issueDate: today })
  }

  // شبكة التقويم للشهر المعروض
  const grid = useMemo(() => {
    const y = calMonth.getFullYear()
    const m = calMonth.getMonth()
    const first = new Date(y, m, 1)
    const cells = []
    for (let i = 0; i < first.getDay(); i++) cells.push(null)
    const last = new Date(y, m + 1, 0).getDate()
    for (let d = 1; d <= last; d++) cells.push(fmt(new Date(y, m, d)))
    return cells
  }, [calMonth])

  const dateErrors = ['admissionDate', 'dischargeDate', 'issueDate', 'startDate', 'endDate', 'duration']
    .map(k => errors[k]).filter(Boolean)

  const startOffsetActive = (offset) => admissionDate === addDays(today, offset)

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <span className={styles.headIcon}>🗓️</span>
        <div>
          <h3 className={styles.headTitle}>فترة الإجازة</h3>
          <p className={styles.headSub}>نقرتان تكفيان — أو اكتبها بأي صيغة</p>
        </div>
      </div>

      {/* الإدخال الذكي بلغة طبيعية */}
      <div className={styles.nlRow}>
        <input
          className={styles.nlInput}
          type="text"
          value={nlText}
          onChange={(e) => setNlText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyNl() } }}
          placeholder='اكتب مثل: "أمس لمدة ٣ أيام" أو "من 25/7 إلى 27/7" ثم Enter'
          aria-label="اكتب فترة الإجازة بأي صيغة"
        />
        {nlPreview && (
          <button type="button" className={styles.nlApply} onClick={applyNl}>
            ✓ {nlPreview.days} {nlPreview.days === 1 ? 'يوم' : 'أيام'} — تطبيق
          </button>
        )}
      </div>
      <span aria-live="polite" role="status">
        {nlText.trim() && !nlPreview && (
          <p className={styles.nlMiss}>لم أفهم الصيغة بعد — جرّب "٣ أيام من أمس" أو "25/7 إلى 27/7"</p>
        )}
        {nlPreview && (
          <p className={styles.nlHit}>
            {arLong(nlPreview.start)} ← {arLong(nlPreview.end)}
          </p>
        )}
      </span>

      {/* شرائح البداية والمدة */}
      <div className={styles.chipsGrid}>
        <div className={styles.chipGroup}>
          <span className={styles.chipLabel}>البداية</span>
          <div className={styles.chips}>
            <button type="button" className={`${styles.chip} ${startOffsetActive(0) ? styles.chipOn : ''}`} onClick={() => setStart(0)}>اليوم</button>
            <button type="button" className={`${styles.chip} ${startOffsetActive(-1) ? styles.chipOn : ''}`} onClick={() => setStart(-1)}>أمس</button>
            <button type="button" className={`${styles.chip} ${startOffsetActive(-2) ? styles.chipOn : ''}`} onClick={() => setStart(-2)}>أول أمس</button>
          </div>
        </div>
        <div className={styles.chipGroup}>
          <span className={styles.chipLabel}>المدة</span>
          <div className={styles.chips}>
            {[1, 2, 3, 5, 7, 14].map(d => (
              <button
                key={d}
                type="button"
                className={`${styles.chip} ${days === d ? styles.chipOn : ''}`}
                onClick={() => setDuration(d)}
              >
                {d === 7 ? 'أسبوع' : d === 14 ? 'أسبوعان' : d === 1 ? 'يوم' : d === 2 ? 'يومان' : `${d} أيام`}
              </button>
            ))}
            <span className={styles.stepper}>
              <button type="button" onClick={() => stepDuration(-1)} aria-label="نقص يوماً">−</button>
              <b>{days || '—'}</b>
              <button type="button" onClick={() => stepDuration(1)} aria-label="زد يوماً">+</button>
            </span>
          </div>
        </div>
      </div>

      {/* التقويم المرئي */}
      <div className={styles.calendar}>
        <div className={styles.calHead}>
          <button type="button" className={styles.calNav} aria-label="الشهر السابق" onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))}>‹</button>
          <span className={styles.calTitle}>{MONTH_FMT ? MONTH_FMT.format(calMonth) : ''}</span>
          <button type="button" className={styles.calNav} aria-label="الشهر التالي" onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))}>›</button>
        </div>
        <div className={styles.calGrid}>
          {WEEKDAYS.map(w => <span key={w} className={styles.calWd}>{w}</span>)}
          {grid.map((d, i) => {
            if (!d) return <span key={`e${i}`} />
            const inRange = admissionDate && dischargeDate && d >= admissionDate && d <= dischargeDate
            const isEdge = d === admissionDate || d === dischargeDate
            return (
              <button
                key={d}
                type="button"
                className={[
                  styles.calDay,
                  d === today ? styles.calToday : '',
                  inRange ? styles.calRange : '',
                  isEdge ? styles.calEdge : ''
                ].join(' ')}
                onClick={() => onDayClick(d)}
                aria-label={arLong(d)}
                aria-pressed={isEdge || undefined}
              >
                {parseISO(d).getDate()}
              </button>
            )
          })}
        </div>
        <span aria-live="polite" role="status">
          {picking && <p className={styles.calHint}>الآن انقر يوم <b>الخروج</b> لإكمال المدى</p>}
        </span>
      </div>

      {/* الملخص الحي */}
      {admissionDate && dischargeDate ? (
        <div className={styles.summary}>
          <div className={styles.summaryDays}>{days}</div>
          <div className={styles.summaryText}>
            <p className={styles.summaryMain}>
              من <b>{arLong(admissionDate)}</b> إلى <b>{arLong(dischargeDate)}</b>
            </p>
            {hijri(admissionDate) && (
              <p className={styles.summaryHijri}>
                🌙 {hijri(admissionDate)} — {hijri(dischargeDate)}
              </p>
            )}
          </div>
        </div>
      ) : (
        <p className={styles.summaryEmpty}>لم تُحدَّد الفترة بعد — انقر شريحة أو يوماً في التقويم</p>
      )}

      {/* تاريخ الإصدار */}
      <div className={styles.issueRow}>
        <span className={styles.chipLabel}>تاريخ إصدار التقرير</span>
        <div className={styles.chips}>
          <button
            type="button"
            className={`${styles.chip} ${issueMode === 'discharge' ? styles.chipOn : ''}`}
            onClick={() => setIssue('discharge')}
          >
            يوم الخروج
          </button>
          <button
            type="button"
            className={`${styles.chip} ${issueMode === 'today' ? styles.chipOn : ''}`}
            onClick={() => setIssue('today')}
          >
            اليوم
          </button>
          {issueDate && <span className={styles.issueValue}>{arLong(issueDate)}</span>}
        </div>
      </div>

      {dateErrors.length > 0 && (
        <div className={styles.errBox} role="alert">
          {dateErrors.map((e, i) => <span key={i}>⚠️ {e}</span>)}
        </div>
      )}
    </div>
  )
}

export default SmartLeaveDates
