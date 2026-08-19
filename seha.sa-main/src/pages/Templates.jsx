import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import styles from './Templates.module.css'
import { DOCUMENT_TYPE_LIST } from '../config/documentTypes'

// ───────────────────────────────────────────────────────────────────────────
// صفحة القوالب — تُبنى بالكامل من سجلّ القوالب (src/config/documentTypes.js).
//
// لا تعرّف هذه الصفحة أي قالب بنفسها: أي قالب يُضاف إلى السجلّ يظهر هنا تلقائياً
// ببطاقته وزر «استخدام القالب» ومعاينته، بلا أي تعديل في هذا الملف.
//
// «استخدام القالب» ينتقل إلى نموذج الإدخال نفسه المستخدَم لكل القوالب مع
// اختيار هذا القالب مسبقاً، فتُملأ البيانات من النظام الحالي (ذاكرة العميل
// برقم الهوية، الأطباء، المستشفيات، الجنسيات) ثم تُحفظ وتُعاين وتُطبع بنفس
// المسار القائم — لا نظام موازٍ ولا صفحة مستقلة.
// ───────────────────────────────────────────────────────────────────────────

// سجل تجريبي للمعاينة فقط — لا يُحفظ ولا يُرسل لأي مكان، والغرض منه أن يرى
// المستخدم شكل القالب قبل اختياره. رمز الخدمة وهمي بصيغة النظام.
const SAMPLE_RECORD = {
  service_num: 'GSL261000000000',
  leave_id: 'GSL261000000000',
  national_id: '1111111111',
  name_en: 'SAMPLE PATIENT NAME',
  name_ar: 'اسم المريض التجريبي',
  admission_date_en: '2026-04-12',
  admission_date_ar: '1447-10-24',
  discharge_date_en: '2026-04-12',
  discharge_date_ar: '1447-10-24',
  admission_time: '9:30 AM',
  discharge_time: '10:30 AM',
  issue_date: '2026-04-12',
  employer_ar: 'جهة العمل التجريبية',
  employer_en: '',
  physician_name_en: 'SAMPLE PRACTITIONER NAME',
  physician_name_ar: 'اسم الممارس التجريبي',
  position_en: 'General',
  position_ar: 'طبيب عام',
  relation_en: 'Brother',
  relation_ar: 'أخ',
  visit_type_en: 'Outpatient',
  visit_type_ar: 'عيادات',
  nationality: 'السعودية',
  country: { country_name_ar: 'السعودية', country_name_en: 'Saudi Arabia' },
  hospital_name_ar: 'مركز صحي السليمانية',
  hospital_name_en: 'Alsulaimaniyah Primary Health Center',
  leave_days: 1,
  show_license_number: true,
  license_number: '1410845906',
}

// وصف مختصر لقدرات كل قالب — يُشتق من السجلّ نفسه فلا يحتاج صيانة يدوية.
const featureBadges = (features) => {
  const badges = []
  if (features.leaveDuration) badges.push('مدة الإجازة')
  if (features.times) badges.push('وقت الدخول والخروج', 'فترة الانتظار')
  if (features.relation) badges.push('صلة القرابة')
  if (features.visitType) badges.push('نوع الزيارة')
  return badges
}

function Templates() {
  const navigate = useNavigate()
  const [previewKey, setPreviewKey] = useState(null)

  const previewTemplate = previewKey
    ? DOCUMENT_TYPE_LIST.find((t) => t.key === previewKey)
    : null
  const PreviewComponent = previewTemplate?.previewComponent

  const useTemplate = (key) => {
    // نفس نموذج الإدخال القائم، مع تمرير القالب المختار في حالة التنقّل
    // وفي الرابط معاً — فيبقى الاختيار قائماً حتى لو حُدِّثت الصفحة.
    navigate(`/sl-form?template=${encodeURIComponent(key)}`, { state: { templateType: key } })
  }

  return (
    <div className={styles.container} dir="rtl">
      <div className={styles.header}>
        <h1 className={styles.title}>قوالب المستندات</h1>
        <p className={styles.subtitle}>
          اختر القالب المناسب ثم اضغط «استخدام القالب» لفتح نموذج الإدخال وتعبئة البيانات من النظام.
        </p>
      </div>

      <div className={styles.grid}>
        {DOCUMENT_TYPE_LIST.map((template) => (
          <article
            key={template.key}
            className={styles.card}
            style={{ '--accent': template.accent }}
          >
            <div className={styles.cardHead}>
              <span className={styles.icon} aria-hidden="true">{template.icon}</span>
              <div>
                <h2 className={styles.cardTitle}>{template.titleAr}</h2>
                <p className={styles.cardTitleEn} dir="ltr">{template.titleEn}</p>
              </div>
            </div>

            {/* القوالب التي تعلن isMockup تُعرَّف صراحةً كنماذج تصميم قابلة
                للتحرير، لا كمستندات رسمية. */}
            {template.isMockup && (
              <span className={styles.mockupBadge}>🧩 {template.mockupNotice}</span>
            )}

            <p className={styles.description}>{template.description}</p>

            <ul className={styles.badges}>
              {featureBadges(template.features).map((badge) => (
                <li key={badge} className={styles.badge}>{badge}</li>
              ))}
            </ul>

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.useBtn}
                onClick={() => useTemplate(template.key)}
              >
                استخدام القالب
              </button>
              <button
                type="button"
                className={styles.previewBtn}
                onClick={() => setPreviewKey(template.key)}
              >
                معاينة
              </button>
            </div>
          </article>
        ))}
      </div>

      <div className={styles.footer}>
        <Link to="/dashboard" className={styles.backLink}>العودة إلى لوحة التحكم</Link>
      </div>

      {/* معاينة نموذجية ببيانات تجريبية — نفس مكوّن المعاينة المستخدَم للسجلات
          الحقيقية، فما يظهر هنا هو شكل المستند الفعلي تماماً. */}
      {PreviewComponent && (
        <PreviewComponent
          data={{ ...SAMPLE_RECORD, document_type: previewTemplate.key }}
          onClose={() => setPreviewKey(null)}
        />
      )}
    </div>
  )
}

export default Templates
