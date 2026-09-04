// سجل التدقيق — إلحاقي، قابل للبحث والتصدير.
// اللقطتان before/after تُعرضان جنباً إلى جنب حين تكونان موجودتين، لأن
// «ماذا تغيّر بالضبط؟» هو السؤال الذي يُفتح السجل لأجله.

import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import s from '../console.module.css'
import { api, downloadAudit, toast } from '../api'
import {
  Panel, Loading, ErrorBox, Empty, Badge, Modal, Pagination, fmtDateTime,
} from '../components/ui'

const SEVERITY = {
  info: { label: 'معلومة', tone: 'gray' },
  notice: { label: 'ملحوظة', tone: 'blue' },
  critical: { label: 'حسّاسة', tone: 'red' },
}

const ACTION_LABEL = {
  'credit.adjust': 'تعديل رصيد يدوي',
  'credit.reverse': 'عكس حركة رصيد',
  'order.approve': 'اعتماد دفع',
  'order.auto_approve': 'اعتماد تلقائي',
  'order.refund': 'استرداد طلب',
  'order.cancel': 'إلغاء طلب',
  'order.create': 'إنشاء طلب',
  'product.create': 'إنشاء منتج',
  'product.update': 'تعديل منتج',
  'product.delete': 'حذف منتج',
  'product.reorder': 'إعادة ترتيب المنتجات',
  'coupon.create': 'إنشاء كوبون',
  'coupon.update': 'تعديل كوبون',
  'coupon.delete': 'حذف كوبون',
  'campaign.create': 'إنشاء حملة',
  'campaign.update': 'تعديل حملة',
  'campaign.delete': 'حذف حملة',
  'referral.link_create': 'إنشاء رابط إحالة',
  'referral.link_update': 'تعديل رابط إحالة',
  'referral.release': 'إفراج عن مكافأة',
  'referral.revoke': 'إلغاء مكافأة إحالة',
  'reward.grant': 'منح مكافأة',
  'reward.rule_create': 'إنشاء قاعدة مكافأة',
  'reward.rule_update': 'تعديل قاعدة مكافأة',
  'reward.rule_delete': 'حذف قاعدة مكافأة',
  'role.create': 'إنشاء دور',
  'role.update': 'تعديل دور',
  'role.delete': 'حذف دور',
  'role.assign': 'إسناد دور',
  'role.revoke': 'سحب دور',
  'settings.update': 'تعديل إعدادات',
}

function Diff({ before, after }) {
  if (!before && !after) return <span style={{ color: '#94a3b8' }}>—</span>
  const keys = [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])]
  if (!keys.length) return <span style={{ color: '#94a3b8' }}>—</span>

  const fmt = (v) => {
    if (v === null || v === undefined) return '—'
    if (typeof v === 'boolean') return v ? 'نعم' : 'لا'
    if (typeof v === 'object') return JSON.stringify(v)
    return String(v)
  }

  return (
    <table className={s.table} style={{ fontSize: '0.8rem' }}>
      <thead><tr><th>الحقل</th><th>قبل</th><th>بعد</th></tr></thead>
      <tbody>
        {keys.map((k) => (
          <tr key={k}>
            <td className={s.mono}>{k}</td>
            <td style={{ color: '#b91c1c' }}>{fmt(before?.[k])}</td>
            <td style={{ color: '#166534' }}>{fmt(after?.[k])}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function Audit() {
  const [data, setData] = useState({ entries: [], pagination: {} })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState({ q: '', severity: '', from: '', to: '', page: 1 })
  const [detail, setDetail] = useState(null)
  const [exporting, setExporting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setData(await api.auditLog(filter)) } catch (e) { setError(e) } finally { setLoading(false) }
  }, [filter])

  useEffect(() => { load() }, [load])

  const doExport = async () => {
    setExporting(true)
    try {
      await downloadAudit({ from: filter.from, severity: filter.severity })
      toast('تم تنزيل الملف', 'success')
    } catch (e) { toast(e.message, 'error') } finally { setExporting(false) }
  }

  return (
    <>
      <div className={s.pageHead}>
        <div>
          <h1 className={s.pageTitle}>سجل التدقيق</h1>
          <p className={s.pageSub}>
            سجل إلحاقي: يُكتب داخل معاملة العملية نفسها ولا يُحذف منه شيء — ولا حتى لمالك النظام.
          </p>
        </div>
        <div className={s.pageActions}>
          <button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={doExport} disabled={exporting}>
            {exporting ? 'جارٍ التصدير…' : 'تصدير CSV'}
          </button>
        </div>
      </div>

      <div className={s.filters}>
        <input className={`${s.input} ${s.inputGrow}`} placeholder="ابحث بالفعل أو المنفّذ أو السبب…"
          value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value, page: 1 })} />
        <select className={s.select} value={filter.severity}
          onChange={(e) => setFilter({ ...filter, severity: e.target.value, page: 1 })}>
          <option value="">كل المستويات</option>
          {Object.entries(SEVERITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <input className={s.input} type="date" value={filter.from}
          onChange={(e) => setFilter({ ...filter, from: e.target.value, page: 1 })} />
        <input className={s.input} type="date" value={filter.to}
          onChange={(e) => setFilter({ ...filter, to: e.target.value, page: 1 })} />
        <button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={load}>تحديث</button>
      </div>

      <ErrorBox error={error} onRetry={load} />

      <Panel flush>
        {loading ? <Loading /> : data.entries.length === 0 ? (
          <Empty icon="📋" title="لا سجلات مطابقة"
            text="كل عملية حسّاسة تُسجَّل هنا تلقائياً: تعديل رصيد، اعتماد دفع، تغيير سعر، إسناد صلاحية." />
        ) : (
          <>
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>الوقت</th><th>المنفّذ</th><th>الفعل</th><th>المورد</th>
                    <th>السبب</th><th>المستوى</th><th /></tr>
                </thead>
                <tbody>
                  {data.entries.map((e) => (
                    <tr key={e.id}>
                      <td style={{ fontSize: '0.76rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {fmtDateTime(e.createdAt)}
                      </td>
                      <td>
                        {e.actor_id ? (
                          <Link to={`/growth/members/${e.actor_id}`} style={{ color: '#2563eb' }}>
                            {e.actor_name || `#${e.actor_id}`}
                          </Link>
                        ) : <span style={{ color: '#94a3b8' }}>{e.actor_name || 'النظام'}</span>}
                      </td>
                      <td style={{ fontSize: '0.82rem' }}>{ACTION_LABEL[e.action] || e.action}</td>
                      <td style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        {e.resource_type}{e.resource_id ? ` #${e.resource_id}` : ''}
                      </td>
                      <td style={{ fontSize: '0.78rem', maxWidth: 200 }}>{e.reason || '—'}</td>
                      <td><Badge tone={SEVERITY[e.severity]?.tone}>{SEVERITY[e.severity]?.label}</Badge></td>
                      <td>
                        {(e.before || e.after) && (
                          <button type="button" className={`${s.btn} ${s.btnGhost} ${s.btnSm}`}
                            onClick={() => setDetail(e)}>التغيير</button>
                        )}
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

      <Modal open={!!detail} wide
        title={detail ? (ACTION_LABEL[detail.action] || detail.action) : ''}
        onClose={() => setDetail(null)}>
        {detail && (
          <>
            <div className={s.profileGrid}>
              <div className={s.profileStat}>
                <div className={s.profileStatLabel}>المنفّذ</div>
                <div className={s.profileStatValue} style={{ fontSize: '0.9rem' }}>
                  {detail.actor_name || 'النظام'}
                </div>
              </div>
              <div className={s.profileStat}>
                <div className={s.profileStatLabel}>الوقت</div>
                <div className={s.profileStatValue} style={{ fontSize: '0.85rem' }}>
                  {fmtDateTime(detail.createdAt)}
                </div>
              </div>
              <div className={s.profileStat}>
                <div className={s.profileStatLabel}>المورد</div>
                <div className={s.profileStatValue} style={{ fontSize: '0.85rem' }}>
                  {detail.resource_type} #{detail.resource_id}
                </div>
              </div>
              <div className={s.profileStat}>
                <div className={s.profileStatLabel}>عنوان الشبكة</div>
                <div className={s.profileStatValue} style={{ fontSize: '0.85rem' }}>
                  {detail.ip_address || '—'}
                </div>
              </div>
            </div>

            {detail.reason && (
              <div className={s.infoBox}><strong>السبب:</strong> {detail.reason}</div>
            )}

            <div className={s.tableWrap}>
              <Diff before={detail.before} after={detail.after} />
            </div>
          </>
        )}
      </Modal>
    </>
  )
}
