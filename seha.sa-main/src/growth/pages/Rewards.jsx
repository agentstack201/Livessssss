// المكافآت — قواعد الأحداث وسجل المنح وتكلفتها.
// أنواع الأحداث تأتي من الخادم: قائمة مغلقة لكلٍّ منها مُقيِّم مكتوب. قاعدة
// بنوع لا يعرفه المحرّك لن تُطلق أبداً، فلا يُسمح بإنشائها أصلاً.

import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import s from '../console.module.css'
import { api, toast } from '../api'
import {
  Panel, Loading, ErrorBox, Empty, Badge, Modal, Confirm, Field, Pagination,
  useAsync, fmtNum, fmtDateTime, Stat,
} from '../components/ui'

const EMPTY = {
  name: '', description: '', event_type: 'first_purchase', event_config: {},
  reward_type: 'credits', reward_value: '', max_grants_per_user: 1,
  max_total_grants: '', valid_until: '', is_active: true,
}

export default function Rewards({ can }) {
  const [tab, setTab] = useState('rules')
  const [rules, setRules] = useState([])
  const [eventTypes, setEventTypes] = useState([])
  const [grants, setGrants] = useState({ grants: [], pagination: {} })
  const [effectiveness, setEffectiveness] = useState([])
  const [grantFilter, setGrantFilter] = useState({ status: '', page: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [revoking, setRevoking] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [r, t, e] = await Promise.all([
        api.rewardRules(), api.rewardEventTypes(), api.rewardEffectiveness(),
      ])
      setRules(r); setEventTypes(t); setEffectiveness(e)
    } catch (er) { setError(er) } finally { setLoading(false) }
  }, [])

  const loadGrants = useCallback(async () => {
    try { setGrants(await api.rewardGrants(grantFilter)) } catch (e) { setError(e) }
  }, [grantFilter])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (tab === 'grants') loadGrants() }, [loadGrants, tab])

  const selectedType = eventTypes.find((t) => t.value === form.event_type)

  const [save, saving] = useAsync(async () => {
    const payload = {
      ...form,
      reward_value: parseInt(form.reward_value, 10) || 0,
      max_grants_per_user: parseInt(form.max_grants_per_user, 10) || 1,
      max_total_grants: form.max_total_grants === '' ? null : parseInt(form.max_total_grants, 10),
      valid_until: form.valid_until || null,
    }
    try {
      if (editing === 'new') await api.createRewardRule(payload)
      else await api.updateRewardRule(editing.id, payload)
      toast('تم الحفظ — تسري على الأحداث اللاحقة', 'success')
      setEditing(null); load()
    } catch (e) { toast(e.message, 'error') }
  })

  const [doDelete, deleting] = useAsync(async (reason) => {
    try {
      await api.deleteRewardRule(confirmDelete.id, reason)
      toast('تم حذف القاعدة', 'success'); setConfirmDelete(null); load()
    } catch (e) { toast(e.message, 'error') }
  })

  const [doRevoke, revokeBusy] = useAsync(async (reason) => {
    try {
      const r = await api.revokeRewardGrant(revoking.id, reason)
      toast(r.shortfall > 0
        ? `أُلغيت. استُرجع ${fmtNum(r.recovered)} وسُجّل ${fmtNum(r.shortfall)} ديناً`
        : 'تم إلغاء المكافأة', 'success')
      setRevoking(null); loadGrants()
    } catch (e) { toast(e.message, 'error') }
  })

  const openNew = () => { setForm(EMPTY); setEditing('new') }
  const openEdit = (r) => {
    setForm({
      name: r.name, description: r.description || '', event_type: r.event_type,
      event_config: r.event_config || {}, reward_type: r.reward_type,
      reward_value: r.reward_value, max_grants_per_user: r.max_grants_per_user,
      max_total_grants: r.max_total_grants ?? '',
      valid_until: r.valid_until ? r.valid_until.slice(0, 10) : '',
      is_active: r.is_active,
    })
    setEditing(r)
  }

  const writable = can('rewards:write')
  const totalCost = rules.reduce((sum, r) => sum + (r.total_cost || 0), 0)
  const blocked = !form.name.trim() || !form.reward_value
    || (selectedType?.needs_threshold && !form.event_config?.threshold)

  return (
    <>
      <div className={s.pageHead}>
        <div>
          <h1 className={s.pageTitle}>المكافآت</h1>
          <p className={s.pageSub}>
            حدث ← قاعدة ← أهلية ← منحة. الأنواع مغلقة في الكود؛ أنت تضبط العتبات والمبالغ والسقوف.
          </p>
        </div>
        {writable && (
          <div className={s.pageActions}>
            <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={openNew}>+ قاعدة جديدة</button>
          </div>
        )}
      </div>

      <div className={s.statGrid}>
        <Stat label="قواعد فعّالة" value={fmtNum(rules.filter((r) => r.is_active).length)}
          foot={`من ${fmtNum(rules.length)}`} />
        <Stat label="إجمالي المنح" value={fmtNum(rules.reduce((sum, r) => sum + r.total_granted, 0))} />
        <Stat label="التكلفة بالأرصدة" value={fmtNum(totalCost)}
          foot="مجموع ما مُنح فعلاً" />
      </div>

      <div className={s.tabs}>
        <button type="button" className={`${s.tab} ${tab === 'rules' ? s.tabActive : ''}`}
          onClick={() => setTab('rules')}>القواعد</button>
        <button type="button" className={`${s.tab} ${tab === 'grants' ? s.tabActive : ''}`}
          onClick={() => setTab('grants')}>سجل المنح</button>
        <button type="button" className={`${s.tab} ${tab === 'effect' ? s.tabActive : ''}`}
          onClick={() => setTab('effect')}>الفعالية</button>
      </div>

      <ErrorBox error={error} onRetry={load} />

      {tab === 'rules' && (
        <Panel flush>
          {loading ? <Loading /> : rules.length === 0 ? (
            <Empty icon="🎁" title="لا توجد قواعد"
              text="أنشئ قاعدة تمنح رصيداً عند حدث — مثل أول شراء أو بلوغ عدد مستندات."
              action={writable && (
                <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={openNew}>إنشاء أول قاعدة</button>
              )} />
          ) : (
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>القاعدة</th><th>الحدث</th><th>المكافأة</th><th>لكل مستخدم</th>
                    <th>المنوح</th><th>التكلفة</th><th>الحالة</th><th /></tr>
                </thead>
                <tbody>
                  {rules.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{r.name}</div>
                        {r.description && (
                          <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>{r.description}</div>
                        )}
                      </td>
                      <td style={{ fontSize: '0.8rem' }}>
                        {r.event_label}
                        {r.event_config?.threshold && (
                          <Badge tone="gray">عند {r.event_config.threshold}</Badge>
                        )}
                      </td>
                      <td className={s.num}>{fmtNum(r.reward_value)} رصيد</td>
                      <td className={s.num}>{r.max_grants_per_user}</td>
                      <td className={s.num}>
                        {fmtNum(r.total_granted)}
                        {r.max_total_grants ? ` / ${fmtNum(r.max_total_grants)}` : ''}
                      </td>
                      <td className={s.num}>{fmtNum(r.total_cost)}</td>
                      <td>
                        <Badge tone={r.is_active ? 'green' : 'gray'}>
                          {r.is_active ? 'فعّالة' : 'موقوفة'}
                        </Badge>
                      </td>
                      <td>
                        <div className={s.rowActions}>
                          {writable && (
                            <>
                              <button type="button" className={`${s.btn} ${s.btnGhost} ${s.btnSm}`}
                                onClick={() => openEdit(r)}>تعديل</button>
                              <button type="button" className={`${s.btn} ${s.btnDanger} ${s.btnSm}`}
                                onClick={() => setConfirmDelete(r)}>حذف</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {tab === 'grants' && (
        <Panel flush>
          <div className={s.filters} style={{ padding: '0.9rem 1.1rem 0' }}>
            <select className={s.select} value={grantFilter.status}
              onChange={(e) => setGrantFilter({ status: e.target.value, page: 1 })}>
              <option value="">كل الحالات</option>
              <option value="granted">ممنوحة</option>
              <option value="held">معلّقة</option>
              <option value="revoked">مُلغاة</option>
            </select>
          </div>
          {grants.grants.length === 0 ? (
            <Empty icon="📭" title="لا منح بعد" text="ستظهر هنا كل مكافأة مُنحت ومصدرها." />
          ) : (
            <>
              <div className={s.tableWrap}>
                <table className={s.table}>
                  <thead>
                    <tr><th>المستفيد</th><th>المصدر</th><th>القيمة</th><th>الحالة</th><th>التاريخ</th><th /></tr>
                  </thead>
                  <tbody>
                    {grants.grants.map((g) => (
                      <tr key={g.id}>
                        <td>
                          <Link to={`/growth/members/${g.user_id}`} style={{ color: '#2563eb' }}>
                            {g.user?.name || `#${g.user_id}`}
                          </Link>
                        </td>
                        <td style={{ fontSize: '0.8rem' }}>
                          {g.source_kind === 'reward_rule'
                            ? (g.rule?.name || 'قاعدة محذوفة')
                            : `إحالة · ${g.milestone || ''}`}
                        </td>
                        <td className={s.num}>{fmtNum(g.value_snapshot)}</td>
                        <td>
                          <Badge tone={g.status === 'granted' ? 'green' : g.status === 'held' ? 'amber' : 'red'}>
                            {g.status === 'granted' ? 'ممنوحة' : g.status === 'held' ? 'معلّقة' : 'مُلغاة'}
                          </Badge>
                        </td>
                        <td style={{ fontSize: '0.76rem' }}>{fmtDateTime(g.createdAt)}</td>
                        <td>
                          {can('rewards:revoke') && g.status === 'granted' && g.source_kind === 'reward_rule' && (
                            <button type="button" className={`${s.btn} ${s.btnDanger} ${s.btnSm}`}
                              onClick={() => setRevoking(g)}>إلغاء</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination {...grants.pagination}
                onChange={(page) => setGrantFilter({ ...grantFilter, page })} />
            </>
          )}
        </Panel>
      )}

      {tab === 'effect' && (
        <Panel title="فعالية القواعد" flush>
          {effectiveness.length === 0 ? (
            <Empty icon="📊" title="لا بيانات" />
          ) : (
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr><th>القاعدة</th><th>الحدث</th><th>منح</th><th>مستخدمون فريدون</th><th>التكلفة</th><th>الحالة</th></tr>
                </thead>
                <tbody>
                  {effectiveness.map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600 }}>{r.name}</td>
                      <td style={{ fontSize: '0.8rem' }}>{r.event_label}</td>
                      <td className={s.num}>{fmtNum(r.grants)}</td>
                      <td className={s.num}>{fmtNum(r.unique_users)}</td>
                      <td className={s.num}>{fmtNum(r.credits_cost)}</td>
                      <td>
                        <Badge tone={r.is_active ? 'green' : 'gray'}>
                          {r.is_active ? 'فعّالة' : 'موقوفة'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      <Modal open={!!editing} wide
        title={editing === 'new' ? 'قاعدة مكافأة جديدة' : `تعديل: ${editing?.name || ''}`}
        onClose={() => setEditing(null)}
        footer={(
          <>
            <button type="button" className={`${s.btn} ${s.btnPrimary}`}
              onClick={save} disabled={saving || blocked}>
              {saving ? 'جارٍ الحفظ…' : 'حفظ'}
            </button>
            <button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={() => setEditing(null)}>إلغاء</button>
          </>
        )}
      >
        <div className={s.formGrid}>
          <Field label="اسم القاعدة" required full>
            <input className={s.input} value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="الوصف" full>
            <input className={s.input} value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>

          <Field label="الحدث المُطلِق" required>
            <select className={s.select} value={form.event_type}
              onChange={(e) => setForm({ ...form, event_type: e.target.value, event_config: {} })}>
              {eventTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>

          {selectedType?.needs_threshold && (
            <Field label="العتبة" required
              hint={form.event_type === 'nth_usage'
                ? 'عدد المستندات التي تُطلق المكافأة'
                : 'عدد الإحالات المفعَّلة التي تُطلق المكافأة'}>
              <input className={s.input} type="number" min="1"
                value={form.event_config?.threshold || ''}
                onChange={(e) => setForm({
                  ...form, event_config: { ...form.event_config, threshold: parseInt(e.target.value, 10) || '' },
                })} />
            </Field>
          )}

          <Field label="قيمة المكافأة" required hint="بالأرصدة">
            <input className={s.input} type="number" min="1" value={form.reward_value}
              onChange={(e) => setForm({ ...form, reward_value: e.target.value })} />
          </Field>

          <Field label="أقصى منح لكل مستخدم" required
            hint="يمنع تكرار المكافأة لنفس الشخص">
            <input className={s.input} type="number" min="1" value={form.max_grants_per_user}
              onChange={(e) => setForm({ ...form, max_grants_per_user: e.target.value })} />
          </Field>

          <Field label="سقف المنح الكلّي" hint="اتركه فارغاً لبلا سقف">
            <input className={s.input} type="number" min="1" value={form.max_total_grants}
              onChange={(e) => setForm({ ...form, max_total_grants: e.target.value })} />
          </Field>

          <Field label="تنتهي في">
            <input className={s.input} type="date" value={form.valid_until}
              onChange={(e) => setForm({ ...form, valid_until: e.target.value })} />
          </Field>

          <Field full>
            <label className={s.checkRow}>
              <input type="checkbox" checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              القاعدة فعّالة
            </label>
          </Field>
        </div>
      </Modal>

      <Confirm open={!!confirmDelete} title="حذف القاعدة"
        message={`سيُحذف «${confirmDelete?.name}». المنح السابقة تبقى سليمة ولا تُسترجَع.`}
        confirmLabel="حذف" danger requireReason busy={deleting}
        onConfirm={doDelete} onCancel={() => setConfirmDelete(null)} />

      <Confirm open={!!revoking} title="إلغاء المكافأة"
        message={revoking ? `سيُسترجَع ${fmtNum(revoking.value_snapshot)} رصيداً بحركة تعويضية. إن كان المستفيد قد أنفقه، يُسجَّل الباقي ديناً.` : ''}
        confirmLabel="إلغاء المكافأة" danger requireReason busy={revokeBusy}
        onConfirm={doRevoke} onCancel={() => setRevoking(null)} />
    </>
  )
}
