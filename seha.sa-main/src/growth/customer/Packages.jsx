// صفحة الباقات — واجهة العميل.
//
// كل قيمة هنا تأتي من /growth/public/products و /growth/public/settings.
// لا سعر ولا رقم واتساب ولا تعليمات دفع مكتوبة في هذا الملف: ما يعدّله
// المشغّل من اللوحة يظهر هنا في التحميل التالي مباشرة.
//
// هذا الملف واجهة فقط. نداءات الـ API ومنطق الطلب والكوبون كما هي، والتغيير
// كله في العرض: صفحة موبايل أولاً بورقة أنماط خاصّة بها (packages.module.css)
// لا يستوردها أي مكوّن آخر، فلا تتأثر بقيّة صفحات الموقع.

import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import s from './packages.module.css'
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

/** أرقام لاتينية بفاصلة آلاف — أوضح للقراءة في سياق التسعير. */
const fmt = (v) => Number(v || 0).toLocaleString('ar-SA-u-nu-latn', { maximumFractionDigits: 2 })

// ── أيقونات خطيّة، بلا اعتماديات جديدة ──────────────────────────────────────
const I = {
  spark: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v3M12 18v3M4.2 7.2l2.1 2.1M17.7 14.7l2.1 2.1M3 12h3M18 12h3M4.2 16.8l2.1-2.1M17.7 9.3l2.1-2.1" /><circle cx="12" cy="12" r="3.2" /></svg>,
  wallet: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8.5A2.5 2.5 0 0 1 5.5 6H18a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z" /><path d="M3 8.5V7a2 2 0 0 1 2-2h11" /><path d="M21 11.5h-3.5a2.25 2.25 0 0 0 0 4.5H21" /></svg>,
  coin: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8.5" /><path d="M12 8.2v7.6M8.4 12h7.2" /></svg>,
  shield: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 2.8V11c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V5.8z" /><path d="M9 12.2l2.1 2.1L15.2 10" /></svg>,
  bolt: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M13.5 3 5.8 13.2h5.1L10.4 21l7.8-10.3h-5.2z" /></svg>,
  layers: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3.2 21 8l-9 4.8L3 8z" /><path d="M3.4 12.4 12 17l8.6-4.6" /><path d="M3.4 16.4 12 21l8.6-4.6" /></svg>,
  support: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 13v-1a8 8 0 0 1 16 0v1" /><path d="M4 13h1.6A1.4 1.4 0 0 1 7 14.4v2.7a1.4 1.4 0 0 1-1.4 1.4H4.9A1.9 1.9 0 0 1 3 16.6v-1.7A1.9 1.9 0 0 1 4.9 13z" /><path d="M20 13h-1.6a1.4 1.4 0 0 0-1.4 1.4v2.7a1.4 1.4 0 0 0 1.4 1.4h.7a1.9 1.9 0 0 0 1.9-1.9v-1.7a1.9 1.9 0 0 0-1.9-1.9z" /><path d="M19 19v.4a2.6 2.6 0 0 1-2.6 2.6H13" /></svg>,
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 12.5 9.5 17.5 19.5 6.5" /></svg>,
  chevronDown: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>,
  arrow: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>,
  refresh: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M20 11.5A8 8 0 1 0 18 17" /><path d="M20 5.5V12h-6.5" /></svg>,
  alert: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.2M12 16.4h.01" /></svg>,
  box: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 7.8 12 3.5l8.5 4.3v8.4L12 20.5l-8.5-4.3z" /><path d="M3.5 7.8 12 12.1l8.5-4.3M12 12.1v8.4" /></svg>,
  info: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 11v5.2M12 7.8h.01" /></svg>,
  x: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M7 7l10 10M17 7 7 17" /></svg>,
  repeat: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9V7.5A2.5 2.5 0 0 1 6.5 5H18l-2.4-2.4M20 15v1.5a2.5 2.5 0 0 1-2.5 2.5H6l2.4 2.4" /></svg>,
  star: <svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 3.6 2.5 5.1 5.6.8-4 4 .9 5.6L12 16.4l-5 2.7.9-5.6-4-4 5.6-.8z" /></svg>,
  wa: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.2-1.7-.9-2-1-.3-.1-.4-.1-.6.1-.2.3-.7.9-.8 1.1-.2.2-.3.2-.6.1-.3-.2-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.5-.5c.1-.2.2-.3.3-.5 0-.2 0-.4-.1-.5 0-.2-.6-1.6-.9-2.1-.2-.5-.4-.5-.6-.5h-.5c-.2 0-.5.1-.7.3-.2.3-.9 1-.9 2.4 0 1.4 1 2.7 1.2 2.9.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 1.9-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.3z" /><path d="M12 2.2A9.8 9.8 0 0 0 3.6 17L2.3 21.7l4.9-1.3A9.8 9.8 0 1 0 12 2.2m0 1.9a7.9 7.9 0 0 1 6.6 12.2l-.3.4.6 2.2-2.3-.6-.4.2A7.9 7.9 0 1 1 12 4.1" /></svg>,
}

/**
 * أعلى قيمة رصيد داخل مجموعة — رصيد لكل وحدة عملة. حقيقة محسوبة من
 * البيانات نفسها، لا ادّعاء: تُعاد فقط عند وجود فائز وحيد بفارق واضح.
 *
 * المقارنة تجري داخل العملة الواحدة فقط. سعر بالريال وآخر بالريال اليمني
 * رقمان لا يُقسَم أحدهما على الآخر، فقسمتهما تنتج «فائزاً» لا معنى له.
 * وإن تعادلت مجموعتا عملة في العدد فلا فائز — فلا نرجّح إحداهما بلا سبب.
 */
function bestValueId(list) {
  const eligible = list.filter((p) => Number(p.price) > 0 && Number(p.credits_granted) > 0)

  const byCurrency = new Map()
  eligible.forEach((p) => {
    const key = p.currency || ''
    byCurrency.set(key, [...(byCurrency.get(key) || []), p])
  })

  const groups = [...byCurrency.values()].sort((a, b) => b.length - a.length)
  const main = groups[0]
  if (!main || main.length < 2) return null
  if (groups[1] && groups[1].length === main.length) return null

  const ratio = (p) => Number(p.credits_granted) / Number(p.price)
  const ranked = [...main].sort((a, b) => ratio(b) - ratio(a))
  return ratio(ranked[0]) > ratio(ranked[1]) ? ranked[0].id : null
}

/** الاشتراكات تُقارن فقط حين تتشارك الدورة نفسها — وإلّا فالمقارنة مضلّلة. */
function subscriptionBestId(list) {
  const cycles = new Set(list.map((p) => p.billing_cycle))
  return cycles.size === 1 ? bestValueId(list) : null
}

function Skeleton() {
  return (
    <div className={s.skelWrap}>
      <div className={`${s.skel} ${s.skelHero}`} />
      <div className={s.shell}>
        <div className={`${s.skel} ${s.skelBalance}`} />
        <div className={s.section}>
          <div className={s.sectionHead}>
            <div className={`${s.skel} ${s.skelLine}`} style={{ width: '180px' }} />
            <div className={`${s.skel} ${s.skelLine}`} style={{ width: '260px', maxWidth: '80%' }} />
          </div>
          <div className={s.grid}>
            <div className={`${s.skel} ${s.skelCard}`} />
            <div className={`${s.skel} ${s.skelCard}`} />
            <div className={`${s.skel} ${s.skelCard}`} />
          </div>
        </div>
      </div>
    </div>
  )
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
  const [placed, setPlaced] = useState(null)

  const packsRef = useRef(null)
  const plansRef = useRef(null)
  const doneRef = useRef(false)

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

  // منع تمرير الخلفية أسفل الورقة السفلية على الجوال، ثم إعادته كما كان.
  useEffect(() => {
    if (!selected) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [selected])

  // الانتقال بعد النجاح: نفس الوجهة ونفس التنبيه، بعد لحظة تأكيد قصيرة.
  const finish = useCallback((reference) => {
    if (doneRef.current) return
    doneRef.current = true
    navigate('/my-account', { state: { newOrder: reference } })
    toast('تم إنشاء الطلب — أكمل التحويل ثم أرفق الإيصال', 'success')
  }, [navigate])

  useEffect(() => {
    if (!placed) return undefined
    const id = setTimeout(() => finish(placed), 1500)
    return () => clearTimeout(id)
  }, [placed, finish])

  const placeOrder = async () => {
    if (!isLoggedIn) { navigate('/login'); return }
    setPlacing(true)
    try {
      const res = await api.placeOrder({
        product_id: selected.id,
        coupon_code: couponState?.valid ? couponCode.trim() : undefined,
      })
      setPlaced(res.order.reference)
    } catch (e) {
      toast(e.message, 'error')
    } finally { setPlacing(false) }
  }

  const openOrder = (p) => { setSelected(p); setCouponCode(''); setCouponState(null) }
  const closeOrder = () => { if (!placing && !placed) setSelected(null) }

  const scrollTo = (ref) => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const waLink = settings['support.whatsapp_number']
    ? `https://wa.me/${settings['support.whatsapp_number']}?text=${
      encodeURIComponent(settings['support.whatsapp_message'] || '')}`
    : null

  if (loading) {
    return (
      <div className={s.page} dir="rtl" lang="ar">
        <Skeleton />
      </div>
    )
  }

  if (error) {
    return (
      <div className={s.page} dir="rtl" lang="ar">
        <div className={s.shell}>
          <div className={s.section}>
            <div className={s.errorBox}>
              <div className={`${s.stateIcon} ${s.stateIconWarn}`}>{I.alert}</div>
              <h2 className={s.stateTitle}>تعذّر تحميل الباقات</h2>
              <p className={s.stateText}>
                لم نتمكّن من الوصول إلى الخادم الآن. تحقّق من اتصالك ثم أعد المحاولة.
              </p>
              <div className={s.stateActions}>
                <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={load}>
                  {I.refresh}
                  إعادة المحاولة
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const plans = products.filter((p) => p.kind === 'subscription')
  const packs = products.filter((p) => p.kind === 'credit_pack')
  const bestPlanId = subscriptionBestId(plans)
  const bestPackId = bestValueId(packs)

  const price = selected ? Number(selected.price) : 0
  const discount = couponState?.valid ? Number(couponState.discount || 0) : 0
  const net = Math.max(0, price - discount)

  const benefits = [
    { icon: I.bolt, title: 'سهولة الشحن', text: 'اختر الباقة وأنشئ طلبك في خطوات قليلة.' },
    { icon: I.layers, title: 'تجربة رقمية', text: 'الطلب وإرفاق الإيصال ومتابعة الرصيد من جهازك.' },
    { icon: I.coin, title: 'وصول سريع للخدمات', text: 'رصيدك يظهر في حسابك وتستخدمه في خدمات المنصة.' },
    waLink
      ? { icon: I.support, title: 'دعم ومساعدة', text: 'تواصل معنا عند أي استفسار حول الباقات.' }
      : { icon: I.shield, title: 'طلبات موثّقة', text: 'لكل طلب رقم مرجعي تتابعه من صفحة حسابي.' },
  ]

  const renderCard = (p, { featured, pack }) => (
    <article key={p.id} className={`${s.card} ${featured ? s.cardFeatured : ''}`}>
      {featured && (
        <span className={s.ribbon}>
          {I.star}
          أعلى قيمة للرصيد
        </span>
      )}

      <div className={s.cardHead}>
        <span className={s.cardIcon}>{pack ? I.coin : I.repeat}</span>
        <div>
          <h3 className={s.cardTitle}>{p.name}</h3>
          <div className={s.cardKind}>
            {pack ? 'حزمة رصيد · شراء لمرة واحدة' : `اشتراك · ${CYCLE[p.billing_cycle] || ''}`}
          </div>
        </div>
      </div>

      {p.description && <p className={s.cardDesc}>{p.description}</p>}

      <div className={s.priceBox}>
        <span className={s.price}>{fmt(p.price)}</span>
        <span className={s.currency}>{p.currency}</span>
        {!pack && p.billing_cycle && <span className={s.cycle}>/ {CYCLE[p.billing_cycle] || ''}</span>}
      </div>

      <div className={s.creditsRow}>
        {I.coin}
        <span>{fmt(p.credits_granted)} رصيد{pack ? '' : ' كل دورة'}</span>
      </div>

      {p.trial_days > 0 && (
        <span className={s.trialTag}>{I.spark} تجربة {fmt(p.trial_days)} يوماً</span>
      )}

      <ul className={s.features}>
        {Object.entries(p.features || {}).filter(([, on]) => on).map(([k]) => (
          <li key={k}>
            <span className={s.tick}>{I.check}</span>
            {FEATURE_LABELS[k] || k}
          </li>
        ))}
      </ul>

      <button
        type="button"
        className={`${s.btn} ${featured || !pack ? s.btnPrimary : s.btnSoft} ${s.btnBlock}`}
        onClick={() => openOrder(p)}
      >
        {pack ? 'شراء الباقة' : 'اشترك الآن'}
      </button>
    </article>
  )

  return (
    <div className={s.page} dir="rtl" lang="ar">
      {settings['ops.storefront_notice'] && (
        <div className={s.notice}>
          <span className={s.noticeDot} />
          <span>{settings['ops.storefront_notice']}</span>
        </div>
      )}

      {/* ══ الواجهة الرئيسية ══════════════════════════════════════════ */}
      <header className={s.hero}>
        <div className={s.heroArt}>
          <img
            className={s.heroImg}
            src="/images/packages-hero.svg"
            alt=""
            aria-hidden="true"
            width="1600"
            height="900"
            fetchPriority="high"
            decoding="async"
          />
        </div>

        <div className={s.heroCopy}>
          <span className={s.eyebrow}>{I.spark} الباقات والأرصدة</span>
          <h1 className={s.heroTitle}>اختر الباقة المناسبة لك</h1>
          <p className={s.heroSub}>
            اشحن رصيدك للوصول إلى خدمات المنصة بكل سهولة وأمان — ويمكنك الترقية
            أو شراء رصيد إضافي في أي وقت.
          </p>

          <div className={s.heroActions}>
            <button
              type="button"
              className={`${s.btn} ${s.btnPrimary}`}
              onClick={() => scrollTo(packs.length ? packsRef : plansRef)}
            >
              اشحن رصيدك الآن
              {I.chevronDown}
            </button>
            {plans.length > 0 && (
              <button
                type="button"
                className={`${s.btn} ${s.btnSoft}`}
                onClick={() => scrollTo(plansRef)}
              >
                تصفّح الاشتراكات
              </button>
            )}
          </div>

          <div className={s.trustRow}>
            <div className={s.trustItem}><span className={s.trustIcon}>{I.layers}</span>خدمات متعددة</div>
            <div className={s.trustItem}><span className={s.trustIcon}>{I.support}</span>دعم متخصص</div>
            <div className={s.trustItem}><span className={s.trustIcon}>{I.bolt}</span>سريعة وسهلة</div>
            <div className={s.trustItem}><span className={s.trustIcon}>{I.shield}</span>موثوقة وآمنة</div>
          </div>
        </div>
      </header>

      <div className={s.shell}>
        {/* ══ الرصيد الحالي ═══════════════════════════════════════════ */}
        {profile ? (
          <div className={s.balanceWrap}>
            <section className={s.balance}>
              <div className={s.balanceTop}>
                <span className={s.walletIcon}>{I.wallet}</span>
                <div>
                  <div className={s.balanceLabel}>رصيدك الحالي</div>
                  <div className={s.balanceValueRow}>
                    <span className={s.balanceValue}>{fmt(profile.credit_balance)}</span>
                    <span className={s.balanceUnit}>رصيد</span>
                  </div>
                </div>
              </div>

              <div className={s.balanceMeta}>
                {profile.current_product && (
                  <span className={s.metaChip}>{profile.current_product.name}</span>
                )}
                {profile.subscription_status === 'active' && (
                  <span className={`${s.metaChip} ${s.metaChipOk}`}>اشتراك نشط</span>
                )}
                <Link className={s.balanceLink} to="/my-account">
                  تفاصيل حسابي
                  {I.arrow}
                </Link>
              </div>
            </section>
          </div>
        ) : !isLoggedIn ? (
          <div className={s.balanceWrap}>
            <section className={s.balanceGuest}>
              <span className={s.balanceGuestIcon}>{I.wallet}</span>
              <div className={s.balanceGuestText}>
                <div className={s.balanceGuestTitle}>سجّل الدخول لعرض رصيدك</div>
                <div className={s.balanceGuestSub}>يمكنك تصفّح الباقات الآن، وتسجيل الدخول عند إتمام الطلب.</div>
              </div>
              <Link className={`${s.btn} ${s.btnSoft} ${s.balanceGuestBtn}`} to="/login">تسجيل الدخول</Link>
            </section>
          </div>
        ) : null}

        {/* ══ الباقات ═════════════════════════════════════════════════ */}
        {products.length === 0 ? (
          <div className={s.section}>
            <div className={s.empty}>
              <div className={s.stateIcon}>{I.box}</div>
              <h2 className={s.stateTitle}>لا توجد باقات متاحة حالياً</h2>
              <p className={s.stateText}>سيتم عرض الباقات هنا فور إتاحتها.</p>
              {waLink && (
                <div className={s.stateActions}>
                  <a className={`${s.btn} ${s.btnPrimary}`} href={waLink} target="_blank" rel="noreferrer">
                    {I.wa}
                    تواصل معنا
                  </a>
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            {plans.length > 0 && (
              <section className={s.section} ref={plansRef}>
                <div className={s.sectionHead}>
                  <span className={s.sectionKicker}>الاشتراكات</span>
                  <h2 className={s.sectionTitle}>باقات متجدّدة</h2>
                  <p className={s.sectionSub}>
                    رصيد يتجدّد مع كل دورة، مع المزايا المفعّلة في كل باقة.
                  </p>
                </div>
                <div className={s.grid}>
                  {plans.map((p) => renderCard(p, { featured: p.id === bestPlanId, pack: false }))}
                </div>
              </section>
            )}

            {packs.length > 0 && (
              <section className={s.section} ref={packsRef}>
                <div className={s.sectionHead}>
                  <span className={s.sectionKicker}>حزم الرصيد</span>
                  <h2 className={s.sectionTitle}>اشحن رصيدك</h2>
                  <p className={s.sectionSub}>
                    شراء لمرة واحدة، بلا تجديد. تُضاف إلى رصيدك ولا تنتهي صلاحيتها.
                  </p>
                </div>
                <div className={s.grid}>
                  {packs.map((p) => renderCard(p, { featured: p.id === bestPackId, pack: true }))}
                </div>
              </section>
            )}

            {/* ══ المزايا ═══════════════════════════════════════════════ */}
            <section className={s.section}>
              <div className={s.sectionHead}>
                <span className={s.sectionKicker}>لماذا الباقات</span>
                <h2 className={s.sectionTitle}>تجربة شحن واضحة من البداية للنهاية</h2>
              </div>
              <div className={s.benefits}>
                {benefits.map((b) => (
                  <div className={s.benefit} key={b.title}>
                    <span className={s.benefitIcon}>{b.icon}</span>
                    <div className={s.benefitTitle}>{b.title}</div>
                    <div className={s.benefitText}>{b.text}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* ══ نداء الختام ═══════════════════════════════════════════ */}
            <section className={s.finalCta}>
              <h2 className={s.finalTitle}>جاهز لشحن رصيدك؟</h2>
              <p className={s.finalText}>
                اختر الباقة التي تناسبك وأنشئ طلبك الآن — وتابع رصيدك وطلباتك من صفحة حسابي.
              </p>
              <div className={s.finalActions}>
                <button
                  type="button"
                  className={`${s.btn} ${s.btnOnDark}`}
                  onClick={() => scrollTo(packs.length ? packsRef : plansRef)}
                >
                  اشحن رصيدك الآن
                </button>
                {waLink && (
                  <a
                    className={`${s.btn} ${s.btnOnDarkGhost}`}
                    href={waLink}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {I.wa}
                    تواصل معنا
                  </a>
                )}
              </div>
            </section>
          </>
        )}
      </div>

      {waLink && (
        <a className={s.waFloat} href={waLink} target="_blank" rel="noreferrer"
          aria-label="تواصل عبر واتساب" title="تواصل عبر واتساب">{I.wa}</a>
      )}

      {/* ══ نافذة تأكيد الطلب ═══════════════════════════════════════════ */}
      {selected && (
        <div
          className={s.overlay}
          role="dialog"
          aria-modal="true"
          aria-label="تأكيد الطلب"
          onMouseDown={(e) => { if (e.target === e.currentTarget) closeOrder() }}
        >
          <div className={s.modal}>
            <div className={s.grabber} />

            {placed ? (
              <div className={s.successPane}>
                <div className={s.successMark}>{I.check}</div>
                <h3 className={s.successTitle}>تم إنشاء طلبك</h3>
                <p className={s.successText}>
                  أكمل التحويل ثم أرفق الإيصال من صفحة حسابي لتفعيل الرصيد.
                </p>
                <div className={s.successRef}>{placed}</div>
                <button
                  type="button"
                  className={`${s.btn} ${s.btnPrimary} ${s.btnBlock}`}
                  onClick={() => finish(placed)}
                >
                  المتابعة إلى حسابي
                </button>
              </div>
            ) : (
              <>
                <header className={s.modalHead}>
                  <h3 className={s.modalTitle}>تأكيد الطلب</h3>
                  <button type="button" className={s.close} onClick={closeOrder} aria-label="إغلاق">
                    {I.x}
                  </button>
                </header>

                <div className={s.modalBody}>
                  <div className={s.summary}>
                    <div className={s.summaryRow}>
                      <span>{selected.name}</span>
                      <span>{fmt(price)} {selected.currency}</span>
                    </div>
                    {discount > 0 && (
                      <div className={`${s.summaryRow} ${s.discountRow}`}>
                        <span>خصم الكوبون</span>
                        <span>− {fmt(discount)} {selected.currency}</span>
                      </div>
                    )}
                    <div className={`${s.summaryRow} ${s.totalRow}`}>
                      <span>الإجمالي</span>
                      <span>{fmt(net)} {selected.currency}</span>
                    </div>
                    <div className={s.summaryNote}>
                      {I.coin}
                      <span>
                        ستحصل على {fmt(selected.credits_granted)} رصيد
                        {couponState?.valid && couponState.credits_granted > 0
                          && ` + ${fmt(couponState.credits_granted)} رصيد من الكوبون`}
                      </span>
                    </div>
                  </div>

                  <label className={s.label} htmlFor="pkCoupon">كوبون خصم (اختياري)</label>
                  <input
                    id="pkCoupon"
                    className={s.input}
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="أدخل الرمز"
                    autoComplete="off"
                    inputMode="text"
                  />
                  {couponState && (
                    <div className={`${s.couponMsg} ${couponState.valid ? s.couponOk : s.couponBad}`}>
                      {couponState.valid ? I.check : I.alert}
                      <span>
                        {couponState.valid
                          ? `خصم ${fmt(couponState.discount)} ${selected.currency}`
                          : couponState.reason}
                      </span>
                    </div>
                  )}

                  {!isLoggedIn && (
                    <div className={s.infoBox}>
                      {I.info}
                      <span>تحتاج تسجيل الدخول لإتمام الطلب.</span>
                    </div>
                  )}
                </div>

                <footer className={s.modalFoot}>
                  <button
                    type="button"
                    className={`${s.btn} ${s.btnPrimary}`}
                    onClick={placeOrder}
                    disabled={placing}
                  >
                    {placing ? <><span className={s.spinner} /> جارٍ الإنشاء…</>
                      : isLoggedIn ? 'إنشاء الطلب' : 'تسجيل الدخول'}
                  </button>
                  <button
                    type="button"
                    className={`${s.btn} ${s.btnGhost}`}
                    onClick={closeOrder}
                    disabled={placing}
                  >
                    إلغاء
                  </button>
                </footer>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
