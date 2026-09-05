// الأرصدة — الدفتر والتعديل الإداري والمطابقة.
//
// التعديل الإداري يطلب سبباً ومفتاحاً ثابتاً: المفتاح يُولَّد عند فتح النموذج
// ويبقى ثابتاً عبر إعادات الإرسال، فإعادة المحاولة بعد انقطاع شبكة لا تنشئ
// تعديلاً ثانياً.

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import s from '../console.module.css'
import { api, toast } from '../api'
import {
  Panel, Loading, ErrorBox, Empty, Badge, Modal, Field, Pagination,
  useAsync, fmtNum, fmtDateTime, Stat,
} from '../components/ui'

const TYPE = {
  grant: { label: 'منحة', tone: 'green' },
  debit: { label: 'خصم', tone: 'gray' },
  refund: { label: 'استرداد', tone: 'blue' },
  adjustment: { label: 'تعديل إداري', tone: 'amber' },
  expiry: { label: 'انتهاء صلاحية', tone: 'gray' },
  reversal: { label: 'عكس', tone: 'red' },
}

const SOURCE = {
  order: 'طلب', coupon: 'كوبون', referral_reward: 'مكافأة إحالة',
  referral_clawback: 'استرجاع إحالة', reward_rule: 'قاعدة مكافأة',
  admin_adjustment: 'تعديل إداري', service_usage: 'استخدام الخدمة',
  signup_bonus: 'رصيد ترحيبي', refund: 'استرداد', expiry: 'انتهاء صلاحية',
}

export default function Credits({ can }) {
  const [tab, setTab] = useState(() =>
    new URLSearchParams(window.location.search).get('tab') || 'ledger')
  const [data, setData] = useState({ transactions: [], pagination: {} })
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState({ type: '', source_type: '', user_id: '', page: 1 })

  const [lookupTerm, setLookupTerm] = useState('')
  const [lookupResults, setLookupResults] = useState([])
  const [adjustFor, setAdjustFor] = useState(null)
  const [adjustForm, setAdjustForm] = useState({ amount: '', direction: 'grant', reason: '' })
  const [reconcile, setReconcile] = useState(null)
  const [expiry, setExpiry] = useState(null)
  const [confirmSweep, setConfirmSweep] = useState(false)

  // مفتاح ثابت لكل فتح نموذج — يجعل إعادة الإرسال آمنة.
  const clientKey = useMemo(() => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, [adjustFor])

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [ledger, sum] = await Promise.all([api.ledger(filter), api.creditSummary(30)])
      setData(ledger); setSummary(sum)
    } catch (e) { setError(e) } finally { setLoading(false) }
  }, [filter])

  useEffect(() => { if (tab === 'ledger') load() }, [load, tab])

  useEffect(() => {
    if (tab !== 'reconcile') return
    api.reconcile().then(setReconcile).catch((e) => setError(e))
  }, [tab])

  const doLookup = async () => {
    if (!lookupTerm.trim()) return
    try { setLookupResults(await api.lookupUser(lookupTerm.trim())) }
    catch (e) { toast(e.message, 'error') }
  }

  const [runSweep, sweepBusy] = useAsync(async (dryRun) => {
    try {
      const r = await api.expireSweep(dryRun)
      setExpiry(r)
      if (!dryRun) {
        toast(`تم إنهاء أرصدة ${r.expired} مستخدماً`, 'success')
        if (tab === 'ledger') load()
      }
    } catch (e) { toast(e.message, 'error') }
  })

  const [doAdjust, adjustBusy] = useAsync(async () => {
    try {
      const r = await api.adjustCredits({
        user_id: adjustFor.id,
        amount: parseInt(adjustForm.amount, 10),
        direction: adjustForm.direction,
        reason: adjustForm.reason,
        client_key: clientKey,
      })
      toast(`تم — الرصيد الجديد ${fmtNum(r.balance)}`, 'success')
      setAdjustFor(null); setAdjustForm({ amount: '', direction: 'grant', reason: '' })
      setLookupResults([]); setLookupTerm('')
      if (tab === 'ledger') load()
    } catch (e) { toast(e.message, 'error') }
  })

  const granted = summary?.by_type?.find((t) => t.type === 'grant')?.total || 0
  const spent = Math.abs(summary?.by_type?.find((t) => t.type === 'debit')?.total || 0)

  const adjustBlocked = !adjustForm.amount || parseInt(adjustForm.amount, 10) <= 0
    || adjustForm.reason.trim().length < 3

  return (
    <>
      <div className={s.pageHead}>
        <div>
          <h1 className={s.pageTitle}>الأرصدة</h1>
          <p className={s.pageSub}>
            الدفتر سجل ثابت: لا يُعدَّل ولا يُحذف سطر. التصحيح يقع بحركة تعويضية جديدة.
          </p>
        </div>
      </div>

      {summary && (
        <div className={s.statGrid}>
          <Stat label="ممنوح (30 يوماً)" value={fmtNum(granted)} />
          <Stat label="مستهلك (30 يوماً)" value={fmtNum(spent)} />
          <Stat label="رصيد قائم" value={fmtNum(summary.liability.outstanding)}
            foot={`لدى ${fmtNum(summary.liability.holders)} مستخدم`} />
          <Stat label="دين مكافآت" value={fmtNum(summary.liability.debt)}
            foot="يُخصم من المنح القادمة" />
        </div>
      )}

      <div className={s.tabs}>
        <button type="button" className={`${s.tab} ${tab === 'ledger' ? s.tabActive : ''}`}
          onClick={() => setTab('ledger')}>الدفتر</button>
        <button type="button" className={`${s.tab} ${tab === 'lookup' ? s.tabActive : ''}`}
          onClick={() => setTab('lookup')}>بحث وتعديل</button>
        <button type="button" className={`${s.tab} ${tab === 'reconcile' ? s.tabActive : ''}`}
          onClick={() => setTab('reconcile')}>المطابقة</button>
        <button type="button" className={`${s.tab} ${tab === 'expiry' ? s.tabActive : ''}`}
          onClick={() => setTab('expiry')}>انتهاء الصلاحية</button>
      </div>

      <ErrorBox error={error} onRetry={load} />

      {tab === 'ledger' && (
        <>
          <div className={s.filters}>
            <select className={s.select} value={filter.type}
              onChange={(e) => setFilter({ ...filter, type: e.target.value, page: 1 })}>
              <option value="">كل الأنواع</option>
              {Object.entries(TYPE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select className={s.select} value={filter.source_type}
              onChange={(e) => setFilter({ ...filter, source_type: e.target.value, page: 1 })}>
              <option value="">كل المصادر</option>
              {Object.entries(SOURCE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input className={s.input} type="number" placeholder="رقم المستخدم"
              value={filter.user_id}
              onChange={(e) => setFilter({ ...filter, user_id: e.target.value, page: 1 })} />
            <button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={load}>تحديث</button>
          </div>

          <Panel flush>
            {loading ? <Loading /> : data.transactions.length === 0 ? (
              <Empty icon="💳" title="لا توجد حركات" text="ستظهر هنا كل حركة رصيد فور وقوعها." />
            ) : (
              <>
                <div className={s.tableWrap}>
                  <table className={s.table}>
                    <thead>
                      <tr>
                        <th>#</th><th>المستخدم</th><th>النوع</th><th>المصدر</th>
                        <th>المبلغ</th><th>قبل</th><th>بعد</th><th>السبب</th>
                        <th>المنفّذ</th><th>التاريخ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.transactions.map((t) => (
                        <tr key={t.id}>
                          <td className={s.mono}>{t.id}</td>
                          <td>
                            <Link to={`/growth/members/${t.user_id}`} style={{ color: '#2563eb' }}>
                              {t.user?.name || `#${t.user_id}`}
                            </Link>
                          </td>
                          <td><Badge tone={TYPE[t.type]?.tone}>{TYPE[t.type]?.label || t.type}</Badge></td>
                          <td style={{ fontSize: '0.78rem' }}>{SOURCE[t.source_type] || t.source_type}</td>
                          <td className={s.num}
                            style={{ color: t.amount >= 0 ? '#059669' : '#dc2626', fontWeight: 600 }}>
                            {t.amount >= 0 ? '+' : ''}{fmtNum(t.amount)}
                          </td>
                          <td className={s.num} style={{ color: '#94a3b8' }}>{fmtNum(t.balance_before)}</td>
                          <td className={s.num} style={{ fontWeight: 600 }}>{fmtNum(t.balance_after)}</td>
                          <td style={{ fontSize: '0.76rem', maxWidth: 180 }}>{t.reason || t.description || '—'}</td>
                          <td style={{ fontSize: '0.76rem' }}>{t.actor?.name || '—'}</td>
                          <td style={{ fontSize: '0.74rem', color: '#64748b' }}>{fmtDateTime(t.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination {...data.pagination} onChange={(page) => setFilter({ ...filter, page })} />
              </>
            )}
          </Panel>
        </>
      )}

      {tab === 'lookup' && (
        <Panel title="بحث عن مستخدم">
          <div className={s.filters}>
            <input className={`${s.input} ${s.inputGrow}`}
              placeholder="الاسم أو البريد أو رقم المستخدم"
              value={lookupTerm} onChange={(e) => setLookupTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && doLookup()} />
            <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={doLookup}>بحث</button>
          </div>

          {lookupResults.length === 0 ? (
            <Empty icon="🔍" title="ابحث عن مستخدم"
              text="اعرض رصيده وتاريخه، أو عدّل الرصيد بسبب مسجَّل في التدقيق." />
          ) : (
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr><th>المستخدم</th><th>البريد</th><th>الرصيد</th><th>الدين</th><th>الاشتراك</th><th /></tr>
                </thead>
                <tbody>
                  {lookupResults.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <Link to={`/growth/members/${u.id}`} style={{ color: '#2563eb', fontWeight: 600 }}>
                          {u.name}
                        </Link>
                      </td>
                      <td style={{ fontSize: '0.8rem' }}>{u.email}</td>
                      <td className={s.num} style={{ fontWeight: 700 }}>
                        {u.profile ? fmtNum(u.profile.credit_balance) : '—'}
                      </td>
                      <td className={s.num}>
                        {u.profile?.reward_debt > 0
                          ? <Badge tone="red">{fmtNum(u.profile.reward_debt)}</Badge> : '—'}
                      </td>
                      <td>
                        <Badge tone={u.profile?.subscription_status === 'active' ? 'green' : 'gray'}>
                          {u.profile?.subscription_status === 'active' ? 'فعّال' : 'لا يوجد'}
                        </Badge>
                      </td>
                      <td>
                        {can('credits:adjust') && (
                          <button type="button" className={`${s.btn} ${s.btnGhost} ${s.btnSm}`}
                            onClick={() => setAdjustFor(u)}>تعديل الرصيد</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {tab === 'reconcile' && (
        <Panel title="مطابقة الرصيد بالدفتر">
          <div className={s.infoBox}>
            المطابقة تُبلّغ ولا تصحّح تلقائياً. التصحيح الصامت يخفي الخلل الذي سبّب التباين،
            وهو أخطر من التباين نفسه.
          </div>
          {!reconcile ? <Loading /> : reconcile.healthy ? (
            <div className={s.emptyOk}>
              ✓ الرصيد مطابق للدفتر في كل السجلات المفحوصة
              <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.4rem', fontWeight: 400 }}>
                آخر فحص: {fmtDateTime(reconcile.checkedAt)}
              </div>
            </div>
          ) : (
            <>
              <div className={s.errorBox}>
                وُجد {reconcile.discrepancies.length} تباين. هذا يستدعي فحصاً فورياً — قد يشير
                إلى كتابة تمّت خارج خدمة الأرصدة.
              </div>
              <div className={s.tableWrap}>
                <table className={s.table}>
                  <thead>
                    <tr><th>المستخدم</th><th>الرصيد المخزَّن</th><th>مجموع الدفتر</th><th>الفرق</th><th /></tr>
                  </thead>
                  <tbody>
                    {reconcile.discrepancies.map((d) => (
                      <tr key={d.user_id}>
                        <td>
                          <Link to={`/growth/members/${d.user_id}`} style={{ color: '#2563eb' }}>
                            #{d.user_id}
                          </Link>
                        </td>
                        <td className={s.num}>{fmtNum(d.cached)}</td>
                        <td className={s.num}>{fmtNum(d.ledger)}</td>
                        <td className={s.num} style={{ color: '#dc2626', fontWeight: 700 }}>
                          {d.drift > 0 ? '+' : ''}{fmtNum(d.drift)}
                        </td>
                        <td>
                          {can('credits:adjust') && (
                            <button type="button" className={`${s.btn} ${s.btnGhost} ${s.btnSm}`}
                              onClick={() => setAdjustFor({ id: d.user_id, name: `#${d.user_id}` })}>
                              تصحيح يدوي
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Panel>
      )}

      {tab === 'expiry' && (
        <Panel title="إنهاء أرصدة الاشتراكات المنقضية">
          <div className={s.infoBox}>
            القاعدة: حين ينقضي اشتراك ويمرّ عليه أيام السماح، تُنهى الأرصدة التي منحتها
            طلبات <strong>الاشتراك</strong> ولم تُستهلك. أرصدة <strong>حزم الشراء لا تنتهي</strong> —
            العميل دفع ثمنها مرة واحدة ولم يستأجرها. تُضبط القاعدة وأيام السماح من صفحة الإعدادات.
          </div>

          {!expiry ? (
            <div className={s.pageActions}>
              <button type="button" className={`${s.btn} ${s.btnGhost}`}
                onClick={() => runSweep(true)} disabled={sweepBusy}>
                {sweepBusy ? 'جارٍ الحساب…' : 'معاينة الأثر (بلا تنفيذ)'}
              </button>
            </div>
          ) : !expiry.enabled ? (
            <div className={s.warnBox}>
              {expiry.message} — فعّله من الإعدادات إن أردت تشغيل هذه السياسة.
            </div>
          ) : expiry.candidates.length === 0 ? (
            <div className={s.emptyOk}>✓ لا أرصدة مستحقّة للإنهاء حالياً</div>
          ) : (
            <>
              <div className={s.warnBox}>
                {fmtNum(expiry.candidates.length)} مستخدماً مرشّحاً، بمجموع{' '}
                <strong>{fmtNum(expiry.total ?? expiry.candidates.reduce((a, c) => a + c.expirable, 0))}</strong>{' '}
                رصيد سيُنهى. العملية تُسجَّل في الدفتر كحركات انتهاء ولا يمكن التراجع عنها
                إلا بمنح جديد.
              </div>

              <div className={s.tableWrap} style={{ marginBottom: '1rem' }}>
                <table className={s.table}>
                  <thead>
                    <tr><th>المستخدم</th><th>الرصيد</th><th>مُنح باشتراك</th><th>سبق إنهاؤه</th><th>سيُنهى</th></tr>
                  </thead>
                  <tbody>
                    {expiry.candidates.slice(0, 50).map((c) => (
                      <tr key={c.user_id}>
                        <td>
                          <Link to={`/growth/members/${c.user_id}`} style={{ color: '#2563eb' }}>
                            #{c.user_id}
                          </Link>
                        </td>
                        <td className={s.num}>{fmtNum(c.credit_balance)}</td>
                        <td className={s.num}>{fmtNum(c.granted)}</td>
                        <td className={s.num}>{fmtNum(c.expired)}</td>
                        <td className={s.num} style={{ color: '#dc2626', fontWeight: 700 }}>
                          {fmtNum(c.expirable)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {expiry.dryRun !== false && can('credits:adjust') && (
                <div className={s.pageActions}>
                  <button type="button" className={`${s.btn} ${s.btnDanger}`}
                    onClick={() => setConfirmSweep(true)} disabled={sweepBusy}>
                    تنفيذ الإنهاء
                  </button>
                  <button type="button" className={`${s.btn} ${s.btnGhost}`}
                    onClick={() => setExpiry(null)}>إلغاء</button>
                </div>
              )}
            </>
          )}
        </Panel>
      )}

      <Confirm
        open={confirmSweep} title="تنفيذ إنهاء الأرصدة"
        message={expiry
          ? `سيُنهى ${fmtNum(expiry.total ?? 0)} رصيد لدى ${fmtNum(expiry.candidates?.length || 0)} مستخدماً. تُسجَّل حركات انتهاء في الدفتر ولا تُحذف.`
          : ''}
        confirmLabel="تنفيذ" danger busy={sweepBusy}
        onConfirm={() => { setConfirmSweep(false); runSweep(false) }}
        onCancel={() => setConfirmSweep(false)}
      />

      <Modal
        open={!!adjustFor} title={`تعديل رصيد: ${adjustFor?.name || ''}`}
        onClose={() => setAdjustFor(null)}
        footer={(
          <>
            <button type="button" className={`${s.btn} ${s.btnPrimary}`}
              onClick={doAdjust} disabled={adjustBlocked || adjustBusy}>
              {adjustBusy ? 'جارٍ التنفيذ…' : 'تنفيذ التعديل'}
            </button>
            <button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={() => setAdjustFor(null)}>إلغاء</button>
          </>
        )}
      >
        <div className={s.warnBox}>
          عملية مالية تُسجَّل في سجل التدقيق باسمك ووقتها وعنوانك، ولا يمكن حذفها.
          {adjustFor?.profile && ` الرصيد الحالي: ${fmtNum(adjustFor.profile.credit_balance)}`}
        </div>
        <div className={s.formGrid}>
          <Field label="الاتجاه" required>
            <select className={s.select} value={adjustForm.direction}
              onChange={(e) => setAdjustForm({ ...adjustForm, direction: e.target.value })}>
              <option value="grant">إضافة رصيد</option>
              <option value="debit">خصم رصيد</option>
            </select>
          </Field>
          <Field label="المبلغ" required>
            <input className={s.input} type="number" min="1" value={adjustForm.amount}
              onChange={(e) => setAdjustForm({ ...adjustForm, amount: e.target.value })} />
          </Field>
          <Field label="السبب" required full
            hint="يُسجَّل نصّاً في التدقيق. اكتب سبباً يفهمه من يراجع بعد ستة أشهر.">
            <textarea className={s.textarea} value={adjustForm.reason}
              onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </>
  )
}
