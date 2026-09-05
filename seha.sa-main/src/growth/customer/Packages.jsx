// صفحة الباقات — واجهة العميل.
//
// كل قيمة هنا تأتي من /growth/public/products و /growth/public/settings.
// لا سعر ولا رقم واتساب ولا تعليمات دفع مكتوبة في هذا الملف: ما يعدّله
// المشغّل من اللوحة يظهر هنا في التحميل التالي مباشرة.

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import s from './customer.module.css'
import { api, toast } from '../api'

const CYCLE = {
  monthly: 'شهرياً', quarterly: 'كل 3 أشهر',
  annual: 'سنوياً', lifetime: 'مرة واحدة',
}

const FEATURE_LABELS = {
  whatsapp: 'الإرسال عبر واتساب',
  batch: 'الإصدار الجماعي',
  templates: 'القوالب المتقدّمة',
  priority_support: 'دعم ذو أولوية',
}

export default function Packages() {
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [settings, setSettings] = useState({})
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [selected, setSelected] = useState(null)
  const [couponCode, setCouponCode] = useState('')
  const [couponState, setCouponState] = useState(null)
  const [placing, setPlacing] = useState(false)

  const isLoggedIn = !!localStorage.getItem('token')

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [p, cfg] = await Promise.all([api.storefront(), api.publicSettings()])
      setProducts(p); setSettings(cfg)
      if (isLoggedIn) {
        try { setProfile(await api.myProfile()) } catch { /* زائر بلا ملف بعد */ }
      }
    } catch (e) { setError(e) } finally { setLoading(false) }
  }, [isLoggedIn])

  useEffect(() => { load() }, [load])

  // التحقّق من الكوبون أثناء الكتابة: يحسب الخصم ولا يستهلك سقفاً.
  useEffect(() => {
    if (!selected || couponCode.trim().length < 3) { setCouponState(null); return undefined }
    const id = setTimeout(async () => {
      try {
        setCouponState(await api.validateCoupon({
          code: couponCode.trim(), product_id: selected.id, amount: Number(selected.price),
        }))
      } catch { setCouponState({ valid: false, reason: 'تعذّر التحقّق' }) }
    }, 400)
    return () => clearTimeout(id)
  }, [couponCode, selected])

  const placeOrder = async () => {
    if (!isLoggedIn) { navigate('/login'); return }
    setPlacing(true)
    try {
      const res = await api.placeOrder({
        product_id: selected.id,
        coupon_code: couponState?.valid ? couponCode.trim() : undefined,
      })
      navigate('/my-account', { state: { newOrder: res.order.reference } })
      toast('تم إنشاء الطلب — أكمل التحويل ثم أرفق الإيصال', 'success')
    } catch (e) {
      toast(e.message, 'error')
    } finally { setPlacing(false) }
  }

  const waLink = settings['support.whatsapp_number']
    ? `https://wa.me/${settings['support.whatsapp_number']}?text=${
      encodeURIComponent(settings['support.whatsapp_message'] || '')}`
    : null

  if (loading) return <div className={s.loading}>جارٍ التحميل…</div>

  if (error) {
    return (
      <div className={s.page}>
        <div className={s.errorBox}>
          تعذّر تحميل الباقات.
          <button type="button" className={s.btnGhost} onClick={load}>إعادة المحاولة</button>
        </div>
      </div>
    )
  }

  const price = selected ? Number(selected.price) : 0
  const discount = couponState?.valid ? Number(couponState.discount || 0) : 0
  const net = Math.max(0, price - discount)

  return (
    <div className={s.page}>
      {settings['ops.storefront_notice'] && (
        <div className={s.notice}>{settings['ops.storefront_notice']}</div>
      )}

      <header className={s.head}>
        <h1 className={s.title}>الباقات والأرصدة</h1>
        <p className={s.sub}>اختر ما يناسب حجم عملك. تستطيع الترقية أو شراء رصيد إضافي في أي وقت.</p>
        {profile && (
          <div className={s.balancePill}>
            رصيدك الحالي: <strong>{profile.credit_balance}</strong> رصيد
          </div>
        )}
      </header>

      {products.length === 0 ? (
        <div className={s.empty}>
          <div className={s.emptyIcon}>📦</div>
          <p>لا توجد باقات متاحة حالياً.</p>
          {waLink && <a className={s.btnPrimary} href={waLink} target="_blank" rel="noreferrer">تواصل معنا</a>}
        </div>
      ) : (
        <>
          <div className={s.grid}>
            {products.filter((p) => p.kind === 'subscription').map((p) => (
              <article key={p.id} className={s.card}>
                <h2 className={s.cardTitle}>{p.name}</h2>
                {p.description && <p className={s.cardDesc}>{p.description}</p>}
                <div className={s.priceRow}>
                  <span className={s.price}>{Number(p.price).toLocaleString('ar')}</span>
                  <span className={s.currency}>{p.currency}</span>
                  <span className={s.cycle}>/ {CYCLE[p.billing_cycle] || ''}</span>
                </div>
                <div className={s.credits}>{Number(p.credits_granted).toLocaleString('ar')} رصيد كل دورة</div>
                {p.trial_days > 0 && <div className={s.trial}>تجربة {p.trial_days} يوماً</div>}
                <ul className={s.features}>
                  {Object.entries(p.features || {}).filter(([, on]) => on).map(([k]) => (
                    <li key={k}>✓ {FEATURE_LABELS[k] || k}</li>
                  ))}
                </ul>
                <button type="button" className={s.btnPrimary}
                  onClick={() => { setSelected(p); setCouponCode(''); setCouponState(null) }}>
                  اشترك الآن
                </button>
              </article>
            ))}
          </div>

          {products.some((p) => p.kind === 'credit_pack') && (
            <>
              <h2 className={s.sectionTitle}>حزم رصيد إضافية</h2>
              <p className={s.sectionSub}>شراء لمرة واحدة، بلا تجديد. تُضاف إلى رصيدك ولا تنتهي صلاحيتها.</p>
              <div className={s.grid}>
                {products.filter((p) => p.kind === 'credit_pack').map((p) => (
                  <article key={p.id} className={`${s.card} ${s.cardPack}`}>
                    <h3 className={s.cardTitle}>{p.name}</h3>
                    <div className={s.credits}>{Number(p.credits_granted).toLocaleString('ar')} رصيد</div>
                    <div className={s.priceRow}>
                      <span className={s.price}>{Number(p.price).toLocaleString('ar')}</span>
                      <span className={s.currency}>{p.currency}</span>
                    </div>
                    <button type="button" className={s.btnGhost}
                      onClick={() => { setSelected(p); setCouponCode(''); setCouponState(null) }}>
                      شراء
                    </button>
                  </article>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {waLink && (
        <a className={s.waFloat} href={waLink} target="_blank" rel="noreferrer"
          title="تواصل عبر واتساب">💬</a>
      )}

      {selected && (
        <div className={s.overlay} onMouseDown={(e) => {
          if (e.target === e.currentTarget && !placing) setSelected(null)
        }}>
          <div className={s.modal}>
            <header className={s.modalHead}>
              <h3>تأكيد الطلب</h3>
              <button type="button" className={s.close} onClick={() => setSelected(null)}>×</button>
            </header>

            <div className={s.modalBody}>
              <div className={s.summary}>
                <div className={s.summaryRow}>
                  <span>{selected.name}</span>
                  <span>{price.toLocaleString('ar')} {selected.currency}</span>
                </div>
                {discount > 0 && (
                  <div className={`${s.summaryRow} ${s.discountRow}`}>
                    <span>خصم الكوبون</span>
                    <span>− {discount.toLocaleString('ar')} {selected.currency}</span>
                  </div>
                )}
                <div className={`${s.summaryRow} ${s.totalRow}`}>
                  <span>الإجمالي</span>
                  <span>{net.toLocaleString('ar')} {selected.currency}</span>
                </div>
                <div className={s.summaryNote}>
                  ستحصل على {Number(selected.credits_granted).toLocaleString('ar')} رصيد
                  {couponState?.valid && couponState.credits_granted > 0
                    && ` + ${couponState.credits_granted} رصيد من الكوبون`}
                </div>
              </div>

              <label className={s.label}>كوبون خصم (اختياري)</label>
              <input className={s.input} value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                placeholder="أدخل الرمز" />
              {couponState && (
                <div className={couponState.valid ? s.couponOk : s.couponBad}>
                  {couponState.valid
                    ? `✓ خصم ${Number(couponState.discount).toLocaleString('ar')} ${selected.currency}`
                    : `✕ ${couponState.reason}`}
                </div>
              )}

              {!isLoggedIn && (
                <div className={s.infoBox}>
                  تحتاج تسجيل الدخول لإتمام الطلب.
                </div>
              )}
            </div>

            <footer className={s.modalFoot}>
              <button type="button" className={s.btnPrimary} onClick={placeOrder} disabled={placing}>
                {placing ? 'جارٍ الإنشاء…' : isLoggedIn ? 'إنشاء الطلب' : 'تسجيل الدخول'}
              </button>
              <button type="button" className={s.btnGhost} onClick={() => setSelected(null)}>إلغاء</button>
            </footer>
          </div>
        </div>
      )}
    </div>
  )
}
