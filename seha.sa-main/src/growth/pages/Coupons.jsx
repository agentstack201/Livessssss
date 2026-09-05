// الكوبونات — إنشاء سريع بقوالب جاهزة، وأداء بجانب كل كود.
// الحاجز المعروض هنا يطابق ما يفرضه الخادم: كوبون بلا حدّ واحد على الأقل
// مرفوض، لأن ثلاثة حقول فارغة تصنع منحة لا نهائية.

import { useState, useEffect, useCallback } from 'react'
import s from '../console.module.css'
import { api, toast } from '../api'
import {
  Panel, Loading, ErrorBox, Empty, Badge, Modal, Confirm, Field,
  useAsync, fmtMoney, fmtNum, fmtDate, fmtDateTime, Stat,
} from '../components/ui'

const EMPTY = {
  code: '', name: '', discount_type: 'percentage', discount_value: '',
  max_discount_amount: '', min_purchase_amount: 0,
  usage_limit: '', per_user_limit: 1, require_new_user: false,
  valid_from: new Date().toISOString().slice(0, 10), valid_until: '', is_active: true,
}

/** قوالب سريعة — تملأ النموذج بحدود آمنة بدل صفحة فارغة. */
const PRESETS = [
  {
    label: 'خصم 20% لعملاء جدد',
    values: {
      discount_type: 'percentage', discount_value: 20, require_new_user: true,
      per_user_limit: 1, usage_limit: 100,
    },
  },
  {
    label: 'خصم ثابت 50',
    values: { discount_type: 'fixed_amount', discount_value: 50, per_user_limit: 1, usage_limit: 200 },
  },
  {
    label: 'منحة 100 رصيد',
    values: { discount_type: 'credit_grant', discount_value: 100, per_user_limit: 1, usage_limit: 50 },
  },
]

const TYPE_LABEL = {
  percentage: 'نسبة %', fixed_amount: 'مبلغ ثابت', credit_grant: 'منحة رصيد',
}

export default function Coupons({ can }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState({ q: '', active: '' })
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [detail, setDetail] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setItems(await api.coupons(filter)) } catch (e) { setError(e) } finally { setLoading(false) }
  }, [filter])

  useEffect(() => { load() }, [load])

  const openNew = () => { setForm(EMPTY); setEditing('new') }
  const openEdit = (c) => {
    setForm({
      code: c.code, name: c.name || '', discount_type: c.discount_type,
      discount_value: c.discount_value, max_discount_amount: c.max_discount_amount ?? '',
      min_purchase_amount: c.min_purchase_amount, usage_limit: c.usage_limit ?? '',
      per_user_limit: c.per_user_limit ?? '', require_new_user: c.require_new_user,
      valid_from: c.valid_from ? c.valid_from.slice(0, 10) : '',
      valid_until: c.valid_until ? c.valid_until.slice(0, 10) : '',
      is_active: c.is_active,
    })
    setEditing(c)
  }

  const noBound = !form.usage_limit && !form.per_user_limit && !form.valid_until

  const [save, saving] = useAsync(async () => {
    const payload = {
      ...form,
      discount_value: Number(form.discount_value) || 0,
      max_discount_amount: form.max_discount_amount === '' ? null : Number(form.max_discount_amount),
      min_purchase_amount: Number(form.min_purchase_amount) || 0,
      usage_limit: form.usage_limit === '' ? null : parseInt(form.usage_limit, 10),
      per_user_limit: form.per_user_limit === '' ? null : parseInt(form.per_user_limit, 10),
      valid_until: form.valid_until || null,
    }
    try {
      if (editing === 'new') await api.createCoupon(payload)
      else await api.updateCoupon(editing.id, payload)
      toast(editing === 'new' ? 'تم إنشاء الكوبون' : 'تم الحفظ — يسري على الاستخدامات الجديدة', 'success')
      setEditing(null); load()
    } catch (e) { toast(e.message, 'error') }
  })

  const [doDelete, deleting] = useAsync(async (reason) => {
    try {
      await api.deleteCoupon(confirmDelete.id, reason)
      toast('تم حذف الكوبون', 'success'); setConfirmDelete(null); load()
    } catch (e) { toast(e.message, 'error') }
  })

  const openDetail = async (c) => {
    try {
      const [full, reds] = await Promise.all([api.coupon(c.id), api.couponRedemptions(c.id)])
      setDetail({ ...full, redemptions: reds })
    } catch (e) { toast(e.message, 'error') }
  }

  const writable = can('coupons:write')
  const active = items.filter((c) => c.is_active && !c.is_expired).length
  const totalUses = items.reduce((sum, c) => sum + c.times_used, 0)

  return (
    <>
      <div className={s.pageHead}>
        <div>
          <h1 className={s.pageTitle}>الكوبونات</h1>
          <p className={s.pageSub}>الكوبون يغيّر سعر عملية شراء لحامله. لا يدفع لطرف ثالث ولا يتتبّع سلوكاً.</p>
        </div>
        {writable && (
          <div className={s.pageActions}>
            <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={openNew}>+ كوبون جديد</button>
          </div>
        )}
      </div>

      <div className={s.statGrid}>
        <Stat label="كوبونات فعّالة" value={fmtNum(active)} foot={`من ${fmtNum(items.length)}`} />
        <Stat label="إجمالي الاستخدامات" value={fmtNum(totalUses)} />
      </div>

      <div className={s.filters}>
        <input className={`${s.input} ${s.inputGrow}`} placeholder="ابحث بالرمز أو الاسم…"
          value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} />
        <select className={s.select} value={filter.active}
          onChange={(e) => setFilter({ ...filter, active: e.target.value })}>
          <option value="">الكل</option><option value="true">مفعّل</option><option value="false">معطّل</option>
        </select>
      </div>

      <ErrorBox error={error} onRetry={load} />

      <Panel flush>
        {loading ? <Loading /> : items.length === 0 ? (
          <Empty icon="🎟️" title="لا توجد كوبونات"
            text="أنشئ كوباناً من قالب جاهز أو من الصفر. كل كوبون يحتاج حدّاً واحداً على الأقل — سقف استخدام أو سقف لكل مستخدم أو تاريخ انتهاء."
            action={writable && (
              <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={openNew}>إنشاء أول كوبون</button>
            )} />
        ) : (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>الرمز</th><th>النوع</th><th>القيمة</th><th>الاستخدام</th>
                  <th>لكل مستخدم</th><th>الصلاحية</th><th>الحالة</th><th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className={s.mono} style={{ fontWeight: 700 }}>{c.code}</div>
                      {c.name && <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>{c.name}</div>}
                    </td>
                    <td style={{ fontSize: '0.8rem' }}>{TYPE_LABEL[c.discount_type]}</td>
                    <td className={s.num}>
                      {c.discount_type === 'percentage' ? `${Number(c.discount_value)}%`
                        : c.discount_type === 'credit_grant' ? `${fmtNum(c.discount_value)} رصيد`
                          : fmtMoney(c.discount_value)}
                    </td>
                    <td className={s.num}>
                      {fmtNum(c.times_used)}{c.usage_limit ? ` / ${fmtNum(c.usage_limit)}` : ''}
                      {c.usage_rate !== null && c.usage_rate >= 80 && (
                        <Badge tone="amber" style={{ marginInlineStart: 4 }}>{c.usage_rate}%</Badge>
                      )}
                    </td>
                    <td className={s.num}>{c.per_user_limit ?? '∞'}</td>
                    <td style={{ fontSize: '0.76rem' }}>
                      {c.valid_until ? fmtDate(c.valid_until) : 'بلا انتهاء'}
                    </td>
                    <td>
                      {c.is_expired ? <Badge tone="gray">منتهٍ</Badge>
                        : c.is_active ? <Badge tone="green">فعّال</Badge>
                          : <Badge tone="red">معطّل</Badge>}
                      {c.require_new_user && <Badge tone="blue">جدد فقط</Badge>}
                    </td>
                    <td>
                      <div className={s.rowActions}>
                        <button type="button" className={`${s.btn} ${s.btnGhost} ${s.btnSm}`}
                          onClick={() => openDetail(c)}>الأداء</button>
                        {writable && (
                          <button type="button" className={`${s.btn} ${s.btnGhost} ${s.btnSm}`}
                            onClick={() => openEdit(c)}>تعديل</button>
                        )}
                        {can('coupons:delete') && (
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

      <Modal
        open={!!editing} wide
        title={editing === 'new' ? 'كوبون جديد' : `تعديل: ${editing?.code || ''}`}
        onClose={() => setEditing(null)}
        footer={(
          <>
            <button type="button" className={`${s.btn} ${s.btnPrimary}`}
              onClick={save} disabled={saving || noBound}>
              {saving ? 'جارٍ الحفظ…' : 'حفظ'}
            </button>
            <button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={() => setEditing(null)}>إلغاء</button>
          </>
        )}
      >
        {editing === 'new' && (
          <div style={{ marginBottom: '1rem' }}>
            <div className={s.label} style={{ marginBottom: '0.4rem' }}>قوالب سريعة</div>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {PRESETS.map((p) => (
                <button key={p.label} type="button" className={`${s.btn} ${s.btnGhost} ${s.btnSm}`}
                  onClick={() => setForm({ ...form, ...p.values })}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {noBound && (
          <div className={s.warnBox}>
            الكوبون يحتاج حدّاً واحداً على الأقل: سقف استخدام كلّي، أو سقف لكل مستخدم،
            أو تاريخ انتهاء. بدونها يصبح منحة لا نهائية.
          </div>
        )}

        <div className={s.formGrid}>
          <Field label="الرمز" required hint="يُقارَن بلا حساسية لحالة الأحرف">
            <input className={s.input} value={form.code} disabled={editing !== 'new'}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
          </Field>
          <Field label="اسم داخلي" hint="لا يراه العميل">
            <input className={s.input} value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>

          <Field label="نوع الخصم" required>
            <select className={s.select} value={form.discount_type}
              onChange={(e) => setForm({ ...form, discount_type: e.target.value })}>
              <option value="percentage">نسبة مئوية</option>
              <option value="fixed_amount">مبلغ ثابت</option>
              <option value="credit_grant">منحة رصيد</option>
            </select>
          </Field>
          <Field label="القيمة" required>
            <input className={s.input} type="number" min="0" value={form.discount_value}
              onChange={(e) => setForm({ ...form, discount_value: e.target.value })} />
          </Field>

          {form.discount_type === 'percentage' && (
            <Field label="سقف الخصم" hint="يمنع خصماً هائلاً على طلب كبير">
              <input className={s.input} type="number" min="0" value={form.max_discount_amount}
                onChange={(e) => setForm({ ...form, max_discount_amount: e.target.value })} />
            </Field>
          )}
          <Field label="أدنى قيمة شراء">
            <input className={s.input} type="number" min="0" value={form.min_purchase_amount}
              onChange={(e) => setForm({ ...form, min_purchase_amount: e.target.value })} />
          </Field>

          <Field label="سقف الاستخدام الكلّي" hint="اتركه فارغاً لبلا سقف">
            <input className={s.input} type="number" min="1" value={form.usage_limit}
              onChange={(e) => setForm({ ...form, usage_limit: e.target.value })} />
          </Field>
          <Field label="السقف لكل مستخدم" hint="اتركه فارغاً لبلا سقف">
            <input className={s.input} type="number" min="1" value={form.per_user_limit}
              onChange={(e) => setForm({ ...form, per_user_limit: e.target.value })} />
          </Field>

          <Field label="يبدأ في">
            <input className={s.input} type="date" value={form.valid_from}
              onChange={(e) => setForm({ ...form, valid_from: e.target.value })} />
          </Field>
          <Field label="ينتهي في" hint="اتركه فارغاً لبلا انتهاء">
            <input className={s.input} type="date" value={form.valid_until}
              onChange={(e) => setForm({ ...form, valid_until: e.target.value })} />
          </Field>

          <Field full>
            <label className={s.checkRow}>
              <input type="checkbox" checked={form.require_new_user}
                onChange={(e) => setForm({ ...form, require_new_user: e.target.checked })} />
              للعملاء الجدد فقط (لم يدفعوا من قبل)
            </label>
            <label className={s.checkRow}>
              <input type="checkbox" checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              مفعّل
            </label>
          </Field>
        </div>
      </Modal>

      <Modal open={!!detail} wide title={`أداء: ${detail?.coupon?.code || ''}`}
        onClose={() => setDetail(null)}>
        {detail && (
          <>
            <div className={s.profileGrid}>
              <div className={s.profileStat}>
                <div className={s.profileStatLabel}>استخدامات</div>
                <div className={s.profileStatValue}>{fmtNum(detail.performance.redemptions)}</div>
              </div>
              <div className={s.profileStat}>
                <div className={s.profileStatLabel}>مستخدمون فريدون</div>
                <div className={s.profileStatValue}>{fmtNum(detail.performance.unique_users)}</div>
              </div>
              <div className={s.profileStat}>
                <div className={s.profileStatLabel}>إجمالي الخصم</div>
                <div className={s.profileStatValue}>{fmtMoney(detail.performance.total_discount)}</div>
              </div>
              <div className={s.profileStat}>
                <div className={s.profileStatLabel}>صافي الإيراد المتأثّر</div>
                <div className={s.profileStatValue}>{fmtMoney(detail.performance.net_revenue)}</div>
              </div>
            </div>

            {detail.redemptions.length === 0 ? (
              <Empty icon="📭" title="لم يُستخدم بعد" text="ستظهر هنا كل عملية استخدام." />
            ) : (
              <div className={s.tableWrap}>
                <table className={s.table}>
                  <thead>
                    <tr><th>المستخدم</th><th>قبل الخصم</th><th>الخصم</th><th>التاريخ</th></tr>
                  </thead>
                  <tbody>
                    {detail.redemptions.map((r) => (
                      <tr key={r.id}>
                        <td>{r.user?.name || `#${r.user_id}`}</td>
                        <td className={s.num}>{fmtMoney(r.original_amount)}</td>
                        <td className={s.num}>{fmtMoney(r.discount_applied)}</td>
                        <td style={{ fontSize: '0.76rem' }}>{fmtDateTime(r.createdAt)}</td>
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
        open={!!confirmDelete} title="حذف الكوبون"
        message={`سيُحذف «${confirmDelete?.code}». الاستخدامات السابقة والطلبات المرتبطة تبقى سليمة.`}
        confirmLabel="حذف" danger requireReason busy={deleting}
        onConfirm={doDelete} onCancel={() => setConfirmDelete(null)}
      />
    </>
  )
}
