// تعمّق المستخدم — كل ما يخصّ شخصاً واحداً في شاشة واحدة.
//
// هذه الشاشة سدّت أكبر فجوة في التصميم الأول: وكيل الدعم كان يقفز بين خمس
// صفحات ليجيب عن «كم رصيده؟ ماذا اشترى؟ من أحاله؟».

import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import s from '../console.module.css'
import { api, toast } from '../api'
import {
  Panel, Loading, ErrorBox, Empty, Badge, Modal, Field, Funnel,
  useAsync, fmtMoney, fmtNum, fmtDateTime,
} from '../components/ui'

const TX_TYPE = {
  grant: 'منحة', debit: 'خصم', refund: 'استرداد',
  adjustment: 'تعديل إداري', expiry: 'انتهاء', reversal: 'عكس',
}

const ORDER_STATUS = {
  awaiting_payment: { label: 'بانتظار الدفع', tone: 'amber' },
  paid: { label: 'مدفوع', tone: 'green' },
  refunded: { label: 'مسترَد', tone: 'red' },
  cancelled: { label: 'ملغى', tone: 'gray' },
  pending: { label: 'قيد المعالجة', tone: 'gray' },
}

export default function MemberProfile({ can }) {
  const { userId } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [adjusting, setAdjusting] = useState(false)
  const [adjustForm, setAdjustForm] = useState({ amount: '', direction: 'grant', reason: '' })

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setData(await api.memberProfile(userId)) } catch (e) { setError(e) } finally { setLoading(false) }
  }, [userId])

  useEffect(() => { load() }, [load])

  const [doAdjust, adjustBusy] = useAsync(async () => {
    try {
      const r = await api.adjustCredits({
        user_id: Number(userId),
        amount: parseInt(adjustForm.amount, 10),
        direction: adjustForm.direction,
        reason: adjustForm.reason,
        client_key: `profile-${userId}-${Date.now()}`,
      })
      toast(`تم — الرصيد الجديد ${fmtNum(r.balance)}`, 'success')
      setAdjusting(false); setAdjustForm({ amount: '', direction: 'grant', reason: '' })
      load()
    } catch (e) { toast(e.message, 'error') }
  })

  if (loading) return <Loading />
  if (error) return <ErrorBox error={error} onRetry={load} />
  if (!data) return null

  const { user, profile, credit, funnel, ledger, orders, referral, reward_grants: grants } = data
  const blocked = !adjustForm.amount || parseInt(adjustForm.amount, 10) <= 0
    || adjustForm.reason.trim().length < 3

  return (
    <>
      <div className={s.pageHead}>
        <div>
          <h1 className={s.pageTitle}>{user.name}</h1>
          <p className={s.pageSub}>
            {user.email} · مسجَّل منذ {fmtDateTime(user.createdAt)}
            {user.role === 'admin' && <Badge tone="blue">مدير النظام</Badge>}
          </p>
        </div>
        <div className={s.pageActions}>
          {can('credits:adjust') && (
            <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={() => setAdjusting(true)}>
              تعديل الرصيد
            </button>
          )}
          <button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={load}>تحديث</button>
        </div>
      </div>

      <div className={s.statGrid}>
        <div className={s.stat}>
          <div className={s.statLabel}>الرصيد الحالي</div>
          <div className={s.statValue}>{fmtNum(credit.balance)}</div>
          {credit.reward_debt > 0 && (
            <div className={s.statFoot}>
              <Badge tone="red">دين {fmtNum(credit.reward_debt)}</Badge> يُخصم من المنح القادمة
            </div>
          )}
        </div>
        <div className={s.stat}>
          <div className={s.statLabel}>مكتسب / مستهلك</div>
          <div className={s.statValue} style={{ fontSize: '1.15rem' }}>
            {fmtNum(credit.earned)} / {fmtNum(credit.spent)}
          </div>
        </div>
        <div className={s.stat}>
          <div className={s.statLabel}>الاشتراك</div>
          <div className={s.statValue} style={{ fontSize: '1.05rem' }}>
            {profile.subscription_status === 'active' ? (
              <Badge tone="green">فعّال</Badge>
            ) : <Badge tone="gray">لا يوجد</Badge>}
          </div>
          {data.current_product && (
            <div className={s.statFoot}>{data.current_product.name}</div>
          )}
        </div>
        <div className={s.stat}>
          <div className={s.statLabel}>مستندات صادرة</div>
          <div className={s.statValue}>{fmtNum(funnel.documents_created)}</div>
        </div>
        <div className={s.stat}>
          <div className={s.statLabel}>رمز الإحالة</div>
          <div className={s.statValue} style={{ fontSize: '1.05rem', fontFamily: 'monospace' }}>
            {profile.personal_referral_code}
          </div>
          <div className={s.statFoot}>{fmtNum(referral.activated_referrals)} إحالة مفعَّلة</div>
        </div>
      </div>

      <Panel title="مسار المستخدم">
        <Funnel stages={[
          { key: 'reg', label: 'التسجيل', value: 1 },
          { key: 'ver', label: 'التوثيق', value: funnel.verified_at ? 1 : 0 },
          { key: 'act', label: 'التفعيل', value: funnel.activated_at ? 1 : 0 },
          { key: 'paid', label: 'أول دفع', value: funnel.first_paid_at ? 1 : 0 },
        ]} />
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginTop: '0.9rem', fontSize: '0.8rem', color: '#64748b' }}>
          <span>سجّل: {fmtDateTime(funnel.registered_at)}</span>
          <span>وُثّق: {fmtDateTime(funnel.verified_at)}</span>
          <span>فُعّل: {fmtDateTime(funnel.activated_at)}</span>
          <span>أول دفع: {fmtDateTime(funnel.first_paid_at)}</span>
          <span>آخر نشاط: {fmtDateTime(funnel.last_active_at)}</span>
        </div>
      </Panel>

      {referral.referred_by && (
        <Panel title="أُحيل بواسطة">
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <Link to={`/growth/members/${referral.referred_by.referrer_id}`}
              style={{ color: '#2563eb', fontWeight: 600 }}>
              {referral.referred_by.referrer?.name}
            </Link>
            <span className={s.mono} style={{ color: '#64748b' }}>
              {referral.referred_by.link?.code}
            </span>
            <Badge tone="blue">{referral.referred_by.stage_reached}</Badge>
            <Badge tone={referral.referred_by.risk_band === 'high' ? 'red'
              : referral.referred_by.risk_band === 'medium' ? 'amber' : 'green'}>
              مخاطر {referral.referred_by.fraud_score}
            </Badge>
          </div>
          {referral.referred_by.fraud_reasons?.length > 0 && (
            <div className={s.hint} style={{ marginTop: '0.5rem' }}>
              {referral.referred_by.fraud_reasons.join(' · ')}
            </div>
          )}
        </Panel>
      )}

      <Panel title="الطلبات" flush>
        {orders.length === 0 ? <Empty icon="🧾" title="لا طلبات" /> : (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr><th>المرجع</th><th>المنتج</th><th>الصافي</th><th>الأرصدة</th><th>الحالة</th><th>التاريخ</th></tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className={s.mono}>{o.reference}</td>
                    <td>{o.product_name_snapshot}</td>
                    <td className={s.num}>{fmtMoney(o.net_amount, o.currency)}</td>
                    <td className={s.num}>{fmtNum(o.credits_snapshot)}</td>
                    <td>
                      <Badge tone={ORDER_STATUS[o.status]?.tone}>
                        {ORDER_STATUS[o.status]?.label || o.status}
                      </Badge>
                    </td>
                    <td style={{ fontSize: '0.76rem' }}>{fmtDateTime(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="دفتر الأرصدة (آخر 50 حركة)" flush>
        {ledger.length === 0 ? <Empty icon="💳" title="لا حركات" /> : (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr><th>النوع</th><th>المبلغ</th><th>قبل</th><th>بعد</th><th>الوصف</th><th>المنفّذ</th><th>التاريخ</th></tr>
              </thead>
              <tbody>
                {ledger.map((t) => (
                  <tr key={t.id}>
                    <td style={{ fontSize: '0.8rem' }}>{TX_TYPE[t.type] || t.type}</td>
                    <td className={s.num} style={{ color: t.amount >= 0 ? '#059669' : '#dc2626', fontWeight: 600 }}>
                      {t.amount >= 0 ? '+' : ''}{fmtNum(t.amount)}
                    </td>
                    <td className={s.num} style={{ color: '#94a3b8' }}>{fmtNum(t.balance_before)}</td>
                    <td className={s.num} style={{ fontWeight: 600 }}>{fmtNum(t.balance_after)}</td>
                    <td style={{ fontSize: '0.76rem', maxWidth: 220 }}>
                      {t.description}
                      {t.reason && <div style={{ color: '#94a3b8' }}>{t.reason}</div>}
                    </td>
                    <td style={{ fontSize: '0.76rem' }}>{t.actor?.name || '—'}</td>
                    <td style={{ fontSize: '0.74rem', color: '#64748b' }}>{fmtDateTime(t.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {grants.length > 0 && (
        <Panel title="المكافآت" flush>
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead><tr><th>المصدر</th><th>المرحلة</th><th>القيمة</th><th>الحالة</th><th>التاريخ</th></tr></thead>
              <tbody>
                {grants.map((g) => (
                  <tr key={g.id}>
                    <td style={{ fontSize: '0.8rem' }}>
                      {g.source_kind === 'referral_link' ? 'إحالة' : 'قاعدة مكافأة'}
                    </td>
                    <td style={{ fontSize: '0.78rem' }}>{g.milestone || '—'}</td>
                    <td className={s.num}>{fmtNum(g.value_snapshot)}</td>
                    <td>
                      <Badge tone={g.status === 'granted' ? 'green' : g.status === 'held' ? 'amber' : 'red'}>
                        {g.status === 'granted' ? 'ممنوحة' : g.status === 'held' ? 'معلّقة' : 'مُلغاة'}
                      </Badge>
                    </td>
                    <td style={{ fontSize: '0.76rem' }}>{fmtDateTime(g.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <Modal open={adjusting} title={`تعديل رصيد: ${user.name}`} onClose={() => setAdjusting(false)}
        footer={(
          <>
            <button type="button" className={`${s.btn} ${s.btnPrimary}`}
              onClick={doAdjust} disabled={blocked || adjustBusy}>
              {adjustBusy ? 'جارٍ التنفيذ…' : 'تنفيذ'}
            </button>
            <button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={() => setAdjusting(false)}>إلغاء</button>
          </>
        )}
      >
        <div className={s.warnBox}>
          الرصيد الحالي {fmtNum(credit.balance)}. العملية تُسجَّل في سجل التدقيق باسمك ولا يمكن حذفها.
        </div>
        <div className={s.formGrid}>
          <Field label="الاتجاه" required>
            <select className={s.select} value={adjustForm.direction}
              onChange={(e) => setAdjustForm({ ...adjustForm, direction: e.target.value })}>
              <option value="grant">إضافة</option>
              <option value="debit">خصم</option>
            </select>
          </Field>
          <Field label="المبلغ" required>
            <input className={s.input} type="number" min="1" value={adjustForm.amount}
              onChange={(e) => setAdjustForm({ ...adjustForm, amount: e.target.value })} />
          </Field>
          <Field label="السبب" required full>
            <textarea className={s.textarea} value={adjustForm.reason}
              onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </>
  )
}
