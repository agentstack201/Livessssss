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
 * إرسال ملف الإجازة مباشرة عبر واتساب.
 * - على الجوال/المتصفحات الداعمة: تُفتح قائمة المشاركة ويظهر واتساب مع إرفاق
 *   ملف الـ PDF فعليًا — فيصله الزبون كملف جاهز.
 * - على سطح المكتب/المتصفحات غير الداعمة: يُنزَّل الملف ثم يُفتح واتساب مع رسالة
 *   جاهزة ورقم الزبون المخزَّن (أو يُطلب الرقم مرة واحدة إن لم يكن مخزَّنًا).
 *
 * يرمي استثناءً عند فشل جلب الملف؛ على المُستدعي التقاطه وعرض رسالة مناسبة.
 */
export const sendLeaveViaWhatsApp = async (leave) => {
  if (!leave?.service_num || !leave?.national_id) {
    throw new Error('بيانات التقرير غير مكتملة')
  }

  const shareText = buildShareText(leave)
  const fileName = leavePdfFileName(leave)
  const customerNumber = normalizeWhatsAppNumber(leave.phone)

  const blob = await fetchLeavePdfBlob(leave)
  const file = new File([blob], fileName, { type: 'application/pdf' })

  // المسار الأمثل: مشاركة الملف نفسه عبر قائمة مشاركة النظام (يشمل واتساب).
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

  // المسار البديل: تنزيل الملف ثم فتح واتساب مع الرسالة الجاهزة.
  const objectUrl = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(objectUrl)

  // نستخدم رقم الزبون المخزَّن مباشرة إن وُجد؛ وإلا نطلبه مرة واحدة.
  let digits = customerNumber
  if (!digits) {
    const phone = window.prompt(
      'أدخل رقم جوال الزبون مع رمز الدولة (مثال: 9665xxxxxxxx)\nأو اتركه فارغاً لاختيار جهة الاتصال داخل واتساب:',
      ''
    )
    // إذا ضغط المستخدم "إلغاء" لا نفتح واتساب.
    if (phone === null) return
    digits = normalizeWhatsAppNumber(phone)
  }

  const waUrl = digits
    ? `https://wa.me/${digits}?text=${encodeURIComponent(shareText)}`
    : `https://wa.me/?text=${encodeURIComponent(shareText)}`
  window.open(waUrl, '_blank', 'noopener,noreferrer')
  alert('تم تنزيل ملف الإجازة ✅\nأرفِق الملف في محادثة واتساب التي فُتحت لإرساله للزبون.')
}
