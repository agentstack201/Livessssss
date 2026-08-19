import { createPortal } from 'react-dom'
import { downloadNamedBlob, PDF_FILE_NAME } from '../utils/pdfShare'

// ───────────────────────────────────────────────────────────────────────────
// قائمة المشاركة المحدودة: واتساب ١ و٢ وواتساب للأعمال وتيليجرام فقط.
//
// لماذا قائمة داخلية بدل قائمة النظام: قائمة مشاركة النظام (navigator.share)
// يبنيها نظام التشغيل نفسه، ولا تستطيع صفحة ويب أن تحذف منها تطبيقاً
// (إنستغرام، فيسبوك، الرسائل…). فالطريقة الوحيدة لعرض هذه التطبيقات الأربعة
// وحدها هي فتح كلٍّ منها مباشرةً برابطه الخاص، وهو ما تفعله هذه القائمة.
//
// حدٌّ تقني يجب معرفته: لا يستطيع أي موقع ويب أن يدفع *ملفاً* إلى تطبيق بعينه
// — تمرير الملفات حكرٌ على قائمة النظام. لذلك كل خيار هنا يفعل شيئين معاً:
// ينزّل ملف التقرير على الجهاز، ثم يفتح التطبيق المطلوب برسالة فيها رابط
// التقرير — فيرفق المستخدم الملف المنزَّل إن أراد إرساله كملف.
// ───────────────────────────────────────────────────────────────────────────

const isAndroid = () => /android/i.test(navigator.userAgent || '')

// رابط فتح تطبيق بعينه. على أندرويد نستخدم intent:// مع اسم الحزمة فيفتح
// التطبيق المقصود مباشرةً بلا وسيط؛ وفي غيره نقع على الرابط العام للتطبيق.
const buildAppUrl = (target, text) => {
  const encoded = encodeURIComponent(text)
  if (target.package && isAndroid()) {
    return `intent://${target.intentPath}${encoded}#Intent;scheme=${target.scheme};package=${target.package};end`
  }
  return target.fallback(encoded)
}

export const SHARE_TARGETS = [
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    hint: 'الحساب الأول',
    color: '#25D366',
    icon: '📱',
    scheme: 'whatsapp',
    package: 'com.whatsapp',
    intentPath: 'send?text=',
    fallback: (t) => `https://wa.me/?text=${t}`,
  },
  {
    id: 'whatsapp2',
    label: 'WhatsApp 2',
    hint: 'الحساب الثاني (المزدوج)',
    color: '#1EB954',
    icon: '📲',
    scheme: 'whatsapp',
    // النسخة المستنسخة (Dual Messenger) لا تحمل اسم حزمة ثابتاً، فنفتح الرابط
    // العام ليظهر اختيار الحساب من الجهاز نفسه.
    package: null,
    intentPath: 'send?text=',
    fallback: (t) => `whatsapp://send?text=${t}`,
  },
  {
    id: 'whatsapp-business',
    label: 'WhatsApp Business',
    hint: 'حساب الأعمال',
    color: '#128C7E',
    icon: '💼',
    scheme: 'whatsapp',
    package: 'com.whatsapp.w4b',
    intentPath: 'send?text=',
    fallback: (t) => `whatsapp://send?text=${t}`,
  },
  {
    id: 'telegram',
    label: 'Telegram',
    hint: 'تيليجرام',
    color: '#229ED9',
    icon: '✈️',
    scheme: 'tg',
    package: 'org.telegram.messenger',
    intentPath: 'msg_url?url=',
    fallback: (t) => `https://t.me/share/url?url=${t}`,
  },
]

/**
 * @param {Blob|File} blob   ملف التقرير الجاهز
 * @param {string} link      رابط الاستعلام الذي يُرسل في نصّ الرسالة
 * @param {string} fileName  اسم الملف عند التنزيل
 */
function ShareTargets({ blob, link, fileName = PDF_FILE_NAME, onClose }) {
  const send = (target) => {
    // ١) الملف على الجهاز أولاً — ليكون جاهزاً للإرفاق في المحادثة.
    if (blob) downloadNamedBlob(blob, fileName)
    // ٢) ثم نفتح التطبيق المطلوب وحده برسالة فيها رابط التقرير.
    window.location.href = buildAppUrl(target, link)
    onClose?.()
  }

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 10000,
      }}
    >
      <div
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          width: '100%',
          maxWidth: 520,
          borderRadius: '18px 18px 0 0',
          padding: '18px 18px 26px',
          fontFamily: 'Cairo, sans-serif',
          boxShadow: '0 -8px 30px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ width: 44, height: 4, background: '#cbd5e1', borderRadius: 4, margin: '0 auto 14px' }} />
        <h3 style={{ margin: '0 0 4px', fontSize: '1.05rem', color: '#0f172a', textAlign: 'center' }}>
          مشاركة التقرير
        </h3>
        <p style={{ margin: '0 0 16px', fontSize: '0.78rem', color: '#64748b', textAlign: 'center' }}>
          يُحفظ الملف على جهازك ثم يُفتح التطبيق المختار
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {SHARE_TARGETS.map((target) => (
            <button
              key={target.id}
              type="button"
              onClick={() => send(target)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 14px',
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                background: '#fff',
                cursor: 'pointer',
                textAlign: 'right',
                fontFamily: 'inherit',
              }}
            >
              <span style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: target.color,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                flexShrink: 0,
              }}>{target.icon}</span>
              <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>{target.label}</strong>
                <small style={{ fontSize: '0.72rem', color: '#64748b' }}>{target.hint}</small>
              </span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            marginTop: 14,
            width: '100%',
            padding: '11px',
            border: 'none',
            borderRadius: 12,
            background: '#f1f5f9',
            color: '#334155',
            fontFamily: 'inherit',
            fontSize: '0.95rem',
            cursor: 'pointer',
          }}
        >
          إلغاء
        </button>
      </div>
    </div>,
    document.body
  )
}

export default ShareTargets
