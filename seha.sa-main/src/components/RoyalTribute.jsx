import { useEffect, useRef, useState } from 'react'
import styles from './RoyalTribute.module.css'

// ───────────────────────────────────────────────────────────────────────────
// «التكريم الملكي» في صفحة الدخول.
//
// يعرض ما في الإعداد المطبَّع (config/loginTribute.js): النصوص والصورة
// والشيلة والمؤثرات. تستخدمه صفحة الدخول للعرض الحقيقي، وصفحة إدارة التكريم
// للمعاينة الحيّة.
// ───────────────────────────────────────────────────────────────────────────

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
function HaybaMeter({ loading, lines }) {
  const [step, setStep] = useState(-1)

  useEffect(() => {
    let cycle
    const loaded = setTimeout(() => {
      setStep(0)
      cycle = setInterval(() => setStep(n => n + 1), 2800)
    }, 2700)
    return () => {
      clearTimeout(loaded)
      clearInterval(cycle)
    }
  }, [])

  // بلا أسطر يبقى نص التحميل بعد اكتمال العدّاد
  const label = step < 0 || !lines.length ? loading : lines[step % lines.length]

  return (
    <div className={styles.meter} aria-hidden="true">
      <div className={styles.meterHead}>
        <span key={step} className={styles.meterLabel}>
          {label}
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

/**
 * @param {object} props.config إعداد مطبَّع من normalizeTribute()
 * @param {boolean} props.preview معاينة داخل لوحة الإدارة: لا قصاصات عند
 *   الفتح، والقصاصات والألعاب النارية تبقى داخل إطار المعاينة.
 */
export default function RoyalTribute({ config, preview = false }) {
  const { badge, poem, meter, shela, effects, photo } = config
  const lyrics = shela.lyrics
  const [zoomed, setZoomed] = useState(false)
  const [confettiOn, setConfettiOn] = useState(effects.confetti && !preview)
  const [burst, setBurst] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [lyric, setLyric] = useState(0)
  const audioRef = useRef(null)
  // إيقاف الشيلة من الإعدادات يزيل عنصر الصوت، فلا يصل حدث pause — نشتقّ الحالة
  const isPlaying = playing && shela.enabled

  const playShela = (fromStart) => {
    const audio = audioRef.current
    if (!audio) return
    if (fromStart || audio.ended) audio.currentTime = 0
    audio.play().catch(() => {})
  }

  const toggleShela = () => {
    if (isPlaying) audioRef.current?.pause()
    else playShela(false)
  }

  const handleTimeUpdate = (e) => {
    const { currentTime, duration } = e.currentTarget
    if (!lyrics.length) return
    const part = currentTime / (duration || 15)
    setLyric(Math.min(lyrics.length - 1, Math.floor(part * lyrics.length)))
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
    if (shela.enabled && !isPlaying) playShela(true)
    if (zoomed) {
      setZoomed(false)
      return
    }
    if (effects.sunglasses) setZoomed(true)
    if (effects.confetti) {
      setConfettiOn(true)
      setBurst(b => b + 1)
    }
  }

  const currentLyric = lyrics[Math.min(lyric, lyrics.length - 1)]

  return (
    <section
      className={`${styles.tribute} ${preview ? styles.preview : ''}`}
      aria-label={`تكريم ${badge.main || 'نجم المنصة'}`}
    >
      {confettiOn && <GoldConfetti key={burst} />}
      {isPlaying && effects.fireworks && <Fireworks />}

      {shela.enabled && (
        <audio
          ref={audioRef}
          src={config.audioSrc}
          preload="auto"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false)
            setLyric(0)
          }}
          onTimeUpdate={handleTimeUpdate}
        />
      )}

      {/* اللقب الملكي */}
      {(badge.main || badge.sub) && (
        <div className={styles.titleBadge}>
          <span className={styles.badgeShine} aria-hidden="true" />
          <span className={styles.badgeCrown} aria-hidden="true">👑</span>
          <span className={styles.badgeText}>
            {badge.main && <span className={styles.badgeMain}>{badge.main}</span>}
            {badge.main && badge.sub && <span className={styles.badgeDash}>—</span>}
            {badge.sub && <span className={styles.badgeSub}>{badge.sub}</span>}
          </span>
          <span className={styles.badgeCrown} aria-hidden="true">👑</span>
        </div>
      )}

      {/* الصورة داخل الإطار الذهبي */}
      <div className={`${styles.portraitStage} ${isPlaying ? styles.stagePlaying : ''}`}>
        <div className={styles.rays} aria-hidden="true" />
        <div className={styles.glow} aria-hidden="true" />

        <div className={styles.frame}>
          <button
            type="button"
            className={styles.photoButton}
            onClick={handlePhotoTap}
            aria-label={`${badge.main || 'صورة التكريم'} — المس الصورة للمفاجأة`}
          >
            <span
              className={`${styles.scene} ${zoomed ? styles.sceneZoomed : ''}`}
              style={{ transformOrigin: `${photo.glasses.x}% ${Math.max(0, photo.glasses.y - 12.6)}%` }}
            >
              <img src={config.photoSrc} alt={badge.main || 'صورة التكريم'} className={styles.photo} />

              {effects.crown && (
                <span
                  className={styles.crownAnchor}
                  style={{ left: `${photo.crown.x}%`, top: `${photo.crown.y}%`, width: `${photo.crown.size}%` }}
                  aria-hidden="true"
                >
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
              )}

              {effects.sunglasses && (
                <span
                  className={styles.shades}
                  style={{ left: `${photo.glasses.x}%`, top: `${photo.glasses.y}%`, width: `${photo.glasses.size}%` }}
                  aria-hidden="true"
                >
                  <PixelShades />
                </span>
              )}
            </span>
            <span className={styles.vignette} aria-hidden="true" />
            <span className={styles.sheen} aria-hidden="true" />
          </button>

          {zoomed && config.kashkha && <span className={styles.kashkha}>{config.kashkha}</span>}
          {isPlaying && effects.hearts && <RisingHearts />}

          <span className={`${styles.jewel} ${styles.jewelTR}`} aria-hidden="true" />
          <span className={`${styles.jewel} ${styles.jewelTL}`} aria-hidden="true" />
          <span className={`${styles.jewel} ${styles.jewelBR}`} aria-hidden="true" />
          <span className={`${styles.jewel} ${styles.jewelBL}`} aria-hidden="true" />
          <span className={`${styles.jewel} ${styles.jewelSideR}`} aria-hidden="true" />
          <span className={`${styles.jewel} ${styles.jewelSideL}`} aria-hidden="true" />
        </div>

        {shela.enabled && (
          <button
            type="button"
            className={`${styles.shelaButton} ${isPlaying ? styles.shelaButtonOn : ''}`}
            onClick={toggleShela}
            aria-pressed={isPlaying}
          >
            <span className={styles.shelaIcon} aria-hidden="true">{isPlaying ? '⏸️' : '🔊'}</span>
            <span>{isPlaying ? 'إيقاف الشيلة' : 'شغّل الشيلة'}</span>
            <span className={styles.eq} aria-hidden="true"><i /><i /><i /><i /></span>
          </button>
        )}

        {isPlaying && currentLyric ? (
          <div className={styles.hintSlot}>
            <span key={lyric} className={styles.lyricLine}>🎶 {currentLyric}</span>
          </div>
        ) : config.hint ? (
          <div className={styles.hintSlot}>
            <span className={styles.tapHint} aria-hidden="true">{config.hint}</span>
          </div>
        ) : null}
      </div>

      {/* بيت الشعر */}
      {poem.length > 0 && (
        <blockquote className={styles.poem}>
          <span className={styles.poemOrnament} aria-hidden="true"><i /><b>❖</b><i /></span>
          {poem.map((verse, i) => (
            <span key={i} className={styles.verse}>{verse}</span>
          ))}
          <span className={styles.poemOrnament} aria-hidden="true"><i /><b>❖</b><i /></span>
        </blockquote>
      )}

      {meter.enabled && <HaybaMeter loading={meter.loading} lines={meter.lines} />}
    </section>
  )
}

// سماء النجوم الذهبية خلف الصفحة كلها
export function TributeSky() {
  return (
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
  )
}
