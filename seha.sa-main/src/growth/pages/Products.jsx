// المنتجات والأسعار — الشاشة التي تجعل تغيير السعر عملية لوحة لا عملية نشر.
// كل حقل هنا يُكتب في PostgreSQL ويقرأه الخادم عند الطلب التالي مباشرة.

import { useState, useEffect, useCallback } from 'react'
import s from '../console.module.css'
import { api, toast } from '../api'
import {
  Panel, Loading, ErrorBox, Empty, Badge, Modal, Confirm, Field,
  useAsync, fmtMoney, fmtNum,
} from '../components/ui'

const EMPTY = {
  name: '', description: '', kind: 'credit_pack', billing_cycle: 'monthly',
  price: '', currency: 'SAR', credits_granted: '', trial_days: 0,
  is_active: true, is_visible: true, features: {},
}

const FEATURE_KEYS = [
  { key: 'whatsapp', label: 'الإرسال عبر واتساب' },
  { key: 'batch', label: 'الإصدار الجماعي' },
  { key: 'templates', label: 'القوالب المتقدّمة' },
  { key: 'priority_support', label: 'دعم ذو أولوية' },
]

export default function Products({ can }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState({ kind: '', active: '', q: '' })
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [dragId, setDragId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setItems(await api.products(filter)) } catch (e) { setError(e) } finally { setLoading(false) }
  }, [filter])

  useEffect(() => { load() }, [load])

  const openNew = () => { setForm(EMPTY); setEditing('new') }
  const openEdit = (p) => {
    setForm({
      name: p.name, description: p.description || '', kind: p.kind,
      billing_cycle: p.billing_cycle || 'monthly', price: p.price,
      currency: p.currency, credits_granted: p.credits_granted,
      trial_days: p.trial_days, is_active: p.is_active, is_visible: p.is_visible,
      features: p.features || {},
    })
    setEditing(p)
  }

  const [save, saving] = useAsync(async () => {
    const payload = {
      ...form,
      price: Number(form.price) || 0,
      credits_granted: parseInt(form.credits_granted, 10) || 0,
      trial_days: parseInt(form.trial_days, 10) || 0,
    }
    if (payload.kind === 'credit_pack') payload.billing_cycle = null
    try {
      if (editing === 'new') await api.createProduct(payload)
      else await api.updateProduct(editing.id, payload)
      toast(editing === 'new' ? 'تم إنشاء المنتج' : 'تم حفظ التعديلات — تسري على الطلبات الجديدة', 'success')
      setEditing(null)
      load()
    } catch (e) { toast(e.message, 'error') }
  })

  const [doDelete, deleting] = useAsync(async (reason) => {
    try {
      await api.deleteProduct(confirmDelete.id, reason)
      toast('تم حذف المنتج — الطلبات السابقة عليه تبقى سليمة', 'success')
      setConfirmDelete(null); load()
    } catch (e) { toast(e.message, 'error') }
  })

  const toggle = async (p, field) => {
    try {
      await api.updateProduct(p.id, { [field]: !p[field] })
      toast(field === 'is_active'
        ? (!p.is_active ? 'المنتج متاح للشراء الآن' : 'المنتج لم يعد متاحاً للشراء')
        : (!p.is_visible ? 'المنتج ظاهر للعملاء الآن' : 'المنتج مخفي عن العملاء'), 'success')
      load()
    } catch (e) { toast(e.message, 'error') }
  }

  const onDrop = async (targetId) => {
    if (!dragId || dragId === targetId) return
    const ids = items.map((p) => p.id)
    const from = ids.indexOf(dragId)
    const to = ids.indexOf(targetId)
    ids.splice(to, 0, ids.splice(from, 1)[0])
    setDragId(null)
    try { await api.reorderProducts(ids); toast('تم حفظ الترتيب', 'success'); load() }
    catch (e) { toast(e.message, 'error') }
  }

  const writable = can('products:write')

  return (
    <>
      <div className={s.pageHead}>
        <div>
          <h1 className={s.pageTitle}>المنتجات والأسعار</h1>
          <p className={s.pageSub}>
            تعديل السعر أو الأرصدة يسري فوراً على الطلبات الجديدة. الطلبات السابقة تحتفظ بقيمها الأصلية.
          </p>
        </div>
        {writable && (
          <div className={s.pageActions}>
            <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={openNew}>+ منتج جديد</button>
          </div>
        )}
      </div>

      <div className={s.filters}>
        <input className={`${s.input} ${s.inputGrow}`} placeholder="ابحث بالاسم…"
          value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} />
        <select className={s.select} value={filter.kind}
          onChange={(e) => setFilter({ ...filter, kind: e.target.value })}>
          <option value="">كل الأنواع</option>
          <option value="subscription">اشتراكات</option>
          <option value="credit_pack">حزم رصيد</option>
        </select>
        <select className={s.select} value={filter.active}
          onChange={(e) => setFilter({ ...filter, active: e.target.value })}>
          <option value="">الكل</option>
          <option value="true">مفعّل</option>
          <option value="false">معطّل</option>
        </select>
      </div>

      <ErrorBox error={error} onRetry={load} />

      <Panel flush>
        {loading ? <Loading /> : items.length === 0 ? (
          <Empty
            icon="📦" title="لا توجد منتجات بعد"
            text="أنشئ أول باقة أو حزمة رصيد لتبدأ البيع. تستطيع تعديل السعر والأرصدة لاحقاً من هنا بلا تعديل كود."
            action={writable && (
              <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={openNew}>
                إنشاء أول منتج
              </button>
            )}
          />
        ) : (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  {writable && <th style={{ width: 30 }} />}
                  <th>المنتج</th>
                  <th>النوع</th>
                  <th>السعر</th>
                  <th>الأرصدة</th>
                  <th>مشتركون</th>
                  <th>الإيراد</th>
                  <th>الحالة</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id}
                    className={writable ? s.dragRow : undefined}
                    draggable={writable}
                    onDragStart={() => setDragId(p.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => onDrop(p.id)}
                  >
                    {writable && <td className={s.dragHandle}>⠿</td>}
                    <td>
                      <div style={{ fontWeight: 600 }}>{p.name}</div>
                      {p.description && (
                        <div style={{ fontSize: '0.76rem', color: '#94a3b8' }}>{p.description}</div>
                      )}
                    </td>
                    <td>
                      {p.kind === 'subscription'
                        ? <Badge tone="blue">اشتراك {
                          { monthly: 'شهري', quarterly: 'ربعي', annual: 'سنوي', lifetime: 'مدى الحياة' }[p.billing_cycle] || ''
                        }</Badge>
                        : <Badge tone="gray">حزمة رصيد</Badge>}
                    </td>
                    <td className={s.num}>{fmtMoney(p.price, p.currency)}</td>
                    <td className={s.num}>{fmtNum(p.credits_granted)}</td>
                    <td className={s.num}>{fmtNum(p.stats?.active_subscribers || 0)}</td>
                    <td className={s.num}>{fmtMoney(p.stats?.revenue || 0, p.currency)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <Badge tone={p.is_active ? 'green' : 'red'}>
                          {p.is_active ? 'متاح' : 'موقوف'}
                        </Badge>
                        {p.is_active && !p.is_visible && <Badge tone="amber">مخفي</Badge>}
                      </div>
                    </td>
                    <td>
                      <div className={s.rowActions}>
                        {writable && (
                          <>
                            <button type="button" className={`${s.btn} ${s.btnGhost} ${s.btnSm}`}
                              onClick={() => openEdit(p)}>تعديل</button>
                            <button type="button" className={`${s.btn} ${s.btnGhost} ${s.btnSm}`}
                              onClick={() => toggle(p, 'is_active')}>
                              {p.is_active ? 'إيقاف' : 'تفعيل'}
                            </button>
                            <button type="button" className={`${s.btn} ${s.btnGhost} ${s.btnSm}`}
                              onClick={() => toggle(p, 'is_visible')}>
                              {p.is_visible ? 'إخفاء' : 'إظهار'}
                            </button>
                          </>
                        )}
                        {can('products:delete') && (
                          <button type="button" className={`${s.btn} ${s.btnDanger} ${s.btnSm}`}
                            onClick={() => setConfirmDelete(p)}>حذف</button>
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

      <Modal
        open={!!editing}
        title={editing === 'new' ? 'منتج جديد' : `تعديل: ${editing?.name || ''}`}
        onClose={() => setEditing(null)}
        wide
        footer={(
          <>
            <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={save} disabled={saving}>
              {saving ? 'جارٍ الحفظ…' : 'حفظ'}
            </button>
            <button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={() => setEditing(null)}>إلغاء</button>
          </>
        )}
      >
        {editing !== 'new' && (
          <div className={s.infoBox}>
            التعديل يسري على الطلبات الجديدة فقط. الطلبات السابقة تحتفظ بالسعر والأرصدة التي اشتُريت بها.
          </div>
        )}

        <div className={s.formGrid}>
          <Field label="اسم المنتج" required full>
            <input className={s.input} value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>

          <Field label="الوصف" full>
            <input className={s.input} value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>

          <Field label="النوع" required>
            <select className={s.select} value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              <option value="credit_pack">حزمة رصيد (شراء لمرة واحدة)</option>
              <option value="subscription">اشتراك (متكرر)</option>
            </select>
          </Field>

          {form.kind === 'subscription' && (
            <Field label="دورة الفوترة" required>
              <select className={s.select} value={form.billing_cycle}
                onChange={(e) => setForm({ ...form, billing_cycle: e.target.value })}>
                <option value="monthly">شهري</option>
                <option value="quarterly">ربع سنوي</option>
                <option value="annual">سنوي</option>
                <option value="lifetime">مدى الحياة</option>
              </select>
            </Field>
          )}

          <Field label="السعر" required hint="بالعملة المحدّدة">
            <input className={s.input} type="number" min="0" step="0.01" value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })} />
          </Field>

          <Field label="العملة">
            <input className={s.input} maxLength={3} value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} />
          </Field>

          <Field label="الأرصدة الممنوحة" required
            hint={form.kind === 'subscription' ? 'تُمنح كل دورة فوترة' : 'تُمنح مرة واحدة عند الشراء'}>
            <input className={s.input} type="number" min="0" value={form.credits_granted}
              onChange={(e) => setForm({ ...form, credits_granted: e.target.value })} />
          </Field>

          {form.kind === 'subscription' && (
            <Field label="أيام التجربة" hint="0 = بلا فترة تجريبية">
              <input className={s.input} type="number" min="0" value={form.trial_days}
                onChange={(e) => setForm({ ...form, trial_days: e.target.value })} />
            </Field>
          )}

          <Field label="المزايا المفعّلة" full hint="يقرؤها التطبيق للسماح بالميزات">
            <div className={s.permList}>
              {FEATURE_KEYS.map((f) => (
                <label key={f.key} className={s.checkRow}>
                  <input type="checkbox" checked={!!form.features[f.key]}
                    onChange={(e) => setForm({
                      ...form, features: { ...form.features, [f.key]: e.target.checked },
                    })} />
                  {f.label}
                </label>
              ))}
            </div>
          </Field>

          <Field full>
            <label className={s.checkRow}>
              <input type="checkbox" checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              متاح للشراء
            </label>
            <label className={s.checkRow}>
              <input type="checkbox" checked={form.is_visible}
                onChange={(e) => setForm({ ...form, is_visible: e.target.checked })} />
              يظهر للعملاء في صفحة الباقات
            </label>
          </Field>
        </div>
      </Modal>

      <Confirm
        open={!!confirmDelete}
        title="حذف المنتج"
        message={`سيُحذف «${confirmDelete?.name}» ولن يظهر للعملاء. الطلبات السابقة عليه تبقى سليمة بقيمها الأصلية.`}
        confirmLabel="حذف" danger requireReason busy={deleting}
        onConfirm={doDelete} onCancel={() => setConfirmDelete(null)}
      />
    </>
  )
}
