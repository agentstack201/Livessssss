// أدوات مشتركة لمشاركة/تنزيل ملف تقرير الإجازة المرضية.
// المشاركة تُرفع الملف نفسه عبر قائمة مشاركة النظام (أي تطبيق) — بدون أي نص أو رابط.

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

// تنزيل الملف باسم sickLeaves.pdf.
export const downloadLeavePdf = (blob) => {
  const objectUrl = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = PDF_FILE_NAME
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(objectUrl)
}

/**
 * مشاركة ملف التقرير نفسه عبر قائمة مشاركة النظام (أي تطبيق: واتساب، تيليجرام،
 * البريد، الملفات…). يُشارَك الملف فقط — بدون أي نص أو رابط.
 * إن لم يدعم المتصفح مشاركة الملفات (سطح المكتب غالبًا) يُنزَّل الملف
 * باسم sickLeaves.pdf.
 *
 * يرمي استثناءً عند فشل جلب الملف؛ على المُستدعي التقاطه وعرض رسالة مناسبة.
 */
export const shareLeavePdf = async (leave) => {
  const blob = await fetchLeavePdfBlob(leave)
  const file = new File([blob], PDF_FILE_NAME, { type: 'application/pdf' })

  // مشاركة الملف نفسه فقط (بلا نص/رابط) عبر قائمة مشاركة النظام.
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return
    } catch (shareErr) {
      if (shareErr && shareErr.name === 'AbortError') return // ألغى المستخدم
      // فشل المشاركة → ننتقل للتنزيل بالأسفل.
    }
  }

  // المتصفح لا يدعم مشاركة الملفات: ننزّل الملف نفسه.
  downloadLeavePdf(blob)
}
