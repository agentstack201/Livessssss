// الحملات — مجلّد له ميزانية وساعة.
// الأدوات المرتبطة تُعرض داخل الحملة، فيرى المشغّل ما تحتويه دون التنقّل
// بين ثلاث صفحات. وإنشاء حملة لا يستلزم إنشاء أي كائن آخر.

import { useState, useEffect, useCallback } from 'react'
import s from '../console.module.css'
import { api, toast } from '../api'
import {
  Panel, Loading, ErrorBox, Empty, Badge, Modal, Confirm, Field,
  useAsync, fmtMoney, fmtNum, fmtDate, Stat,
} from '../components/ui'

const EMPTY = {
  name: '', description: '', type: 'acquisition', status: 'draft',
  start_date: '', end_date: '', budget: '', target_audience: 'all',
}

const STATUS = {
  draft: { label: 'مسودّة', tone: 'gray' },
  scheduled: { label: 'مجدولة', tone: 'blue' },
  active: { label: 'نشطة', tone: 'green' },
  paused: { label: 'متوقّفة', tone: 'amber' },
  ended: { label: 'منتهية', tone: 'gray' },
}

const TYPES = {
  acquisition: 'اكتساب', retention: 'احتفاظ', upsell: 'ترقية',
  seasonal: 'موسمية', custom: 'مخصّصة',
}

const AUDIENCES = {
  all: 'الجميع', new_users: 'المستخدمون الجدد',
  existing_users: 'المستخدمون الحاليون', churned: 'المغادرون',
}

export default function Campaigns({ can }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState({ status: '', q: '' })
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [detail, setDetail] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setItems(await api.campaigns(filter)) } catch (e) { setError(e) } finally { setLoading(false) }
  }, [filter])

  useEffect(() => { load() }, [load])

  const openNew = () => { setForm(EMPTY); setEditing('new') }
  const openEdit = (c) => {
    setForm({
      name: c.name, description: c.description || '', type: c.type, status: c.status,
      start_date: c.start_date ? c.start_date.slice(0, 10) : '',
      end_date: c.end_date ? c.end_date.slice(0, 10) : '',
      budget: c.budget ?? '', target_audience: c.target_audience,
    })
    setEditing(c)
  }

  const [save, saving] = useAsync(async () => {
    const payload = {
      ...form,
      budget: form.budget === '' ? null : Number(form.budget),
      start_date: form.start_date || null,
      end_date: form.end_date || null,
    }
    try {
      if (editing === 'new') await api.createCampaign(payload)
      else await api.updateCampaign(editing.id, payload)
      toast('تم الحفظ', 'success'); setEditing(null); load()
    } catch (e) { toast(e.message, 'error') }
  })

  const [doDelete, deleting] = useAsync(async (reason) => {
    try {
      await api.deleteCampaign(confirmDelete.id, reason)
      toast('تم حذف الحملة وفكّ ارتباط أدواتها', 'success')
      setConfirmDelete(null); load()
    } catch (e) { toast(e.message, 'error') }
  })

  const setStatus = async (c, status) => {
    try { await api.updateCampaign(c.id, { status }); toast('تم تحديث الحالة', 'success'); load() }
    catch (e) { toast(e.message, 'error') }
  }

  const openDetail = async (c) => {
    try { setDetail(await api.campaign(c.id)) } catch (e) { toast(e.message, 'error') }
  }

  const writable = can('campaigns:write')
  const activeCount = items.filter((c) => c.status === 'active').length
  const totalRevenue = items.reduce((sum, c) => sum + Number(c.stats?.revenue || 0), 0)

  return (
    <>
      <div className={s.pageHead}>
        <div>
          <h1 className={s.pageTitle}>الحملات</h1>
          <p className={s.pageSub}>
            الحملة مجلّد له ميزانية وساعة. الكوبونات والروابط والقواعد أدوات تضعها فيه — وكلها تعمل بلا حملة أيضاً.
          </p>
        </div>
        {writable && (
          <div className={s.pageActions}>
            <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={openNew}>+ حملة جديدة</button>
          </div>
        )}
      </div>

      <div className={s.statGrid}>
        <Stat label="حملات نشطة" value={fmtNum(activeCount)} foot={`من ${fmtNum(items.length)}`} />
        <Stat label="إجمالي الإيراد المنسوب" value={fmtMoney(totalRevenue)} />
      </div>

      <div className={s.filters}>
        <input className={`${s.input} ${s.inputGrow}`} placeholder="ابحث بالاسم…"
          value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} />
        <select className={s.select} value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}>
          <option value="">كل الحالات</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      <ErrorBox error={error} onRetry={load} />

      <Panel flush>
        {loading ? <Loading /> : items.length === 0 ? (
          <Empty icon="📢" title="لا توجد حملات"
            text="الحملة تجمع الإنفاق والعائد في مكان واحد، فتستطيع الإجابة عن «هل كانت مربحة؟»"
            action={writable && (
              <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={openNew}>إنشاء أول حملة</button>
            )} />
        ) : (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>الحملة</th><th>النوع</th><th>الفترة</th><th>الميزانية</th>
                  <th>الإيراد</th><th>العائد</th><th>الحالة</th><th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{c.name}</div>
                      <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                        {AUDIENCES[c.target_audience]}
                      </div>
                    </td>
                    <td style={{ fontSize: '0.8rem' }}>{TYPES[c.type]}</td>
                    <td style={{ fontSize: '0.76rem' }}>
                      {c.start_date ? fmtDate(c.start_date) : '—'}
                      {c.end_date ? ` ← ${fmtDate(c.end_date)}` : ''}
                    </td>
                    <td className={s.num}>
                      {c.budget ? (
                        <>
                          {fmtMoney(c.budget_used)} / {fmtMoney(c.budget)}
                          {c.budget_pct >= 80 && (
                            <Badge tone={c.budget_pct >= 100 ? 'red' : 'amber'}>{c.budget_pct}%</Badge>
                          )}
                        </>
                      ) : 'بلا سقف'}
                    </td>
                    <td className={s.num}>{fmtMoney(c.stats?.revenue || 0)}</td>
                    <td className={s.num}>
                      {c.stats?.roi ? (
                        <Badge tone={Number(c.stats.roi) >= 1 ? 'green' : 'red'}>
                          {Number(c.stats.roi).toFixed(1)}×
                        </Badge>
                      ) : '—'}
                    </td>
                    <td><Badge tone={STATUS[c.status]?.tone}>{STATUS[c.status]?.label}</Badge></td>
                    <td>
                      <div className={s.rowActions}>
                        <button type="button" className={`${s.btn} ${s.btnGhost} ${s.btnSm}`}
                          onClick={() => openDetail(c)}>التفاصيل</button>
                        {writable && (
                          <>
                            <button type="button" className={`${s.btn} ${s.btnGhost} ${s.btnSm}`}
                              onClick={() => openEdit(c)}>تعديل</button>
                            {c.status === 'active' ? (
                              <button type="button" className={`${s.btn} ${s.btnGhost} ${s.btnSm}`}
                                onClick={() => setStatus(c, 'paused')}>إيقاف</button>
                            ) : ['draft', 'paused', 'scheduled'].includes(c.status) && (
                              <button type="button" className={`${s.btn} ${s.btnSuccess} ${s.btnSm}`}
                                onClick={() => setStatus(c, 'active')}>تشغيل</button>
                            )}
                          </>
                        )}
                        {can('campaigns:delete') && (
                          <button type="button" className={`${s.btn} ${s.btnDanger} ${s.btnSm}`}
                            onClick={() => setConfirmDelete(c)}>حذف</button>
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

      <Modal open={!!editing} wide
        title={editing === 'new' ? 'حملة جديدة' : `تعديل: ${editing?.name || ''}`}
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
          بعد الحفظ تستطيع ربط كوبونات وروابط إحالة وقواعد مكافآت بهذه الحملة من صفحاتها،
          فيُنسب إنفاقها وعائدها إليها.
        </div>
        <div className={s.formGrid}>
          <Field label="اسم الحملة" required full>
            <input className={s.input} value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="الوصف" full>
            <input className={s.input} value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <Field label="النوع">
            <select className={s.select} value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="الجمهور المستهدف">
            <select className={s.select} value={form.target_audience}
              onChange={(e) => setForm({ ...form, target_audience: e.target.value })}>
              {Object.entries(AUDIENCES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="تبدأ في">
            <input className={s.input} type="date" value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
          </Field>
          <Field label="تنتهي في">
            <input className={s.input} type="date" value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
          </Field>
          <Field label="الميزانية" hint="اتركها فارغة لبلا سقف. تُستهلك بخصومات الكوبونات المنسوبة.">
            <input className={s.input} type="number" min="0" value={form.budget}
              onChange={(e) => setForm({ ...form, budget: e.target.value })} />
          </Field>
          <Field label="الحالة">
            <select className={s.select} value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
        </div>
      </Modal>

      <Modal open={!!detail} wide title={detail?.campaign?.name || ''} onClose={() => setDetail(null)}>
        {detail && (
          <>
            <div className={s.profileGrid}>
              <div className={s.profileStat}>
                <div className={s.profileStatLabel}>طلبات</div>
                <div className={s.profileStatValue}>{fmtNum(detail.stats?.orders || 0)}</div>
              </div>
              <div className={s.profileStat}>
                <div className={s.profileStatLabel}>مشترون</div>
                <div className={s.profileStatValue}>{fmtNum(detail.stats?.buyers || 0)}</div>
              </div>
              <div className={s.profileStat}>
                <div className={s.profileStatLabel}>الإيراد</div>
                <div className={s.profileStatValue}>{fmtMoney(detail.stats?.revenue || 0)}</div>
              </div>
              <div className={s.profileStat}>
                <div className={s.profileStatLabel}>الميزانية المستهلكة</div>
                <div className={s.profileStatValue}>{fmtMoney(detail.campaign.budget_used)}</div>
              </div>
            </div>

            <h4 className={s.panelTitle} style={{ marginBottom: '0.5rem' }}>الأدوات المرتبطة</h4>

            {detail.tools.coupons.length === 0 && detail.tools.referral_links.length === 0
              && detail.tools.reward_rules.length === 0 ? (
                <Empty icon="🧰" title="لا أدوات مرتبطة"
                  text="اربط كوبوناً أو رابط إحالة أو قاعدة مكافأة بهذه الحملة من صفحاتها." />
              ) : (
                <div className={s.tableWrap}>
                  <table className={s.table}>
                    <thead><tr><th>الأداة</th><th>المعرّف</th><th>الاستخدام</th></tr></thead>
                    <tbody>
                      {detail.tools.coupons.map((c) => (
                        <tr key={`c${c.id}`}>
                          <td><Badge tone="blue">كوبون</Badge></td>
                          <td className={s.mono}>{c.code}</td>
                          <td className={s.num}>{fmtNum(c.times_used)} استخدام</td>
                        </tr>
                      ))}
                      {detail.tools.referral_links.map((l) => (
                        <tr key={`l${l.id}`}>
                          <td><Badge tone="green">رابط إحالة</Badge></td>
                          <td className={s.mono}>{l.code}</td>
                          <td className={s.num}>
                            {fmtNum(l.times_used)} استخدام · {fmtNum(l.total_paid_out)} رصيد مدفوع
                          </td>
                        </tr>
                      ))}
                      {detail.tools.reward_rules.map((r) => (
                        <tr key={`r${r.id}`}>
                          <td><Badge tone="amber">قاعدة مكافأة</Badge></td>
                          <td>{r.name}</td>
                          <td className={s.num}>{fmtNum(r.total_granted)} منحة</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </>
        )}
      </Modal>

      <Confirm
        open={!!confirmDelete} title="حذف الحملة"
        message={`سيُحذف «${confirmDelete?.name}». الكوبونات والروابط والقواعد المرتبطة لن تُحذف — يُفكّ ارتباطها فقط وتبقى صالحة وحدها.`}
        confirmLabel="حذف" danger requireReason busy={deleting}
        onConfirm={doDelete} onCancel={() => setConfirmDelete(null)}
      />
    </>
  )
}
