// الطلبات — طابور اعتماد الدفع، أكثر شاشة يزورها المشغّل يومياً.
// الاعتماد هو اللحظة التي تُمنح فيها الأرصدة ويُفعَّل الاشتراك، فيُعرض
// أثره صراحةً قبل الضغط.

import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import s from '../console.module.css'
import { api, toast } from '../api'
import {
  Panel, Loading, ErrorBox, Empty, Badge, Modal, Confirm, Field, Pagination,
  useAsync, fmtMoney, fmtNum, fmtDateTime,
} from '../components/ui'

const STATUS = {
  awaiting_payment: { label: 'بانتظار الدفع', tone: 'amber' },
  pending: { label: 'قيد المعالجة', tone: 'gray' },
  paid: { label: 'مدفوع', tone: 'green' },
  refunded: { label: 'مسترَد', tone: 'red' },
  cancelled: { label: 'ملغى', tone: 'gray' },
}

export default function Orders({ can }) {
  const [data, setData] = useState({ orders: [], pagination: {} })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState(() => {
    const p = new URLSearchParams(window.location.search)
    return { status: p.get('status') || '', q: '', page: 1 }
  })
  const [approving, setApproving] = useState(null)
  const [paymentRef, setPaymentRef] = useState('')
  const [refunding, setRefunding] = useState(null)
  const [cancelling, setCancelling] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setData(await api.orders(filter)) } catch (e) { setError(e) } finally { setLoading(false) }
  }, [filter])

  useEffect(() => { load() }, [load])

  const [doApprove, approvingBusy] = useAsync(async () => {
    try {
      await api.approveOrder(approving.id, paymentRef)
      toast(`تم الاعتماد ومنح ${approving.credits_snapshot} رصيداً`, 'success')
      setApproving(null); setPaymentRef(''); load()
    } catch (e) { toast(e.message, 'error') }
  })

  const [doRefund, refundBusy] = useAsync(async (reason) => {
    try {
      await api.refundOrder(refunding.id, reason)
      toast('تم الاسترداد وعكس الأرصدة', 'success')
      setRefunding(null); load()
    } catch (e) { toast(e.message, 'error') }
  })

  const [doCancel, cancelBusy] = useAsync(async (reason) => {
    try {
      await api.cancelOrder(cancelling.id, reason)
      toast('تم إلغاء الطلب', 'success')
      setCancelling(null); load()
    } catch (e) { toast(e.message, 'error') }
  })

  const pending = data.orders.filter((o) => o.status === 'awaiting_payment').length

  return (
    <>
      <div className={s.pageHead}>
        <div>
          <h1 className={s.pageTitle}>الطلبات والمدفوعات</h1>
          <p className={s.pageSub}>
            الطلب يحتفظ بالسعر والأرصدة كما كانت وقت الشراء، مهما تغيّر المنتج بعدها.
          </p>
        </div>
      </div>

      {pending > 0 && filter.status !== 'awaiting_payment' && (
        <div className={s.warnBox}>
          {fmtNum(pending)} طلب في هذه الصفحة بانتظار اعتماد الدفع.
          <button type="button" className={`${s.btn} ${s.btnGhost} ${s.btnSm}`}
            style={{ marginInlineStart: '0.75rem' }}
            onClick={() => setFilter({ ...filter, status: 'awaiting_payment', page: 1 })}>
            عرض الطابور فقط
          </button>
        </div>
      )}

      <div className={s.filters}>
        <input className={`${s.input} ${s.inputGrow}`} placeholder="ابحث برقم الطلب أو المنتج أو الكوبون…"
          value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value, page: 1 })} />
        <select className={s.select} value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value, page: 1 })}>
          <option value="">كل الحالات</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={load}>تحديث</button>
      </div>

      <ErrorBox error={error} onRetry={load} />

      <Panel flush>
        {loading ? <Loading /> : data.orders.length === 0 ? (
          <Empty icon="🧾" title="لا توجد طلبات"
            text="ستظهر هنا فور إنشاء أول طلب من واجهة العميل أو من اللوحة." />
        ) : (
          <>
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>المرجع</th>
                    <th>العميل</th>
                    <th>المنتج (وقت الشراء)</th>
                    <th>الصافي</th>
                    <th>الأرصدة</th>
                    <th>الحالة</th>
                    <th>التاريخ</th>
                    <th>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {data.orders.map((o) => (
                    <tr key={o.id}>
                      <td className={s.mono}>{o.reference}</td>
                      <td>
                        {o.user ? (
                          <Link to={`/growth/members/${o.user_id}`} style={{ color: '#2563eb' }}>
                            {o.user.name}
                          </Link>
                        ) : `#${o.user_id}`}
                      </td>
                      <td>
                        <div>{o.product_name_snapshot}</div>
                        <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                          {fmtMoney(o.unit_price_snapshot, o.currency)}
                          {Number(o.discount_amount) > 0 && ` · خصم ${fmtMoney(o.discount_amount, o.currency)}`}
                          {o.coupon_code_snapshot && ` (${o.coupon_code_snapshot})`}
                        </div>
                      </td>
                      <td className={s.num}>{fmtMoney(o.net_amount, o.currency)}</td>
                      <td className={s.num}>{fmtNum(o.credits_snapshot)}</td>
                      <td><Badge tone={STATUS[o.status]?.tone}>{STATUS[o.status]?.label || o.status}</Badge></td>
                      <td style={{ fontSize: '0.78rem', color: '#64748b' }}>{fmtDateTime(o.createdAt)}</td>
                      <td>
                        <div className={s.rowActions}>
                          {o.status === 'awaiting_payment' && can('orders:approve') && (
                            <>
                              <button type="button" className={`${s.btn} ${s.btnSuccess} ${s.btnSm}`}
                                onClick={() => { setApproving(o); setPaymentRef(o.payment_reference || '') }}>
                                اعتماد
                              </button>
                              <button type="button" className={`${s.btn} ${s.btnGhost} ${s.btnSm}`}
                                onClick={() => setCancelling(o)}>إلغاء</button>
                            </>
                          )}
                          {o.status === 'paid' && can('orders:refund') && (
                            <button type="button" className={`${s.btn} ${s.btnDanger} ${s.btnSm}`}
                              onClick={() => setRefunding(o)}>استرداد</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination {...data.pagination} onChange={(page) => setFilter({ ...filter, page })} />
          </>
        )}
      </Panel>

      <Modal
        open={!!approving} title="اعتماد الدفع" onClose={() => setApproving(null)}
        footer={(
          <>
            <button type="button" className={`${s.btn} ${s.btnSuccess}`} onClick={doApprove} disabled={approvingBusy}>
              {approvingBusy ? 'جارٍ الاعتماد…' : 'اعتماد ومنح الأرصدة'}
            </button>
            <button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={() => setApproving(null)}>إلغاء</button>
          </>
        )}
      >
        {approving && (
          <>
            <div className={s.infoBox}>
              سيُمنح <strong>{fmtNum(approving.credits_snapshot)}</strong> رصيداً للعميل
              {approving.product_kind_snapshot === 'subscription' && ' وسيُفعَّل اشتراكه'}.
              العملية تُسجَّل في سجل التدقيق ولا يمكن التراجع عنها إلا باسترداد.
            </div>
            <div className={s.profileGrid}>
              <div className={s.profileStat}>
                <div className={s.profileStatLabel}>المرجع</div>
                <div className={s.profileStatValue} style={{ fontSize: '0.9rem' }}>{approving.reference}</div>
              </div>
              <div className={s.profileStat}>
                <div className={s.profileStatLabel}>العميل</div>
                <div className={s.profileStatValue} style={{ fontSize: '0.9rem' }}>
                  {approving.user?.name || `#${approving.user_id}`}
                </div>
              </div>
              <div className={s.profileStat}>
                <div className={s.profileStatLabel}>المبلغ الصافي</div>
                <div className={s.profileStatValue}>{fmtMoney(approving.net_amount, approving.currency)}</div>
              </div>
            </div>
            <Field label="مرجع الدفع" hint="رقم الحوالة أو الإيصال — يُسجَّل في التدقيق">
              <input className={s.input} value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                placeholder={approving.payment_reference || 'اختياري'} />
            </Field>
            {approving.payment_note && (
              <div className={s.hint} style={{ marginTop: '0.5rem' }}>
                ملاحظة العميل: {approving.payment_note}
              </div>
            )}
          </>
        )}
      </Modal>

      <Confirm
        open={!!refunding} title="استرداد الطلب"
        message={refunding ? `سيُعكس ${fmtNum(refunding.credits_snapshot)} رصيداً من حساب العميل. إن كان قد أنفقها، يُسترجَع المتاح ويُسجَّل الباقي ديناً. مكافآت الإحالة المرتبطة تُسترجَع أيضاً إن كانت داخل نافذة الاسترجاع.` : ''}
        confirmLabel="تنفيذ الاسترداد" danger requireReason busy={refundBusy}
        onConfirm={doRefund} onCancel={() => setRefunding(null)}
      />

      <Confirm
        open={!!cancelling} title="إلغاء الطلب"
        message="الطلب لم يُدفع بعد، فالإلغاء لا يمسّ أي رصيد."
        confirmLabel="إلغاء الطلب" danger requireReason busy={cancelBusy}
        onConfirm={doCancel} onCancel={() => setCancelling(null)}
      />
    </>
  )
}
