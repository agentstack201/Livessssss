// ───────────────────────────────────────────────────────────────────────────
// القالب الخامس في الواجهة — الهويّة وجلب الملف، لا أكثر.
//
// القالب نفسه ملف PDF أصلي محفوظ في الخادم
// (seha-app-server-main/templates/template5/master.pdf)، وتُحقن فيه البيانات
// هناك. لذلك لا يوجد في الواجهة أي تخطيط ولا CSS لهذا القالب: المعاينة تعرض
// الملف الحقيقي نفسه، فما يراه المستخدم هو ما يُنزّله بالضبط — لا محاكاة.
// ───────────────────────────────────────────────────────────────────────────
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

export const TEMPLATE5_ID = 'sick_leave_enhanced'
export const TEMPLATE5_NAME_AR = 'تقرير إجازة مرضية - محسن'
export const TEMPLATE5_NAME_EN = 'Sick Leave Report — Enhanced Template'
export const TEMPLATE5_MOCKUP_NOTICE = 'نموذج تصميم قابل للتحرير — ليس مستنداً رسمياً'

/**
 * يولّد ملف المعاينة من بيانات السجل مباشرةً (بلا حفظ). يُستخدم لعرض القالب
 * قبل الحفظ ولمعاينة البيانات التجريبية في صفحة القوالب.
 */
export const fetchTemplate5PreviewBlob = async (record) => {
  const token = localStorage.getItem('token')
  const response = await fetch(`${API_BASE_URL}/sick-leaves/template5/preview`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ data: record || {} }),
  })
  if (!response.ok) {
    // الخادم يشرح سبب الفشل بالعربية (مثل صيغة شعار غير مدعومة). نمرّره كما
    // هو ليقرأه المستخدم بدل رسالة عامة لا تدلّه على ما يصلحه.
    const detail = await response.json().then((d) => d?.message).catch(() => null)
    const error = new Error(detail || `preview request failed with status ${response.status}`)
    error.serverMessage = detail || ''
    throw error
  }
  return await response.blob()
}
