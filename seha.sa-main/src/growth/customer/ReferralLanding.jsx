// صفحة هبوط الإحالة — /r/:code
//
// ملاحظة عن هذا المنتج تحديداً: لا يوجد تسجيل ذاتي — الحسابات يُنشئها فريق
// المنصة. لذلك لا تدّعي هذه الصفحة أن الزائر سيسجّل بنفسه؛ تُظهر له الرمز
// وتوصله بالفريق عبر واتساب بالرمز مُعبّأً مسبقاً، فيُدخله المشغّل عند إنشاء
// الحساب وتُسنَد الإحالة.
//
// الرمز يُحفظ محلياً أيضاً: إن أُضيف تسجيل ذاتي لاحقاً يعمل الإسناد تلقائياً
// بلا تغيير في هذه الصفحة.

import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import s from './customer.module.css'
import { api } from '../api'

/** يُقرأ عند إنشاء الحساب ويُرسَل كـ referral_code. */
export const REFERRAL_STORAGE_KEY = 'seha_referral_code'

export default function ReferralLanding() {
  const { code } = useParams()
  const [state, setState] = useState('tracking')
  const [settings, setSettings] = useState({})
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      // نحفظ الرمز أولاً: حتى لو فشل التتبّع، يظلّ الإسناد ممكناً لأن الخادم
      // ينشئ حدث الإحالة عند إنشاء الحساب إن لم يجد نقرة مسجّلة.
      try { localStorage.setItem(REFERRAL_STORAGE_KEY, code) } catch { /* وضع خاص */ }

      const [tracked, cfg] = await Promise.allSettled([
        api.trackReferral(code),
        api.publicSettings(),
      ])
      if (cancelled) return

      if (cfg.status === 'fulfilled') setSettings(cfg.value)

      if (tracked.status === 'fulfilled' && !tracked.value.tracked) {
        setState('invalid')
        try { localStorage.removeItem(REFERRAL_STORAGE_KEY) } catch { /* تجاهل */ }
      } else {
        // فشل الشبكة لا يُعامَل كرابط باطل — الرمز محفوظ والإسناد ما زال ممكناً.
        setState('ok')
      }
    })()

    return () => { cancelled = true }
  }, [code])

  const upper = String(code || '').toUpperCase()

  const waLink = settings['support.whatsapp_number']
    ? `https://wa.me/${settings['support.whatsapp_number']}?text=${encodeURIComponent(
      `مرحباً، وصلتني دعوة لاستخدام المنصة. رمز الإحالة: ${upper}`)}`
    : null

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(upper)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    } catch { /* المستخدم ينسخه يدوياً */ }
  }

  if (state === 'tracking') {
    return (
      <div className={s.landing}>
        <div className={s.landingCard}>
          <div className={s.landingIcon}>⏳</div>
          <p className={s.landingText}>لحظة…</p>
          <div className={s.landingBar}><span /></div>
        </div>
      </div>
    )
  }

  if (state === 'invalid') {
    return (
      <div className={s.landing}>
        <div className={s.landingCard}>
          <div className={s.landingIcon}>🔗</div>
          <h1 className={s.landingTitle}>هذا الرابط لم يعد صالحاً</h1>
          <p className={s.landingText}>
            ربما انتهت صلاحيته أو بلغ حدّ استخدامه. تستطيع تصفّح الباقات والاشتراك مباشرة.
          </p>
          <Link className={s.btnPrimary} to="/packages">عرض الباقات</Link>
        </div>
      </div>
    )
  }

  return (
    <div className={s.landing}>
      <div className={s.landingCard}>
        <div className={s.landingIcon}>👋</div>
        <h1 className={s.landingTitle}>أهلاً بك</h1>
        <p className={s.landingText}>
          وصلت عبر دعوة من زميل يستخدم المنصة. اذكر هذا الرمز عند التواصل معنا
          ليُسجَّل لك ولصاحب الدعوة.
        </p>

        <button type="button" className={s.codeChip} onClick={copyCode} title="انسخ الرمز">
          <span className={s.codeValue}>{upper}</span>
          <span className={s.codeHint}>{copied ? '✓ نُسخ' : 'اضغط للنسخ'}</span>
        </button>

        <div className={s.landingActions}>
          {waLink && (
            <a className={s.btnPrimary} href={waLink} target="_blank" rel="noreferrer">
              تواصل عبر واتساب
            </a>
          )}
          <Link className={s.btnGhost} to="/packages">تصفّح الباقات أولاً</Link>
        </div>
      </div>
    </div>
  )
}
