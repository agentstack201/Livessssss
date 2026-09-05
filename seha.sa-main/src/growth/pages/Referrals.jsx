// الإحالات — الروابط والقمع وطابور مراجعة المكافآت المعلّقة.
//
// جدول الدفعات هو قلب هذه الصفحة: يوزّع المكافأة على مراحل، فيحصل المُحيل
// على دفعة سريعة عند التفعيل والباقي عند أول شراء. الأول يُبقيه يُحيل،
// والثاني يربط معظم التكلفة بإيراد حقيقي.

import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import s from '../console.module.css'
import { api, toast } from '../api'
import {
  Panel, Loading, ErrorBox, Empty, Badge, Modal, Confirm, Field, Funnel, Pagination,
  useAsync, fmtNum, fmtDateTime, Stat,
} from '../components/ui'

const MILESTONES = [
  { value: 'verified', label: 'التوثيق' },
  { value: 'activated', label: 'التفعيل (أول مستند)' },
  { value: 'meaningful_action', label: 'الفعل الجوهري' },
  { value: 'first_purchase', label: 'أول شراء' },
]

const STAGE_LABEL = {
  clicked: 'نقرة', registered: 'تسجيل', verified: 'موثَّق', activated: 'مفعَّل',
  meaningful_action: 'فعل جوهري', first_purchase: 'أول شراء', retained: 'مستمر', revoked: 'مُلغى',
}

const PAYOUT_STATUS = {
  none: { label: 'لا شيء', tone: 'gray' },
  partial: { label: 'جزئي', tone: 'blue' },
  complete: { label: 'مكتمل', tone: 'green' },
  hold: { label: 'معلّق', tone: 'amber' },
  revoked: { label: 'مُلغى', tone: 'red' },
}

/** التوزيع الموصى به — يُملأ به النموذج بدل تركه فارغاً. */
const DEFAULT_SCHEDULE = [
  { milestone: 'verified', party: 'referee', amount: 25 },
  { milestone: 'activated', party: 'referrer', amount: 20 },
  { milestone: 'first_purchase', party: 'referrer', amount: 30 },
]

export default function Referrals({ can }) {
  const [tab, setTab] = useState(() =>
    new URLSearchParams(window.location.search).get('filter') === 'held' ? 'review' : 'overview')
  const [funnelData, setFunnelData] = useState(null)
  const [links, setLinks] = useState([])
  const [events, setEvents] = useState({ events: [], pagination: {} })
  const [eventFilter, setEventFilter] = useState({ filter: '', page: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({
    owner_id: '', code: '', label: '', type: 'personal',
    payout_schedule: DEFAULT_SCHEDULE, max_uses: '', expires_at: '', is_active: true,
  })
  const [ownerSearch, setOwnerSearch] = useState('')
  const [ownerResults, setOwnerResults] = useState([])
  const [revoking, setRevoking] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [f, l] = await Promise.all([api.referralFunnel(), api.referralLinks()])
      setFunnelData(f); setLinks(l)
    } catch (e) { setError(e) } finally { setLoading(false) }
  }, [])

  const loadEvents = useCallback(async () => {
    try {
      setEvents(await api.referralEvents({
        ...eventFilter,
        filter: tab === 'review' ? 'held' : eventFilter.filter,
      }))
    } catch (e) { setError(e) }
  }, [eventFilter, tab])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (tab === 'review' || tab === 'events') loadEvents() }, [loadEvents, tab])

  const searchOwner = async (term) => {
    setOwnerSearch(term)
    if (term.trim().length < 2) { setOwnerResults([]); return }
    try { setOwnerResults(await api.searchMembers(term.trim())) } catch { setOwnerResults([]) }
  }

  const [save, saving] = useAsync(async () => {
    const payload = {
      ...form,
      max_uses: form.max_uses === '' ? null : parseInt(form.max_uses, 10),
      expires_at: form.expires_at || null,
      payout_schedule: form.payout_schedule.filter((p) => Number(p.amount) > 0),
    }
    try {
      if (editing === 'new') await api.createReferralLink(payload)
      else await api.updateReferralLink(editing.id, payload)
      toast('تم الحفظ — يسري على الإحالات الجديدة', 'success')
      setEditing(null); load()
    } catch (e) { toast(e.message, 'error') }
  })

  // إفراج جماعي عمّا انقضت مدّة تعليقه — الإعداد fraud.auto_release_days كان
  // بلا أي مستدعٍ، فتبقى المكافآت معلّقة أبداً مهما ضُبط.
  const [releaseExpired, releasingExpired] = useAsync(async () => {
    try {
      const r = await api.releaseExpiredHolds()
      toast(r.released ? `أُفرج عن ${r.released} مكافأة` : 'لا مكافآت انقضت مدّتها بعد', 'success')
      loadEvents(); load()
    } catch (e) { toast(e.message, 'error') }
  })

  const [release, releasing] = useAsync(async (grantId) => {
    try {
      await api.releaseGrant(grantId)
      toast('تم الإفراج عن المكافأة ومنحها', 'success')
      loadEvents(); load()
    } catch (e) { toast(e.message, 'error') }
  })

  const [doRevoke, revokeBusy] = useAsync(async (reason) => {
    try {
      const r = await api.revokeReferralGrant(revoking.id, reason)
      toast(r.shortfall > 0
        ? `أُلغيت. استُرجع ${fmtNum(r.recovered)} وسُجّل ${fmtNum(r.shortfall)} ديناً`
        : 'تم إلغاء المكافأة واسترجاع الرصيد', 'success')
      setRevoking(null); loadEvents(); load()
    } catch (e) { toast(e.message, 'error') }
  })

  const setPayout = (i, patch) => {
    const next = [...form.payout_schedule]
    next[i] = { ...next[i], ...patch }
    setForm({ ...form, payout_schedule: next })
  }

  const openNew = () => {
    setForm({
      owner_id: '', code: '', label: '', type: 'personal',
      payout_schedule: DEFAULT_SCHEDULE, max_uses: '', expires_at: '', is_active: true,
    })
    setOwnerSearch(''); setOwnerResults([]); setEditing('new')
  }

  const openEdit = (l) => {
    setForm({
      owner_id: l.owner_id, code: l.code, label: l.label || '', type: l.type,
      payout_schedule: l.payout_schedule?.length ? l.payout_schedule : DEFAULT_SCHEDULE,
      max_uses: l.max_uses ?? '', expires_at: l.expires_at ? l.expires_at.slice(0, 10) : '',
      is_active: l.is_active,
    })
    setEditing(l)
  }

  const writable = can('referrals:write')
  const canModerate = can('referrals:moderate')
  const health = funnelData?.health

  return (
    <>
      <div className={s.pageHead}>
        <div>
          <h1 className={s.pageTitle}>الإحالات</h1>
          <p className={s.pageSub}>
            إحالة أحادية المستوى. المكافأة موزّعة على مراحل ولا تُدفع بمجرّد التسجيل.
          </p>
        </div>
        {writable && (
          <div className={s.pageActions}>
            <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={openNew}>+ رابط إحالة</button>
          </div>
        )}
      </div>

      {health && (
        <div className={s.statGrid}>
          <Stat label="معدّل تفعيل الإحالة" value={`${health.activation_rate}%`}
            foot={`${fmtNum(health.activated)} من ${fmtNum(health.clicks)} نقرة`} />
          <Stat label="التحويل إلى شراء" value={`${health.purchase_rate}%`}
            foot={`${fmtNum(health.purchased)} شراء`} />
          <Stat label="مكافآت معلّقة" value={fmtNum(health.held)} foot="بانتظار مراجعتك" />
          <Stat label="عالية المخاطر" value={fmtNum(health.high_risk)} foot="تحتاج موافقة صريحة" />
        </div>
      )}

      <div className={s.tabs}>
        <button type="button" className={`${s.tab} ${tab === 'overview' ? s.tabActive : ''}`}
          onClick={() => setTab('overview')}>القمع والروابط</button>
        <button type="button" className={`${s.tab} ${tab === 'review' ? s.tabActive : ''}`}
          onClick={() => setTab('review')}>
          طابور المراجعة{health?.held > 0 ? ` (${health.held})` : ''}
        </button>
        <button type="button" className={`${s.tab} ${tab === 'events' ? s.tabActive : ''}`}
          onClick={() => setTab('events')}>كل الأحداث</button>
      </div>

      <ErrorBox error={error} onRetry={load} />

      {tab === 'overview' && (loading ? <Loading /> : (
        <>
          <Panel title="قمع الإحالة (90 يوماً)">
            {funnelData && (
              <Funnel stages={[
                { key: 'clicked', label: 'نقرة', value: funnelData.funnel.clicked },
                { key: 'registered', label: 'تسجيل', value: funnelData.funnel.registered },
                { key: 'verified', label: 'توثيق', value: funnelData.funnel.verified },
                { key: 'activated', label: 'تفعيل', value: funnelData.funnel.activated },
                { key: 'meaningful', label: 'فعل جوهري', value: funnelData.funnel.meaningful_action },
                { key: 'purchase', label: 'أول شراء', value: funnelData.funnel.first_purchase },
                { key: 'retained', label: 'استمرار', value: funnelData.funnel.retained },
              ]} />
            )}
          </Panel>

          <Panel title="روابط الإحالة" flush>
            {links.length === 0 ? (
              <Empty icon="🔗" title="لا توجد روابط بعد"
                text="أنشئ رابطاً وحدّد جدول دفعاته. بلا جدول دفعات لا يمنح الرابط شيئاً."
                action={writable && (
                  <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={openNew}>إنشاء رابط</button>
                )} />
            ) : (
              <div className={s.tableWrap}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th>الرمز</th><th>المالك</th><th>النقرات</th><th>مفعَّل</th>
                      <th>شراء</th><th>المدفوع</th><th>الحالة</th><th /></tr>
                  </thead>
                  <tbody>
                    {links.map((l) => (
                      <tr key={l.id}>
                        <td>
                          <div className={s.mono} style={{ fontWeight: 700 }}>{l.code}</div>
                          {l.label && <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>{l.label}</div>}
                        </td>
                        <td>
                          {l.owner && (
                            <Link to={`/growth/members/${l.owner_id}`} style={{ color: '#2563eb' }}>
                              {l.owner.name}
                            </Link>
                          )}
                        </td>
                        <td className={s.num}>{fmtNum(l.stats.clicks)}</td>
                        <td className={s.num}>{fmtNum(l.stats.activated)}</td>
                        <td className={s.num}>{fmtNum(l.stats.purchased)}</td>
                        <td className={s.num}>{fmtNum(l.total_paid_out)}</td>
                        <td>
                          <Badge tone={l.is_active ? 'green' : 'gray'}>
                            {l.is_active ? 'فعّال' : 'موقوف'}
                          </Badge>
                        </td>
                        <td>
                          {writable && (
                            <button type="button" className={`${s.btn} ${s.btnGhost} ${s.btnSm}`}
                              onClick={() => openEdit(l)}>تعديل</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          {funnelData?.top_referrers?.length > 0 && (
            <Panel title="أفضل المُحيلين" flush>
              <div className={s.tableWrap}>
                <table className={s.table}>
                  <thead>
                    <tr><th>المُحيل</th><th>إحالات</th><th>مفعَّل</th><th>شراء</th><th>أرصدة مكتسبة</th></tr>
                  </thead>
                  <tbody>
                    {funnelData.top_referrers.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <Link to={`/growth/members/${r.id}`} style={{ color: '#2563eb' }}>{r.name}</Link>
                        </td>
                        <td className={s.num}>{fmtNum(r.total_referrals)}</td>
                        <td className={s.num}>{fmtNum(r.activated)}</td>
                        <td className={s.num}>{fmtNum(r.purchased)}</td>
                        <td className={s.num}>{fmtNum(r.credits_earned)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
        </>
      ))}

      {(tab === 'review' || tab === 'events') && (
        <Panel
          title={tab === 'review' ? 'مكافآت بانتظار المراجعة' : 'كل أحداث الإحالة'}
          flush
          actions={tab === 'review' && canModerate ? (
            <button type="button" className={`${s.btn} ${s.btnGhost} ${s.btnSm}`}
              onClick={releaseExpired} disabled={releasingExpired}>
              {releasingExpired ? 'جارٍ الإفراج…' : 'إفراج عمّا انقضت مدّته'}
            </button>
          ) : null}
        >
          {tab === 'events' && (
            <div className={s.filters} style={{ padding: '0.9rem 1.1rem 0' }}>
              <select className={s.select} value={eventFilter.filter}
                onChange={(e) => setEventFilter({ filter: e.target.value, page: 1 })}>
                <option value="">الكل</option>
                <option value="held">معلّقة</option>
                <option value="high_risk">عالية المخاطر</option>
                <option value="revoked">مُلغاة</option>
              </select>
            </div>
          )}

          {events.events.length === 0 ? (
            tab === 'review'
              ? <div className={s.emptyOk}>✓ لا مكافآت معلّقة — كل الدفعات تمّت تلقائياً</div>
              : <Empty icon="🔗" title="لا أحداث" text="ستظهر هنا كل نقرة إحالة ومسارها." />
          ) : (
            <>
              <div className={s.tableWrap}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th>المُحيل</th><th>المُحال إليه</th><th>المرحلة</th>
                      <th>المخاطر</th><th>الدفع</th><th>المكافآت</th><th>التاريخ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.events.map((e) => (
                      <tr key={e.id}>
                        <td>
                          {e.referrer && (
                            <Link to={`/growth/members/${e.referrer_id}`} style={{ color: '#2563eb' }}>
                              {e.referrer.name}
                            </Link>
                          )}
                          <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{e.link?.code}</div>
                        </td>
                        <td>
                          {e.referee ? (
                            <Link to={`/growth/members/${e.referee_id}`} style={{ color: '#2563eb' }}>
                              {e.referee.name}
                            </Link>
                          ) : <span style={{ color: '#94a3b8' }}>لم يسجّل بعد</span>}
                        </td>
                        <td><Badge tone="blue">{STAGE_LABEL[e.stage_reached]}</Badge></td>
                        <td>
                          <Badge tone={e.risk_band === 'high' ? 'red' : e.risk_band === 'medium' ? 'amber' : 'green'}>
                            {e.fraud_score}
                          </Badge>
                          {e.fraud_reasons?.length > 0 && (
                            <div style={{ fontSize: '0.7rem', color: '#94a3b8', maxWidth: 190 }}>
                              {e.fraud_reasons.join(' · ')}
                            </div>
                          )}
                        </td>
                        <td>
                          <Badge tone={PAYOUT_STATUS[e.payout_status]?.tone}>
                            {PAYOUT_STATUS[e.payout_status]?.label}
                          </Badge>
                        </td>
                        <td>
                          {e.grants?.map((g) => (
                            <div key={g.id} style={{ fontSize: '0.75rem', marginBottom: 3 }}>
                              {g.party === 'referrer' ? 'مُحيل' : 'مُحال إليه'} · {fmtNum(g.value_snapshot)}
                              {' '}
                              <Badge tone={g.status === 'granted' ? 'green' : g.status === 'held' ? 'amber' : 'red'}>
                                {g.status === 'granted' ? 'مدفوع' : g.status === 'held' ? 'معلّق' : 'مُلغى'}
                              </Badge>
                              {canModerate && g.status === 'held' && (
                                <button type="button" className={`${s.btn} ${s.btnSuccess} ${s.btnSm}`}
                                  style={{ marginInlineStart: 4 }}
                                  disabled={releasing} onClick={() => release(g.id)}>إفراج</button>
                              )}
                              {canModerate && ['held', 'granted'].includes(g.status) && (
                                <button type="button" className={`${s.btn} ${s.btnDanger} ${s.btnSm}`}
                                  style={{ marginInlineStart: 4 }}
                                  onClick={() => setRevoking(g)}>إلغاء</button>
                              )}
                            </div>
                          ))}
                        </td>
                        <td style={{ fontSize: '0.74rem', color: '#64748b' }}>{fmtDateTime(e.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination {...events.pagination}
                onChange={(page) => setEventFilter({ ...eventFilter, page })} />
            </>
          )}
        </Panel>
      )}

      <Modal
        open={!!editing} wide
        title={editing === 'new' ? 'رابط إحالة جديد' : `تعديل: ${editing?.code || ''}`}
        onClose={() => setEditing(null)}
        footer={(
          <>
            <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={save} disabled={saving}>
              {saving ? 'جارٍ الحفظ…' : 'حفظ'}
            </button>
            <button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={() => setEditing(null)}>إلغاء</button>
          </>
        )}
      >
        <div className={s.infoBox}>
          التوزيع الموصى به: منحة صغيرة للمُحال إليه عند التوثيق، ودفعة للمُحيل عند التفعيل،
          والباقي عند أول شراء. الأولى تُقنعه بالتجربة، والثانية تُبقي المُحيل نشطاً،
          والثالثة تربط معظم التكلفة بإيراد فعلي.
        </div>

        <div className={s.formGrid}>
          {editing === 'new' && (
            <Field label="صاحب الرابط" required full
              hint="الطرف الذي تُدفع له مكافأة المُحيل">
              <input className={s.input} value={ownerSearch}
                onChange={(e) => searchOwner(e.target.value)}
                placeholder="ابحث بالاسم أو البريد…" />
              {ownerResults.length > 0 && (
                <div style={{ border: '1px solid #e4e9f2', borderRadius: 8, marginTop: 4, maxHeight: 150, overflowY: 'auto' }}>
                  {ownerResults.map((u) => (
                    <div key={u.id} className={s.searchRow}
                      onClick={() => {
                        setForm({ ...form, owner_id: u.id })
                        setOwnerSearch(u.name); setOwnerResults([])
                      }}>
                      <span className={s.searchName}>{u.name}</span>
                      <span className={s.searchMeta}>{u.email}</span>
                    </div>
                  ))}
                </div>
              )}
            </Field>
          )}

          <Field label="الرمز" hint={editing === 'new' ? 'اتركه فارغاً لتوليد رمز تلقائي' : ''}>
            <input className={s.input} value={form.code} disabled={editing !== 'new'}
              onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </Field>
          <Field label="وصف داخلي">
            <input className={s.input} value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })} />
          </Field>

          <Field label="جدول الدفعات" full
            hint="المبلغ صفر يعني لا دفعة عند تلك المرحلة">
            {form.payout_schedule.map((p, i) => (
              <div key={i} className={s.payoutRow}>
                <select className={s.select} value={p.milestone}
                  onChange={(e) => setPayout(i, { milestone: e.target.value })}>
                  {MILESTONES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <select className={s.select} value={p.party}
                  onChange={(e) => setPayout(i, { party: e.target.value })}>
                  <option value="referrer">المُحيل</option>
                  <option value="referee">المُحال إليه</option>
                </select>
                <input className={s.input} type="number" min="0" value={p.amount}
                  onChange={(e) => setPayout(i, { amount: e.target.value })} />
                <button type="button" className={`${s.btn} ${s.btnGhost} ${s.btnSm}`}
                  onClick={() => setForm({
                    ...form, payout_schedule: form.payout_schedule.filter((_, j) => j !== i),
                  })}>حذف</button>
              </div>
            ))}
            <button type="button" className={`${s.btn} ${s.btnGhost} ${s.btnSm}`}
              onClick={() => setForm({
                ...form,
                payout_schedule: [...form.payout_schedule,
                  { milestone: 'activated', party: 'referrer', amount: 0 }],
              })}>+ دفعة</button>
          </Field>

          <Field label="سقف الاستخدام" hint="اتركه فارغاً لبلا سقف">
            <input className={s.input} type="number" min="1" value={form.max_uses}
              onChange={(e) => setForm({ ...form, max_uses: e.target.value })} />
          </Field>
          <Field label="ينتهي في">
            <input className={s.input} type="date" value={form.expires_at}
              onChange={(e) => setForm({ ...form, expires_at: e.target.value })} />
          </Field>

          <Field full>
            <label className={s.checkRow}>
              <input type="checkbox" checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              الرابط فعّال
            </label>
          </Field>
        </div>
      </Modal>

      <Confirm
        open={!!revoking} title="إلغاء المكافأة"
        message={revoking ? `سيُسترجَع ${fmtNum(revoking.value_snapshot)} رصيداً. إن كان المستفيد قد أنفقه، يُسترجَع المتاح ويُسجَّل الباقي ديناً يُخصم من منحه القادمة.` : ''}
        confirmLabel="إلغاء المكافأة" danger requireReason busy={revokeBusy}
        onConfirm={doRevoke} onCancel={() => setRevoking(null)}
      />
    </>
  )
}
