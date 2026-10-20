// ───────────────────────────────────────────────────────────────────────────
// «التكريم الملكي» في صفحة الدخول — المحتوى الافتراضي وتطبيع الإعدادات.
//
// الخادم يحفظ ما يرسله المشرف فقط (بعد التحقق من الأنواع والحدود) في الإعداد
// login_tribute، والواجهة تكمل أي حقل ناقص من TRIBUTE_DEFAULTS هنا. هكذا يبقى
// النص الافتراضي في مكان واحد، وإعداد قديم أو ناقص لا يكسر الصفحة.
//
// الحقل الموجود يُحترم حتى لو كان فارغاً: قائمة [] تعني «امسح كل الأسطر» وليس
// «ارجع للافتراضي».
// ───────────────────────────────────────────────────────────────────────────

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

export const TRIBUTE_PUBLIC_URL = `${API_BASE_URL}/settings/public/login-tribute`
export const TRIBUTE_ADMIN_URL = `${API_BASE_URL}/settings/login-tribute`

export const DEFAULT_PHOTO = '/vip-star.jpg'
export const DEFAULT_AUDIO = '/audio/shela.mp3'

// نفس الحدود يفرضها الخادم (utils/loginTribute.js)
export const TRIBUTE_LIMITS = {
  text: 200,
  listItems: 12,
  poemLines: 4,
  position: { min: 0, max: 100 },
  size: { min: 5, max: 60 },
}

export const TRIBUTE_DEFAULTS = {
  enabled: false,
  badge: {
    main: 'نجم المنصة الأول',
    sub: 'لا خلا ولا عدم يا ذخرنا',
  },
  poem: [
    '« تستاهل التاج المذهّب هديّـة ..',
    'يا اللي وفـاكـم ما يـشوبه عذاريب »',
  ],
  hint: '👆 المس الصورة… فيها مفاجأة 😉',
  kashkha: '😎 الكشخة رسمية',
  meter: {
    enabled: true,
    loading: '⏳ جاري تحميل الهيبة…',
    lines: [
      '💍 تجهزز العرسس بالعيد الكبيررررر 🎉',
      '😎 مستوى الكشخة: فوق المقاييس',
      '🌹 حيّاك الله يا ذخرنا',
    ],
  },
  shela: {
    enabled: true,
    lyrics: [
      'ارحب يالذيب اللي فزعته تشفي الغليل..',
      'صقر المداين والفعل يسبق حكيه!',
      'يا مرحبا بلي ملا الطيب والمواقف طويل..',
      'منصة «صحتي» تنادي باسمه وتفتخر فيه!',
    ],
  },
  effects: {
    stars: true,
    confetti: true,
    crown: true,
    sunglasses: true,
    fireworks: true,
    hearts: true,
  },
  // مواقع التاج والنظارة نسبة مئوية من إطار الصورة — محسوبة للصورة الأصلية
  photo: {
    mediaId: null,
    crown: { x: 59.3, y: 28, size: 20 },
    glasses: { x: 60.4, y: 32.6, size: 14 },
  },
  audio: {
    mediaId: null,
  },
}

const str = (v, fallback) =>
  typeof v === 'string' ? v.slice(0, TRIBUTE_LIMITS.text) : fallback

const bool = (v, fallback) => (typeof v === 'boolean' ? v : fallback)

const num = (v, fallback, { min, max }) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback

// الأسطر الفارغة تُسقط عند العرض فقط؛ المحرّر يعمل على المسودة الخام.
const lines = (v, fallback, max) =>
  Array.isArray(v)
    ? v
        .filter(item => typeof item === 'string' && item.trim())
        .map(item => item.slice(0, TRIBUTE_LIMITS.text))
        .slice(0, max)
    : fallback

const spot = (v, d) => ({
  x: num(v?.x, d.x, TRIBUTE_LIMITS.position),
  y: num(v?.y, d.y, TRIBUTE_LIMITS.position),
  size: num(v?.size, d.size, TRIBUTE_LIMITS.size),
})

const mediaId = v => (Number.isInteger(v) && v > 0 ? v : null)

// روابط الخادم النسبية (/settings/public/...) تُكمَّل بعنوانه، وروابط
// http/data/blob تبقى كما هي، وأي مسار آخر يُعامل كملف من مجلد public للواجهة.
export function resolveMediaUrl(url) {
  if (typeof url !== 'string' || !url) return null
  if (/^(https?:|data:|blob:)/.test(url)) return url
  if (url.startsWith('/settings/')) return `${API_BASE_URL}${url}`
  return url
}

/**
 * يحوّل إعداداً خاماً (من الخادم أو من مسودة المحرّر) إلى شكل كامل جاهز للعرض.
 * photoUrl / audioUrl (إن وُجدا) هما رابطا الوسائط المختارة؛ بدونهما تُستخدم
 * الصورة والشيلة الأصليتان.
 */
export function normalizeTribute(raw) {
  const r = raw && typeof raw === 'object' ? raw : {}
  const d = TRIBUTE_DEFAULTS
  const photoId = mediaId(r.photo?.mediaId)
  const audioId = mediaId(r.audio?.mediaId)

  return {
    enabled: bool(r.enabled, d.enabled),
    badge: {
      main: str(r.badge?.main, d.badge.main).trim(),
      sub: str(r.badge?.sub, d.badge.sub).trim(),
    },
    poem: lines(r.poem, d.poem, TRIBUTE_LIMITS.poemLines),
    hint: str(r.hint, d.hint).trim(),
    kashkha: str(r.kashkha, d.kashkha).trim(),
    meter: {
      enabled: bool(r.meter?.enabled, d.meter.enabled),
      loading: str(r.meter?.loading, d.meter.loading).trim(),
      lines: lines(r.meter?.lines, d.meter.lines, TRIBUTE_LIMITS.listItems),
    },
    shela: {
      enabled: bool(r.shela?.enabled, d.shela.enabled),
      lyrics: lines(r.shela?.lyrics, d.shela.lyrics, TRIBUTE_LIMITS.listItems),
    },
    effects: Object.fromEntries(
      Object.entries(d.effects).map(([k, def]) => [k, bool(r.effects?.[k], def)])
    ),
    photo: {
      mediaId: photoId,
      crown: spot(r.photo?.crown, d.photo.crown),
      glasses: spot(r.photo?.glasses, d.photo.glasses),
    },
    audio: { mediaId: audioId },
    photoSrc: (photoId && resolveMediaUrl(r.photoUrl)) || DEFAULT_PHOTO,
    audioSrc: (audioId && resolveMediaUrl(r.audioUrl)) || DEFAULT_AUDIO,
  }
}

/**
 * يقرأ الإعداد العام لصفحة الدخول. أي فشل (خادم نائم، شبكة، رد غير صالح)
 * يعني «لا تكريم» — الصفحة تعمل كالمعتاد بدونه.
 */
export async function loadTribute({ signal } = {}) {
  try {
    const res = await fetch(TRIBUTE_PUBLIC_URL, { signal, cache: 'no-store' })
    if (!res.ok) return null
    const body = await res.json()
    return body?.data ? normalizeTribute(body.data) : null
  } catch {
    return null
  }
}
