// أدوات مشتركة لمشاركة/تنزيل ملف تقرير الإجازة المرضية.
//
// المشاركة تُظهر قائمة مشاركة النظام (Web Share API) ومعها الملف نفسه، فتختار
// أي تطبيق (واتساب، تيليجرام، Quick Share…) — بدون أي نص أو رابط.
//
// نقطة مهمة: navigator.share() يجب أن يُستدعى ضمن "تفعيل المستخدم" (بعد النقر
// بثوانٍ قليلة). ولأن جلب ملف الـ PDF من الخادم يأخذ وقتًا، فإن الانتظار قد يُنهي
// التفعيل فتفشل المشاركة ويتحوّل السلوك إلى "تنزيل". الحل: نبدأ جلب الملف مسبقًا
// (prefetch) بمجرد لمس الزر ونخزّنه، فيصبح جاهزًا لحظة النقر وتُفتح قائمة المشاركة
// فورًا.

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

// اسم الملف الثابت المطلوب — بدون أي زيادة أو نقصان.
export const PDF_FILE_NAME = 'sickLeaves.pdf'

// جلب ملف PDF من الخادم (يُنشأ عبر Chromium page.pdf() بنفس شكل المعاينة).
export const fetchLeavePdfBlob = async (leave) => {
  const serviceNum = leave?.service_num
  const nationalId = leave?.national_id
  if (!serviceNum || !nationalId) {
    throw new Error('بيانات التقرير غير مكتملة')
  }

  const token = localStorage.getItem('token')
  const url = `${API_BASE_URL}/sick-leaves/${encodeURIComponent(serviceNum)}/${encodeURIComponent(nationalId)}/pdf`

  const response = await fetch(url, {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })

  if (!response.ok) {
    throw new Error(`PDF request failed with status ${response.status}`)
  }

  return await response.blob()
}

// ── تخزين مؤقت للملف + الجلب المسبق ─────────────────────────────────────────
// نخزّن وعد (Promise) جلب الملف لكل سجل، فلا نجلبه مرتين، ويصبح جاهزًا لحظة النقر.
const _blobCache = new Map()
const cacheKey = (leave) => `${leave?.service_num || ''}|${leave?.national_id || ''}`

// ابدأ جلب الملف مسبقًا (يُستدعى عند لمس/تمرير الزر). آمن للاستدعاء المتكرر.
export const prefetchLeavePdf = (leave) => {
  if (!leave?.service_num || !leave?.national_id) return null
  const key = cacheKey(leave)
  if (!_blobCache.has(key)) {
    const p = fetchLeavePdfBlob(leave).catch((err) => {
      _blobCache.delete(key) // اسمح بإعادة المحاولة عند الفشل
      throw err
    })
    _blobCache.set(key, p)
  }
  return _blobCache.get(key)
}

const getBlob = (leave) => _blobCache.get(cacheKey(leave)) || prefetchLeavePdf(leave)

// تنزيل blob باسم محدَّد.
export const downloadNamedBlob = (blob, fileName) => {
  const objectUrl = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(objectUrl)
}

// تنزيل الملف باسم sickLeaves.pdf.
export const downloadLeavePdf = (blob) => downloadNamedBlob(blob, PDF_FILE_NAME)

/**
 * مشاركة عدة ملفات PDF دفعة واحدة عبر قائمة مشاركة النظام (لإرسالها مجتمعةً
 * لواتساب أو أي تطبيق). files مصفوفة من File. إن لم يدعم الجهاز مشاركة عدة ملفات
 * تُنزَّل كلها. يعيد كائن حالة مثل shareLeavePdf.
 */
export const sharePdfFiles = async (files) => {
  if (!files || !files.length) return { none: true }
  if (navigator.canShare && navigator.canShare({ files })) {
    try {
      await navigator.share({ files })
      return { shared: true }
    } catch (err) {
      if (err && err.name === 'AbortError') return { cancelled: true }
      throw err
    }
  }
  // الجهاز لا يدعم مشاركة عدة ملفات (سطح المكتب غالبًا) → ننزّلها كلها.
  files.forEach((f) => downloadNamedBlob(f, f.name))
  return { downloaded: true }
}

// هل يدعم الجهاز مشاركة ملفات PDF أصلاً؟
export const canSharePdfFiles = () => {
  try {
    if (!navigator.canShare) return false
    const probe = new File([new Blob([''], { type: 'application/pdf' })], PDF_FILE_NAME, { type: 'application/pdf' })
    return navigator.canShare({ files: [probe] })
  } catch {
    return false
  }
}

/**
 * مشاركة ملف التقرير نفسه عبر قائمة مشاركة النظام (الملف فقط — بلا نص/رابط).
 * يعيد كائن حالة: { shared } نجحت، { cancelled } ألغى المستخدم،
 * { downloaded } الجهاز لا يدعم المشاركة فنُزِّل الملف.
 * يرمي استثناءً فقط عند فشل جلب الملف أو فشل المشاركة رغم الدعم (ليُظهر المُستدعي
 * رسالة "حاول مرة أخرى" — والملف يكون حينها مخزَّنًا فتنجح المحاولة التالية فورًا).
 */
export const shareLeavePdf = async (leave) => {
  // ننتظر الملف المُجهَّز مسبقًا (غالبًا يكون جاهزًا من prefetch عند لمس الزر).
  const blob = await getBlob(leave)
  const file = new File([blob], PDF_FILE_NAME, { type: 'application/pdf' })

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] }) // الملف فقط، بلا نص أو رابط
      return { shared: true }
    } catch (err) {
      if (err && err.name === 'AbortError') return { cancelled: true }
      // لا ننزّل تلقائيًا هنا حتى لا يتفاجأ المستخدم بتنزيل بدل المشاركة.
      throw err
    }
  }

  // الجهاز/المتصفح لا يدعم مشاركة الملفات (سطح المكتب غالبًا) → ننزّل الملف.
  downloadLeavePdf(blob)
  return { downloaded: true }
}
