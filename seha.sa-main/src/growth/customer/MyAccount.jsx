// حسابي — الرصيد والطلبات وإثبات الدفع ورابط الإحالة.
//
// تعليمات التحويل وبيانات البنك ورقم واتساب كلها من إعدادات الخادم. تغييرها
// من اللوحة يظهر هنا فوراً، فلا يحتاج المشغّل مبرمجاً ليغيّر رقم حساب.

import { useState, useEffect, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import s from './customer.module.css'
import { api, toast } from '../api'

const STATUS = {
  awaiting_payment: { label: 'بانتظار الدفع', cls: 'badgeAmber' },
  pending: { label: 'قيد المعالجة', cls: 'badgeGray' },
  paid: { label: 'مدفوع', cls: 'badgeGreen' },
  refunded: { label: 'مسترَد', cls: 'badgeRed' },
  cancelled: { label: 'ملغى', cls: 'badgeGray' },
}

const TX = {
  grant: 'إضافة', debit: 'استهلاك', refund: 'استرداد',
  adjustment: 'تعديل', expiry: 'انتهاء صلاحية', reversal: 'عكس',
}

const fmtDate = (v) => (v
  ? new Date(v).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' })
  : '—')

export default function MyAccount() {
  const location = useLocation()
  const [tab, setTab] = useState('overview')
  const [credits, setCredits] = useState(null)
  const [orders, setOrders] = useState([])
  const [referral, setReferral] = useState(null)
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [payingFor, setPayingFor] = useState(null)
  const [proof, setProof] = useState({ payment_reference: '', note: '' })
  const [submitting, setSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)

  const highlight = location.state?.newOrder

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [c, o, cfg] = await Promise.all([
        api.myCredits(), api.myOrders(), api.publicSettings(),
      ])
      setCredits(c); setOrders(o); setSettings(cfg)
      try { setReferral(await api.myReferral()) } catch { setReferral(null) }
    } catch (e) { setError(e) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const submitProof = async () => {
    setSubmitting(true)
    try {
      await api.submitPaymentProof(payingFor.id, proof)
      toast('تم استلام إثبات الدفع، سيراجعه فريقنا', 'success')
      setPayingFor(null); setProof({ payment_reference: '', note: '' })
      load()
    } catch (e) { toast(e.message, 'error') } finally { setSubmitting(false) }
  }

  // الشرط على وجود رابط فعلي لا على وجود رمز: الخادم يُرجع الرمز الشخصي حتى
  // حين لا يكون البرنامج مفعّلاً، فكان التبويب يعرض رابطاً يردّ «غير صالح».
  const hasProgram = Boolean(referral?.payout_schedule)
  const referralUrl = hasProgram
    ? `${window.location.origin}/r/${referral.code}`
    : null

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralUrl)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    } catch { toast('انسخ الرابط يدوياً', 'error') }
  }

  const waLink = settings['support.whatsapp_number']
    ? `https://wa.me/${settings['support.whatsapp_number']}`
    : null

  if (loading) return <div className={s.loading}>جارٍ التحميل…</div>
  if (error) {
    return (
      <div className={s.page}>
        <div className={s.errorBox}>
          تعذّر تحميل بياناتك.
          <button type="button" className={s.btnGhost} onClick={load}>إعادة المحاولة</button>
        </div>
      </div>
    )
  }

  const pending = orders.filter((o) => o.status === 'awaiting_payment')

  return (
    <div className={s.page}>
      <header className={s.head}>
        <h1 className={s.title}>حسابي</h1>
      </header>

      <div className={s.statRow}>
        <div className={s.statCard}>
          <div className={s.statLabel}>الرصيد المتاح</div>
          <div className={s.statValue}>{Number(credits?.credit_balance || 0).toLocaleString('ar')}</div>
        </div>
        <div className={s.statCard}>
          <div className={s.statLabel}>إجمالي المستهلك</div>
          <div className={s.statValue}>
            {Number(credits?.lifetime_credits_spent || 0).toLocaleString('ar')}
          </div>
        </div>
        {credits?.reward_debt > 0 && (
          <div className={`${s.statCard} ${s.statWarn}`}>
            <div className={s.statLabel}>دين مكافآت</div>
            <div className={s.statValue}>{Number(credits.reward_debt).toLocaleString('ar')}</div>
            <div className={s.statFoot}>يُخصم من إضافاتك القادمة</div>
          </div>
        )}
      </div>

      {pending.length > 0 && (
        <div className={s.notice}>
          لديك {pending.length} طلب بانتظار الدفع. أكمل التحويل ثم أرفق الإيصال ليُفعّل رصيدك.
        </div>
      )}

      <div className={s.tabs}>
        <button type="button" className={tab === 'overview' ? s.tabActive : s.tab}
          onClick={() => setTab('overview')}>الطلبات</button>
        <button type="button" className={tab === 'credits' ? s.tabActive : s.tab}
          onClick={() => setTab('credits')}>سجل الرصيد</button>
        {hasProgram && (
          <button type="button" className={tab === 'referral' ? s.tabActive : s.tab}
            onClick={() => setTab('referral')}>ادعُ زملاءك</button>
        )}
      </div>

      {tab === 'overview' && (
        orders.length === 0 ? (
          <div className={s.empty}>
            <div className={s.emptyIcon}>🧾</div>
            <p>لا توجد طلبات بعد.</p>
            <a className={s.btnPrimary} href="/packages">تصفّح الباقات</a>
          </div>
        ) : (
          <div className={s.list}>
            {orders.map((o) => (
              <article key={o.id}
                className={`${s.orderCard} ${o.reference === highlight ? s.orderNew : ''}`}>
                <div className={s.orderTop}>
                  <div>
                    <div className={s.orderName}>{o.product_name_snapshot}</div>
                    <div className={s.orderRef}>{o.reference} · {fmtDate(o.createdAt)}</div>
                  </div>
                  <span className={`${s.badge} ${s[STATUS[o.status]?.cls]}`}>
                    {STATUS[o.status]?.label || o.status}
                  </span>
                </div>

                <div className={s.orderBody}>
                  <span>{Number(o.net_amount).toLocaleString('ar')} {o.currency}</span>
                  <span>·</span>
                  <span>{Number(o.credits_snapshot).toLocaleString('ar')} رصيد</span>
                  {Number(o.discount_amount) > 0 && (
                    <>
                      <span>·</span>
                      <span className={s.discountText}>
                        خصم {Number(o.discount_amount).toLocaleString('ar')}
                        {o.coupon_code_snapshot && ` (${o.coupon_code_snapshot})`}
                      </span>
                    </>
                  )}
                </div>

                {o.status === 'awaiting_payment' && (
                  <div className={s.payBlock}>
                    {settings['payment.instructions_ar'] && (
                      <p className={s.payInstructions}>{settings['payment.instructions_ar']}</p>
                    )}
                    <dl className={s.bankGrid}>
                      {settings['payment.bank_name'] && (
                        <><dt>البنك</dt><dd>{settings['payment.bank_name']}</dd></>
                      )}
                      {settings['payment.bank_account_name'] && (
                        <><dt>اسم الحساب</dt><dd>{settings['payment.bank_account_name']}</dd></>
                      )}
                      {settings['payment.bank_iban'] && (
                        <><dt>الآيبان</dt><dd className={s.mono}>{settings['payment.bank_iban']}</dd></>
                      )}
                    </dl>
                    <div className={s.payActions}>
                      <button type="button" className={s.btnPrimary}
                        onClick={() => {
                          setPayingFor(o)
                          setProof({ payment_reference: o.payment_reference || '', note: '' })
                        }}>
                        {o.payment_reference ? 'تحديث الإيصال' : 'أرفقت الحوالة'}
                      </button>
                      {waLink && (
                        <a className={s.btnGhost} href={waLink} target="_blank" rel="noreferrer">
                          استفسار عبر واتساب
                        </a>
                      )}
                    </div>
                    {o.payment_reference && (
                      <div className={s.proofNote}>مرجع مُرسَل: {o.payment_reference}</div>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        )
      )}

      {tab === 'credits' && (
        credits?.recent?.length ? (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead><tr><th>العملية</th><th>المقدار</th><th>الرصيد بعدها</th><th>التاريخ</th></tr></thead>
              <tbody>
                {credits.recent.map((t) => (
                  <tr key={t.id}>
                    <td>
                      {TX[t.type] || t.type}
                      {t.description && <div className={s.txDesc}>{t.description}</div>}
                    </td>
                    <td className={t.amount >= 0 ? s.amountUp : s.amountDown}>
                      {t.amount >= 0 ? '+' : ''}{Number(t.amount).toLocaleString('ar')}
                    </td>
                    <td>{Number(t.balance_after).toLocaleString('ar')}</td>
                    <td className={s.dim}>{fmtDate(t.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={s.empty}>
            <div className={s.emptyIcon}>💳</div>
            <p>لا حركات رصيد بعد.</p>
          </div>
        )
      )}

      {tab === 'referral' && hasProgram && (
        <div className={s.referralBox}>
          <h2 className={s.sectionTitle}>ادعُ زملاءك</h2>
          <p className={s.sectionSub}>
            شارك رابطك. حين يبدأ من يسجّل عبره باستخدام المنصة فعلياً، تصلك أرصدة تلقائياً.
          </p>

          <div className={s.linkRow}>
            <input className={s.input} readOnly value={referralUrl} onFocus={(e) => e.target.select()} />
            <button type="button" className={s.btnPrimary} onClick={copyLink}>
              {copied ? '✓ نُسخ' : 'نسخ الرابط'}
            </button>
          </div>

          {waLink && (
            <a className={s.btnGhost}
              href={`https://wa.me/?text=${encodeURIComponent(`جرّب منصة صحة: ${referralUrl}`)}`}
              target="_blank" rel="noreferrer">
              مشاركة عبر واتساب
            </a>
          )}

          <div className={s.statRow} style={{ marginTop: '1.25rem' }}>
            <div className={s.statCard}>
              <div className={s.statLabel}>نقرات</div>
              <div className={s.statValue}>{Number(referral.stats?.clicks || 0).toLocaleString('ar')}</div>
            </div>
            <div className={s.statCard}>
              <div className={s.statLabel}>بدأوا الاستخدام</div>
              <div className={s.statValue}>{Number(referral.stats?.activated || 0).toLocaleString('ar')}</div>
            </div>
            <div className={s.statCard}>
              <div className={s.statLabel}>أرصدة مكتسبة</div>
              <div className={s.statValue}>{Number(referral.stats?.credits_earned || 0).toLocaleString('ar')}</div>
            </div>
          </div>

          {referral.payout_schedule?.length > 0 && (
            <div className={s.rewardTable}>
              <div className={s.rewardTitle}>متى تصلك المكافأة</div>
              {referral.payout_schedule.filter((p) => p.party === 'referrer' && p.amount > 0).map((p, i) => (
                <div key={i} className={s.rewardRow}>
                  <span>
                    {{
                      verified: 'عند توثيق حسابه',
                      activated: 'عند إصدار أول مستند له',
                      meaningful_action: 'عند استخدامه المتكرّر',
                      first_purchase: 'عند أول اشتراك له',
                    }[p.milestone] || p.milestone}
                  </span>
                  <strong>{Number(p.amount).toLocaleString('ar')} رصيد</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {payingFor && (
        <div className={s.overlay} onMouseDown={(e) => {
          if (e.target === e.currentTarget && !submitting) setPayingFor(null)
        }}>
          <div className={s.modal}>
            <header className={s.modalHead}>
              <h3>إثبات الدفع</h3>
              <button type="button" className={s.close} onClick={() => setPayingFor(null)}>×</button>
            </header>
            <div className={s.modalBody}>
              <div className={s.infoBox}>
                الطلب {payingFor.reference} — {Number(payingFor.net_amount).toLocaleString('ar')} {payingFor.currency}
              </div>
              <label className={s.label}>رقم الحوالة أو مرجع العملية</label>
              <input className={s.input} value={proof.payment_reference}
                onChange={(e) => setProof({ ...proof, payment_reference: e.target.value })}
                placeholder="مثال: TRX-88213" />
              <label className={s.label}>ملاحظة (اختياري)</label>
              <textarea className={s.textarea} value={proof.note}
                onChange={(e) => setProof({ ...proof, note: e.target.value })}
                placeholder="أي تفاصيل تساعد فريقنا على مطابقة الحوالة" />
            </div>
            <footer className={s.modalFoot}>
              <button type="button" className={s.btnPrimary} onClick={submitProof}
                disabled={submitting || !proof.payment_reference.trim()}>
                {submitting ? 'جارٍ الإرسال…' : 'إرسال'}
              </button>
              <button type="button" className={s.btnGhost} onClick={() => setPayingFor(null)}>إلغاء</button>
            </footer>
          </div>
        </div>
      )}
    </div>
  )
}
