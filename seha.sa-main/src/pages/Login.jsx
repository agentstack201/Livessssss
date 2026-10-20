import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './Login.module.css'

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
const API_LOGIN = import.meta.env.VITE_API_LOGIN || '/login'
const LOGIN_URL = `${API_BASE_URL}${API_LOGIN}`

/* ===================== التكريم الملكي ===================== */

// مولّد عشوائي ثابت البذرة: النجوم والقصاصات تُحسب مرة واحدة عند التحميل
// فتبقى أماكنها ثابتة بين إعادات الرسم.
function seededRandom(seed) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

const rand = seededRandom(1447)

const BG_STARS = Array.from({ length: 42 }, () => ({
  left: rand() * 100,
  top: rand() * 100,
  size: 2 + rand() * 3.5,
  delay: rand() * 4,
  dur: 2.2 + rand() * 2.8,
}))

const BG_SPARKS = Array.from({ length: 10 }, (_, i) => ({
  left: i % 2 === 0 ? 3 + rand() * 20 : 77 + rand() * 20,
  top: 4 + rand() * 88,
  size: 12 + rand() * 14,
  delay: rand() * 3,
}))

const GOLD_SHADES = ['#ffd84d', '#fff3b0', '#f0aa16', '#ffe27a', '#d4940e', '#ffffff']
const CONFETTI_EMOJIS = ['👑', '✨', '⭐', '💛']

const CONFETTI = Array.from({ length: 48 }, (_, i) => ({
  left: rand() * 100,
  delay: rand() * 1.6,
  dur: 3.4 + rand() * 2.6,
  drift: (rand() - 0.5) * 180,
  spin: 360 + rand() * 720,
  w: 6 + rand() * 6,
  h: 10 + rand() * 9,
  color: GOLD_SHADES[i % GOLD_SHADES.length],
  emoji: i % 6 === 0 ? CONFETTI_EMOJIS[(i / 6) % CONFETTI_EMOJIS.length] : null,
}))

// مواقع الشرارات حول التاج (نسبة من صندوق التاج)
const CROWN_SPARKLES = [
  { left: -24, top: 10, size: 22, delay: 0, rise: false },
  { left: 100, top: 0, size: 26, delay: 0.7, rise: false },
  { left: 40, top: -34, size: 20, delay: 1.3, rise: true },
  { left: 6, top: -20, size: 16, delay: 0.4, rise: true },
  { left: 80, top: -26, size: 18, delay: 1.8, rise: true },
  { left: -16, top: 64, size: 15, delay: 1.0, rise: false },
  { left: 104, top: 60, size: 17, delay: 2.1, rise: false },
]

const HAYBA_LINES = [
  '😂 العدّاد خرب… ما تحمّل كل هالزين',
  '😎 مستوى الكشخة: فوق المقاييس',
  '🤍 الوفاء: ما له حدود',
  '🌹 حيّاك الله يا ذخرنا',
]

// كلمات الشيلة — تظهر سطراً سطراً أثناء التشغيل
const SHELA_LINES = [
  'ارحب يالذيب اللي فزعته تشفي الغليل..',
  'صقر المداين والفعل يسبق حكيه!',
  'يا مرحبا بلي ملا الطيب والمواقف طويل..',
  'منصة «صحتي» تنادي باسمه وتفتخر فيه!',
]

// ألعاب نارية خفيفة: مواقع الانفجارات على الشاشة (٪) وتأخيرها
const FIREWORKS = [
  { x: 16, y: 22, delay: 0 },
  { x: 82, y: 18, delay: 0.45 },
  { x: 50, y: 10, delay: 0.9 },
  { x: 24, y: 56, delay: 1.35 },
  { x: 78, y: 50, delay: 1.8 },
]
const FIREWORK_ANGLES = Array.from({ length: 14 }, (_, i) => (360 / 14) * i)

// قلوب وتيجان تطير من الصورة أثناء الشيلة
const HEARTS = Array.from({ length: 12 }, (_, i) => ({
  emoji: ['💛', '❤️', '👑', '🤍', '✨', '💛'][i % 6],
  left: i % 3 === 1 ? 30 + rand() * 40 : i % 3 === 0 ? rand() * 22 : 78 + rand() * 22,
  delay: rand() * 3.2,
  dur: 2.6 + rand() * 1.6,
  sway: (rand() - 0.5) * 70,
  size: 18 + rand() * 12,
}))

const CROWN_POINTS = 'M20 124 L10 44 L36 90 L56 30 L79 80 L100 12 L121 80 L144 30 L164 90 L190 44 L180 124 Z'
const CROWN_BAND = 'M14 114 Q100 132 186 114 L188 142 Q100 162 12 142 Z'

// أوجه الرؤوس الخمسة: [قمة، يسار، منتصف، يمين] — الوجه الأيسر مضاء والأيمن مظلل
const CROWN_FACETS = [
  [[10, 44], [20, 124], [27, 116], [36, 90]],
  [[56, 30], [36, 90], [57, 104], [79, 80]],
  [[100, 12], [79, 80], [100, 100], [121, 80]],
  [[144, 30], [121, 80], [143, 104], [164, 90]],
  [[190, 44], [164, 90], [173, 116], [180, 124]],
]

const CROWN_TIP_PEARLS = [
  [10, 42, 6], [56, 27, 6.5], [100, 10, 8.5], [144, 27, 6.5], [190, 42, 6],
]

const pts = (list) => list.map(([x, y]) => `${x},${y}`).join(' ')

// نجمة رباعية الأطراف لوميض الجواهر
const glintPath = (cx, cy, s) =>
  `M${cx} ${cy - s} Q${cx} ${cy} ${cx + s} ${cy} Q${cx} ${cy} ${cx} ${cy + s} Q${cx} ${cy} ${cx - s} ${cy} Q${cx} ${cy} ${cx} ${cy - s}Z`

const rhombus = (cx, cy, rx, ry) =>
  pts([[cx, cy - ry], [cx + rx, cy], [cx, cy + ry], [cx - rx, cy]])

function RoyalCrown() {
  return (
    <svg className={styles.crownSvg} viewBox="0 -14 200 180" aria-hidden="true">
      <defs>
        <linearGradient id="vipGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff8cc" />
          <stop offset=".3" stopColor="#ffd84d" />
          <stop offset=".62" stopColor="#f0a514" />
          <stop offset="1" stopColor="#8a5200" />
        </linearGradient>
        <linearGradient id="vipBand" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7a4800" />
          <stop offset=".12" stopColor="#d9960f" />
          <stop offset=".32" stopColor="#ffe680" />
          <stop offset=".45" stopColor="#fff8d0" />
          <stop offset=".58" stopColor="#ffd23f" />
          <stop offset=".8" stopColor="#c98410" />
          <stop offset="1" stopColor="#6e4100" />
        </linearGradient>
        <linearGradient id="vipBandShade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity=".35" />
          <stop offset=".45" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="1" stopColor="#3c1e00" stopOpacity=".45" />
        </linearGradient>
        <radialGradient id="vipVelvet" cx=".45" cy=".35" r=".75">
          <stop offset="0" stopColor="#e8394f" />
          <stop offset=".55" stopColor="#a1132b" />
          <stop offset="1" stopColor="#4d0012" />
        </radialGradient>
        <radialGradient id="vipRuby" cx=".35" cy=".3" r=".8">
          <stop offset="0" stopColor="#ffe0e5" />
          <stop offset=".2" stopColor="#ff4d6a" />
          <stop offset=".6" stopColor="#c4002a" />
          <stop offset="1" stopColor="#5c0012" />
        </radialGradient>
        <radialGradient id="vipEmerald" cx=".35" cy=".3" r=".8">
          <stop offset="0" stopColor="#e0fff0" />
          <stop offset=".2" stopColor="#3ee89a" />
          <stop offset=".6" stopColor="#079150" />
          <stop offset="1" stopColor="#023d22" />
        </radialGradient>
        <radialGradient id="vipSapphire" cx=".35" cy=".3" r=".8">
          <stop offset="0" stopColor="#e6efff" />
          <stop offset=".2" stopColor="#5b95ff" />
          <stop offset=".6" stopColor="#1a3fc0" />
          <stop offset="1" stopColor="#08184f" />
        </radialGradient>
        <radialGradient id="vipPearl" cx=".35" cy=".3" r=".75">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".45" stopColor="#f6eedb" />
          <stop offset="1" stopColor="#b9a072" />
        </radialGradient>
        <linearGradient id="vipDiamond" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".5" stopColor="#cfe6ff" />
          <stop offset="1" stopColor="#8fb4e8" />
        </linearGradient>
        <linearGradient id="vipShine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset=".5" stopColor="#ffffff" stopOpacity=".9" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <clipPath id="vipCrownClip">
          <path d={CROWN_POINTS} />
          <path d={CROWN_BAND} />
        </clipPath>
      </defs>

      {/* المخمل الأحمر داخل التاج */}
      <path d="M32 120 C32 34 168 34 168 120 Z" fill="url(#vipVelvet)" />
      <ellipse cx="80" cy="72" rx="16" ry="8" fill="#ff9aa8" opacity=".25" />

      {/* الرؤوس الخمسة */}
      <path d={CROWN_POINTS} fill="url(#vipGold)" stroke="#6e4100" strokeWidth="1.6" strokeLinejoin="round" />
      {CROWN_FACETS.map(([t, l, m, r]) => (
        <g key={`${t[0]}`}>
          <polygon points={pts([t, l, m])} fill="#fff3b8" opacity=".42" />
          <polygon points={pts([t, m, r])} fill="#5a3500" opacity=".26" />
        </g>
      ))}

      {/* جواهر الرؤوس */}
      <polygon points={rhombus(56, 64, 6.5, 10)} fill="url(#vipSapphire)" stroke="#6e4100" strokeWidth=".8" />
      <polygon points={rhombus(144, 64, 6.5, 10)} fill="url(#vipEmerald)" stroke="#6e4100" strokeWidth=".8" />
      <ellipse cx="100" cy="54" rx="9.5" ry="12.5" fill="#ffe27a" stroke="#6e4100" strokeWidth=".8" />
      <ellipse cx="100" cy="54" rx="7" ry="10" fill="url(#vipRuby)" />
      <circle cx="22" cy="86" r="3.6" fill="url(#vipPearl)" />
      <circle cx="178" cy="86" r="3.6" fill="url(#vipPearl)" />

      {/* لآلئ القمم والماسة العليا */}
      {CROWN_TIP_PEARLS.map(([cx, cy, r]) => (
        <circle key={cx} cx={cx} cy={cy} r={r} fill="url(#vipPearl)" stroke="#b08d4a" strokeWidth=".8" />
      ))}
      <polygon points={rhombus(100, -4, 6, 9)} fill="url(#vipDiamond)" stroke="#8fb4e8" strokeWidth=".6" />

      {/* الحزام الأمامي */}
      <path d={CROWN_BAND} fill="url(#vipBand)" stroke="#5a3500" strokeWidth="1.6" strokeLinejoin="round" />
      <path d={CROWN_BAND} fill="url(#vipBandShade)" />
      <path d="M14 114 Q100 132 186 114" fill="none" stroke="#fff6c8" strokeWidth="2.2" strokeLinecap="round" opacity=".9" />
      <path d="M12 142 Q100 162 188 142" fill="none" stroke="#4a2a00" strokeWidth="2.4" strokeLinecap="round" />

      {/* جواهر الحزام */}
      <ellipse cx="100" cy="137" rx="12.5" ry="10" fill="#ffe27a" stroke="#6e4100" strokeWidth=".8" />
      <ellipse cx="100" cy="137" rx="10" ry="7.8" fill="url(#vipRuby)" />
      <circle cx="57" cy="135" r="8.5" fill="#ffe27a" stroke="#6e4100" strokeWidth=".8" />
      <circle cx="57" cy="135" r="6.3" fill="url(#vipEmerald)" />
      <circle cx="143" cy="135" r="8.5" fill="#ffe27a" stroke="#6e4100" strokeWidth=".8" />
      <circle cx="143" cy="135" r="6.3" fill="url(#vipSapphire)" />
      <polygon points={rhombus(78.5, 137, 4.5, 6)} fill="url(#vipDiamond)" />
      <polygon points={rhombus(121.5, 137, 4.5, 6)} fill="url(#vipDiamond)" />
      <circle cx="31" cy="131" r="4" fill="url(#vipPearl)" />
      <circle cx="169" cy="131" r="4" fill="url(#vipPearl)" />

      {/* وميض يمسح التاج */}
      <g clipPath="url(#vipCrownClip)">
        <rect className={styles.crownShine} x="-70" y="-14" width="46" height="180" fill="url(#vipShine)" />
      </g>

      {/* بريق الجواهر */}
      <path className={styles.glint} d={glintPath(95, 132, 6)} fill="#ffffff" />
      <path className={styles.glint} style={{ animationDelay: '.9s' }} d={glintPath(97, 6, 7)} fill="#ffffff" />
      <path className={styles.glint} style={{ animationDelay: '1.6s' }} d={glintPath(53, 60, 5)} fill="#ffffff" />
      <path className={styles.glint} style={{ animationDelay: '2.2s' }} d={glintPath(140, 131, 5)} fill="#ffffff" />
    </svg>
  )
}

const SPARKLE_PATH = 'M12 0C13 8 16 11 24 12C16 13 13 16 12 24C11 16 8 13 0 12C8 11 11 8 12 0Z'

// نظارة «الكشخة» البكسلية
function PixelShades() {
  return (
    <svg className={styles.shadesSvg} viewBox="0 0 22 4" shapeRendering="crispEdges" aria-hidden="true">
      <path fill="#0b0b0b" d="M0 0h22v1H0z M2 1h8v2H2z M3 3h6v1H3z M10 1h2v1h-2z M12 1h8v2h-8z M13 3h6v1h-6z" />
      <path fill="#ffffff" d="M3 1h1v1H3z M4 2h1v1H4z M13 1h1v1h-1z M14 2h1v1h-1z" />
    </svg>
  )
}

function GoldConfetti() {
  return (
    <div className={styles.confetti} aria-hidden="true">
      {CONFETTI.map((c, i) => (
        <span
          key={i}
          className={c.emoji ? styles.confettiEmoji : styles.confettiPaper}
          style={{
            left: `${c.left}%`,
            width: c.emoji ? undefined : c.w,
            height: c.emoji ? undefined : c.h,
            background: c.emoji ? undefined : c.color,
            '--dur': `${c.dur}s`,
            '--delay': `${c.delay}s`,
            '--drift': `${c.drift}px`,
            '--spin': `${c.spin}deg`,
          }}
        >
          {c.emoji}
        </span>
      ))}
    </div>
  )
}

// «جاري تحميل الهيبة…» ثم عبارات لطيفة تتبدّل
function HaybaMeter() {
  const [line, setLine] = useState(-1)

  useEffect(() => {
    let cycle
    const loaded = setTimeout(() => {
      setLine(0)
      cycle = setInterval(() => setLine(n => (n + 1) % HAYBA_LINES.length), 2800)
    }, 2700)
    return () => {
      clearTimeout(loaded)
      clearInterval(cycle)
    }
  }, [])

  return (
    <div className={styles.meter} aria-hidden="true">
      <div className={styles.meterHead}>
        <span key={line} className={styles.meterLabel}>
          {line < 0 ? '⏳ جاري تحميل الهيبة…' : HAYBA_LINES[line]}
        </span>
        <span className={styles.meterPct} />
      </div>
      <div className={styles.meterTrack}>
        <span className={styles.meterFill} />
      </div>
    </div>
  )
}

function Fireworks() {
  return (
    <div className={styles.fireworks} aria-hidden="true">
      {FIREWORKS.map(b => (
        <span
          key={`${b.x}-${b.y}`}
          className={styles.burst}
          style={{ left: `${b.x}%`, top: `${b.y}%`, '--d': `${b.delay}s` }}
        >
          <span className={styles.burstFlash} />
          {FIREWORK_ANGLES.map(a => (
            <span key={a} className={styles.burstSpark} style={{ '--a': `${a}deg` }} />
          ))}
        </span>
      ))}
    </div>
  )
}

function RisingHearts() {
  return (
    <div className={styles.hearts} aria-hidden="true">
      {HEARTS.map((h, i) => (
        <span
          key={i}
          className={styles.heart}
          style={{
            left: `${h.left}%`,
            fontSize: h.size,
            '--dur': `${h.dur}s`,
            '--delay': `${h.delay}s`,
            '--sway': `${h.sway}px`,
          }}
        >
          {h.emoji}
        </span>
      ))}
    </div>
  )
}

function RoyalTribute() {
  const [zoomed, setZoomed] = useState(false)
  const [confettiOn, setConfettiOn] = useState(true)
  const [burst, setBurst] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [lyric, setLyric] = useState(0)
  const audioRef = useRef(null)

  const playShela = (fromStart) => {
    const audio = audioRef.current
    if (!audio) return
    if (fromStart || audio.ended) audio.currentTime = 0
    audio.play().catch(() => {})
  }

  const toggleShela = () => {
    if (playing) audioRef.current?.pause()
    else playShela(false)
  }

  const handleTimeUpdate = (e) => {
    const { currentTime, duration } = e.currentTarget
    const part = currentTime / (duration || 15)
    setLyric(Math.min(SHELA_LINES.length - 1, Math.floor(part * SHELA_LINES.length)))
  }

  // اللقطة المقرّبة مع النظارة ترجع لوحدها بعد لحظات
  useEffect(() => {
    if (!zoomed) return
    const t = setTimeout(() => setZoomed(false), 4800)
    return () => clearTimeout(t)
  }, [zoomed])

  useEffect(() => {
    if (!confettiOn) return
    const t = setTimeout(() => setConfettiOn(false), 7500)
    return () => clearTimeout(t)
  }, [confettiOn, burst])

  const handlePhotoTap = () => {
    // الشيلة تبدأ مع أول لمسة، ولا تُعاد من أولها إذا كانت شغّالة
    if (!playing) playShela(true)
    if (zoomed) {
      setZoomed(false)
      return
    }
    setZoomed(true)
    setConfettiOn(true)
    setBurst(b => b + 1)
  }

  return (
    <section className={styles.tribute} aria-label="تكريم نجم المنصة الأول">
      {confettiOn && <GoldConfetti key={burst} />}
      {playing && <Fireworks />}

      <audio
        ref={audioRef}
        src="/audio/shela.mp3"
        preload="auto"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false)
          setLyric(0)
        }}
        onTimeUpdate={handleTimeUpdate}
      />

      {/* اللقب الملكي */}
      <div className={styles.titleBadge}>
        <span className={styles.badgeShine} aria-hidden="true" />
        <span className={styles.badgeCrown} aria-hidden="true">👑</span>
        <span className={styles.badgeText}>
          <span className={styles.badgeMain}>نجم المنصة الأول</span>
          <span className={styles.badgeDash}>—</span>
          <span className={styles.badgeSub}>لا خلا ولا عدم يا ذخرنا</span>
        </span>
        <span className={styles.badgeCrown} aria-hidden="true">👑</span>
      </div>

      {/* الصورة داخل الإطار الذهبي */}
      <div className={`${styles.portraitStage} ${playing ? styles.stagePlaying : ''}`}>
        <div className={styles.rays} aria-hidden="true" />
        <div className={styles.glow} aria-hidden="true" />

        <div className={styles.frame}>
          <button
            type="button"
            className={styles.photoButton}
            onClick={handlePhotoTap}
            aria-label="نجم المنصة الأول — المس الصورة للمفاجأة"
          >
            <span className={`${styles.scene} ${zoomed ? styles.sceneZoomed : ''}`}>
              <img src="/vip-star.jpg" alt="نجم المنصة الأول" className={styles.photo} />

              <span className={styles.crownAnchor} aria-hidden="true">
                <span className={styles.crownHalo} />
                <span className={styles.crownFloat}>
                  <RoyalCrown />
                </span>
                {CROWN_SPARKLES.map((s, i) => (
                  <svg
                    key={i}
                    viewBox="0 0 24 24"
                    className={s.rise ? styles.sparkleRise : styles.sparkle}
                    style={{
                      left: `${s.left}%`,
                      top: `${s.top}%`,
                      width: `${s.size}%`,
                      animationDelay: `${s.delay}s`,
                    }}
                  >
                    <path d={SPARKLE_PATH} fill="currentColor" />
                  </svg>
                ))}
              </span>

              <span className={styles.shades} aria-hidden="true">
                <PixelShades />
              </span>
            </span>
            <span className={styles.vignette} aria-hidden="true" />
          </button>

          {zoomed && <span className={styles.kashkha}>😎 الكشخة رسمية</span>}
          {playing && <RisingHearts />}

          <span className={`${styles.jewel} ${styles.jewelTR}`} aria-hidden="true" />
          <span className={`${styles.jewel} ${styles.jewelTL}`} aria-hidden="true" />
          <span className={`${styles.jewel} ${styles.jewelBR}`} aria-hidden="true" />
          <span className={`${styles.jewel} ${styles.jewelBL}`} aria-hidden="true" />
          <span className={`${styles.jewel} ${styles.jewelSideR}`} aria-hidden="true" />
          <span className={`${styles.jewel} ${styles.jewelSideL}`} aria-hidden="true" />
        </div>

        <button
          type="button"
          className={`${styles.shelaButton} ${playing ? styles.shelaButtonOn : ''}`}
          onClick={toggleShela}
          aria-pressed={playing}
        >
          <span className={styles.shelaIcon} aria-hidden="true">{playing ? '⏸️' : '🔊'}</span>
          <span>{playing ? 'إيقاف الشيلة' : 'شغّل الشيلة'}</span>
          <span className={styles.eq} aria-hidden="true"><i /><i /><i /><i /></span>
        </button>

        <div className={styles.hintSlot}>
          {playing ? (
            <span key={lyric} className={styles.lyricLine}>🎶 {SHELA_LINES[lyric]}</span>
          ) : (
            <span className={styles.tapHint} aria-hidden="true">
              👆 المس الصورة… فيها مفاجأة 😉
            </span>
          )}
        </div>
      </div>

      {/* بيت الشعر */}
      <blockquote className={styles.poem}>
        <span className={styles.poemOrnament} aria-hidden="true"><i /><b>❖</b><i /></span>
        <span className={styles.verse}>« تستاهل التاج المذهّب هديّـة ..</span>
        <span className={styles.verse}>يا اللي وفـاكـم ما يـشوبه عذاريب »</span>
        <span className={styles.poemOrnament} aria-hidden="true"><i /><b>❖</b><i /></span>
      </blockquote>

      <HaybaMeter />
    </section>
  )
}

/* ========================================================== */

function Login() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch(LOGIN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password
        })
      })

      const data = await response.json()

      if (response.ok && data.status_code === 200) {
        // حفظ Token و User info
        localStorage.setItem('token', data.data.token)
        localStorage.setItem('user', JSON.stringify(data.data.user))
        
        // إشعار نجاح
        window.showToast?.(`مرحباً ${data.data.user.name || 'بك'}! تم تسجيل الدخول بنجاح`, 'success')
        
        // إعادة التوجيه لصفحة Dashboard
        setTimeout(() => navigate('/dashboard'), 500)
      } else {
        setError(data.message || 'خطأ في تسجيل الدخول')
        window.showToast?.(data.message || 'خطأ في تسجيل الدخول', 'error')
      }
    } catch (err) {
      console.error('Login error:', err)
      setError('حدث خطأ في الاتصال بالخادم')
      window.showToast?.('حدث خطأ في الاتصال بالخادم', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.loginContainer}>
      {/* سماء ذهبية خلف الصفحة */}
      <div className={styles.starField} aria-hidden="true">
        {BG_STARS.map((s, i) => (
          <span
            key={i}
            className={styles.star}
            style={{
              left: `${s.left}%`,
              top: `${s.top}%`,
              width: s.size,
              height: s.size,
              animationDelay: `${s.delay}s`,
              animationDuration: `${s.dur}s`,
            }}
          />
        ))}
        {BG_SPARKS.map((s, i) => (
          <svg
            key={`spark-${i}`}
            viewBox="0 0 24 24"
            className={styles.bgSpark}
            style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, animationDelay: `${s.delay}s` }}
          >
            <path d={SPARKLE_PATH} fill="currentColor" />
          </svg>
        ))}
      </div>

      <RoyalTribute />

      {/* Logo Section */}
      <div className={styles.logoSection}>
        <a href="/" style={{ textDecoration: 'none' }}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>🏔️</span>
            <span className={styles.logoText}>الجبل</span>
          </div>
        </a>
        <p className={styles.logoTagline}>نظام إدارة الإجازات المرضية</p>
      </div>

      {/* Login Form */}
      <div className={styles.loginBox}>
        <h1 className={styles.title}>تسجيل الدخول</h1>
        <p className={styles.subtitle}>مرحباً بك في منصة صحة</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Email */}
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="email">
              البريد الإلكتروني
            </label>
            <input
              className={styles.input}
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="admin@seha.sa"
              required
              autoComplete="email"
            />
          </div>

          {/* Password */}
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="password">
              كلمة المرور
            </label>
            <input
              className={styles.input}
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className={styles.errorBox}>
              <span className={styles.errorIcon}>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className={styles.submitButton}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className={styles.spinner}></span>
                جاري تسجيل الدخول...
              </>
            ) : (
              'تسجيل الدخول'
            )}
          </button>
        </form>

        {/* Info */}
        <div className={styles.info}>
          <p>🔒 جميع البيانات محمية ومشفرة</p>
        </div>
      </div>
    </div>
  )
}

export default Login
