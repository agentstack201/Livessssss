// أدوات مشتركة لإرسال تقرير الإجازة المرضية عبر واتساب.
// تُستخدم من نافذة معاينة التقرير (SickLeavePDFOriginal) ومن قائمة السجلات
// في لوحة التحكم مباشرةً (بدون فتح التقرير أولاً).

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

// تحويل رقم الجوال إلى صيغة دولية يقبلها واتساب (بدون + أو أصفار بادئة).
// يفترض السعودية عند رقم محلي يبدأ بـ 0 (مثال: 05xxxxxxxx → 9665xxxxxxxx).
export const normalizeWhatsAppNumber = (raw) => {
  let d = String(raw || '').replace(/\D/g, '')
  if (!d) return ''
  if (d.startsWith('00')) d = d.slice(2)              // 00966… → 966…
  else if (d.startsWith('0')) d = '966' + d.slice(1)  // 05xxxxxxxx → 9665xxxxxxxx
  return d
}

// اسم ملف التقرير المُنزَّل — يتضمّن رقم الخدمة لتمييز كل تقرير.
export const leavePdfFileName = (leave) => `SickLeave-${leave?.service_num || 'report'}.pdf`

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

// نص الرسالة المرافقة للتقرير في واتساب.
const buildShareText = (leave) => {
  const frontendUrl = window.location.origin
  const verificationUrl = `${frontendUrl}/inquiries/slenquiry?service_num=${leave.service_num}&national_id=${leave.national_id}`
  return (
    `تقرير الإجازة المرضية 🏥\n` +
    `رمز الإجازة: ${leave.leave_id || ''}\n` +
    `الاسم: ${leave.name_ar || ''}\n` +
    `للتحقق من التقرير: ${verificationUrl}`
  )
}

/**
 * مشاركة/إرسال ملف الإجازة عبر واتساب — بدون الحاجة لإدخال أي رقم.
 * - على الجوال/المتصفحات الداعمة: تُفتح قائمة مشاركة النظام مع إرفاق ملف الـ PDF
 *   فعليًا، فتشاركه في أي مكان (واتساب، تيليجرام، البريد…) وتختار الزبون.
 * - على سطح المكتب/المتصفحات غير الداعمة: يُنزَّل الملف تلقائيًا، ثم:
 *     • إن كان رقم جوال الزبون مخزَّنًا → تُفتح محادثته مباشرة لإرساله له.
 *     • وإلا → يُفتح واتساب لتختار جهة الاتصال بنفسك (بدون طلب رقم).
 *
 * يرمي استثناءً عند فشل جلب الملف؛ على المُستدعي التقاطه وعرض رسالة مناسبة.
 */
export const sendLeaveViaWhatsApp = async (leave) => {
  if (!leave?.service_num || !leave?.national_id) {
    throw new Error('بيانات التقرير غير مكتملة')
  }

  const shareText = buildShareText(leave)
  const fileName = leavePdfFileName(leave)
  // نستخرج رقم الزبون تلقائيًا إن وُجد (لا نطلبه من المستخدم أبدًا).
  const customerNumber = normalizeWhatsAppNumber(leave.phone)

  const blob = await fetchLeavePdfBlob(leave)
  const file = new File([blob], fileName, { type: 'application/pdf' })

  // المسار الأمثل: مشاركة الملف نفسه عبر قائمة مشاركة النظام (يشمل واتساب وغيره).
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: 'تقرير الإجازة المرضية',
        text: shareText,
      })
      return
    } catch (shareErr) {
      if (shareErr && shareErr.name === 'AbortError') return // ألغى المستخدم
      // في حال فشل المشاركة نكمل للمسار البديل بالأسفل.
    }
  }

  // المسار البديل: تنزيل الملف ثم فتح واتساب مباشرة (بدون طلب رقم).
  const objectUrl = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(objectUrl)

  // إن كان رقم الزبون مخزَّنًا نفتح محادثته مباشرة؛ وإلا نفتح واتساب ليختار
  // المستخدم جهة الاتصال بنفسه — دون أي مطالبة بإدخال رقم.
  const waUrl = customerNumber
    ? `https://wa.me/${customerNumber}?text=${encodeURIComponent(shareText)}`
    : `https://wa.me/?text=${encodeURIComponent(shareText)}`
  window.open(waUrl, '_blank', 'noopener,noreferrer')
  alert('تم تنزيل ملف الإجازة ✅\nأرفِق الملف في محادثة واتساب التي فُتحت لإرساله للزبون.')
}
