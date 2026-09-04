// الفريق والصلاحيات — تركيب الأدوار وإسنادها.
// مفردات الصلاحيات تأتي من الخادم: قائمة ثابتة كل عنصر فيها مربوط بمسار
// حقيقي يفحصه. لا يستطيع الأدمن اختراع صلاحية لا يفحصها شيء.

import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import s from '../console.module.css'
import { api, toast } from '../api'
import {
  Panel, Loading, ErrorBox, Empty, Badge, Modal, Confirm, Field,
  useAsync, fmtNum,
} from '../components/ui'

export default function Team({ can }) {
  const [tab, setTab] = useState('members')
  const [roles, setRoles] = useState([])
  const [members, setMembers] = useState([])
  const [vocab, setVocab] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', description: '', permissions: [] })
  const [confirmDelete, setConfirmDelete] = useState(null)

  const [assigning, setAssigning] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [userResults, setUserResults] = useState([])
  const [assignForm, setAssignForm] = useState({ user_id: null, user_name: '', role_id: '' })

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [r, m, v] = await Promise.all([api.roles(), api.teamMembers(), api.permissionVocabulary()])
      setRoles(r); setMembers(m); setVocab(v)
    } catch (e) { setError(e) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const searchUser = async (term) => {
    setUserSearch(term)
    if (term.trim().length < 2) { setUserResults([]); return }
    try { setUserResults(await api.searchMembers(term.trim())) } catch { setUserResults([]) }
  }

  const [save, saving] = useAsync(async () => {
    try {
      if (editing === 'new') await api.createRole(form)
      else await api.updateRole(editing.id, form)
      toast('تم الحفظ — الصلاحيات تسري فوراً على الطلبات التالية', 'success')
      setEditing(null); load()
    } catch (e) { toast(e.message, 'error') }
  })

  const [doDelete, deleting] = useAsync(async () => {
    try {
      await api.deleteRole(confirmDelete.id)
      toast('تم حذف الدور', 'success'); setConfirmDelete(null); load()
    } catch (e) { toast(e.message, 'error') }
  })

  const [doAssign, assignBusy] = useAsync(async () => {
    try {
      await api.assignRole(assignForm.user_id, Number(assignForm.role_id))
      toast('تم إسناد الدور', 'success')
      setAssigning(false); setAssignForm({ user_id: null, user_name: '', role_id: '' })
      setUserSearch(''); setUserResults([]); load()
    } catch (e) { toast(e.message, 'error') }
  })

  const revoke = async (userId, roleId) => {
    try { await api.revokeRole(userId, roleId); toast('تم سحب الدور', 'success'); load() }
    catch (e) { toast(e.message, 'error') }
  }

  const togglePerm = (key) => setForm({
    ...form,
    permissions: form.permissions.includes(key)
      ? form.permissions.filter((p) => p !== key)
      : [...form.permissions, key],
  })

  const toggleGroup = (keys) => {
    const allOn = keys.every((k) => form.permissions.includes(k))
    setForm({
      ...form,
      permissions: allOn
        ? form.permissions.filter((p) => !keys.includes(p))
        : [...new Set([...form.permissions, ...keys])],
    })
  }

  const openNew = () => { setForm({ name: '', description: '', permissions: [] }); setEditing('new') }
  const openEdit = (r) => {
    setForm({ name: r.name, description: r.description || '', permissions: r.permissions || [] })
    setEditing(r)
  }

  const writable = can('roles:write')

  return (
    <>
      <div className={s.pageHead}>
        <div>
          <h1 className={s.pageTitle}>الفريق والصلاحيات</h1>
          <p className={s.pageSub}>
            التحقّق من الصلاحيات يقع على الخادم في كل طلب. إخفاء الأزرار راحة للمستخدم لا حماية.
          </p>
        </div>
        {writable && (
          <div className={s.pageActions}>
            <button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={() => setAssigning(true)}>
              إسناد دور
            </button>
            <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={openNew}>+ دور جديد</button>
          </div>
        )}
      </div>

      <div className={s.tabs}>
        <button type="button" className={`${s.tab} ${tab === 'members' ? s.tabActive : ''}`}
          onClick={() => setTab('members')}>أعضاء الفريق ({members.length})</button>
        <button type="button" className={`${s.tab} ${tab === 'roles' ? s.tabActive : ''}`}
          onClick={() => setTab('roles')}>الأدوار ({roles.length})</button>
      </div>

      <ErrorBox error={error} onRetry={load} />

      {tab === 'members' && (
        <Panel flush>
          {loading ? <Loading /> : members.length === 0 ? (
            <Empty icon="👥" title="لا أعضاء في الفريق بعد"
              text="أسند دوراً لمستخدم ليصل إلى كونسول النمو. مدير النظام يصل دائماً بلا إسناد."
              action={writable && (
                <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={() => setAssigning(true)}>
                  إسناد أول دور
                </button>
              )} />
          ) : (
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead><tr><th>العضو</th><th>البريد</th><th>الأدوار</th><th>عدد الصلاحيات</th><th /></tr></thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <Link to={`/growth/members/${m.id}`} style={{ color: '#2563eb', fontWeight: 600 }}>
                          {m.name}
                        </Link>
                      </td>
                      <td style={{ fontSize: '0.8rem' }}>{m.email}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {m.roles.map((r) => (
                            <span key={r.id}>
                              <Badge tone="blue">{r.name}</Badge>
                              {writable && (
                                <button type="button" className={s.modalClose}
                                  style={{ fontSize: '0.9rem', marginInlineStart: 2 }}
                                  title="سحب الدور"
                                  onClick={() => revoke(m.id, r.id)}>×</button>
                              )}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className={s.num}>{m.permissions.length}</td>
                      <td />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {tab === 'roles' && (
        <Panel flush>
          {loading ? <Loading /> : (
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead><tr><th>الدور</th><th>الوصف</th><th>الصلاحيات</th><th>الأعضاء</th><th /></tr></thead>
                <tbody>
                  {roles.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{r.name}</div>
                        {r.is_system && <Badge tone="gray">نظامي</Badge>}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: '#64748b', maxWidth: 260 }}>{r.description}</td>
                      <td className={s.num}>{r.permissions?.length || 0}</td>
                      <td className={s.num}>{fmtNum(r.members)}</td>
                      <td>
                        <div className={s.rowActions}>
                          {writable && (
                            <button type="button" className={`${s.btn} ${s.btnGhost} ${s.btnSm}`}
                              onClick={() => openEdit(r)}>
                              {r.is_system ? 'عرض' : 'تعديل'}
                            </button>
                          )}
                          {writable && !r.is_system && (
                            <button type="button" className={`${s.btn} ${s.btnDanger} ${s.btnSm}`}
                              onClick={() => setConfirmDelete(r)}>حذف</button>
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

      <Modal open={!!editing} wide
        title={editing === 'new' ? 'دور جديد' : `${editing?.is_system ? 'عرض' : 'تعديل'}: ${editing?.name || ''}`}
        onClose={() => setEditing(null)}
        footer={(
          <>
            <button type="button" className={`${s.btn} ${s.btnPrimary}`}
              onClick={save} disabled={saving || !form.name.trim()}>
              {saving ? 'جارٍ الحفظ…' : 'حفظ'}
            </button>
            <button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={() => setEditing(null)}>إلغاء</button>
          </>
        )}
      >
        {editing?.is_system && (
          <div className={s.infoBox}>
            دور نظامي: تستطيع تعديل اسمه ووصفه، لكن صلاحياته تتبع الكود وتُحدَّث مع كل نشر.
            هذا يمنع تجريد آخر دور يملك إدارة الصلاحيات فيُقفَل الجميع خارج النظام.
          </div>
        )}

        <div className={s.formGrid} style={{ marginBottom: '1rem' }}>
          <Field label="اسم الدور" required>
            <input className={s.input} value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="الوصف">
            <input className={s.input} value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
        </div>

        <div className={s.label} style={{ marginBottom: '0.5rem' }}>
          الصلاحيات ({form.permissions.length})
        </div>

        <div className={s.permGroups}>
          {Object.entries(vocab).map(([group, perms]) => {
            const keys = perms.map((p) => p.key)
            const on = keys.filter((k) => form.permissions.includes(k)).length
            return (
              <div key={group} className={s.permGroup}>
                <div className={s.permGroupTitle}>
                  <span>{group} ({on}/{keys.length})</span>
                  {!editing?.is_system && (
                    <button type="button" className={`${s.btn} ${s.btnGhost} ${s.btnSm}`}
                      onClick={() => toggleGroup(keys)}>
                      {on === keys.length ? 'إلغاء الكل' : 'تحديد الكل'}
                    </button>
                  )}
                </div>
                <div className={s.permList}>
                  {perms.map((p) => (
                    <label key={p.key} className={s.checkRow}>
                      <input type="checkbox" disabled={editing?.is_system}
                        checked={form.permissions.includes(p.key)}
                        onChange={() => togglePerm(p.key)} />
                      {p.label}
                    </label>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </Modal>

      <Modal open={assigning} title="إسناد دور لمستخدم" onClose={() => setAssigning(false)}
        footer={(
          <>
            <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={doAssign}
              disabled={assignBusy || !assignForm.user_id || !assignForm.role_id}>
              {assignBusy ? 'جارٍ الإسناد…' : 'إسناد'}
            </button>
            <button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={() => setAssigning(false)}>إلغاء</button>
          </>
        )}
      >
        <Field label="المستخدم" required>
          <input className={s.input} value={userSearch}
            onChange={(e) => searchUser(e.target.value)}
            placeholder="ابحث بالاسم أو البريد…" />
          {userResults.length > 0 && (
            <div style={{ border: '1px solid #e4e9f2', borderRadius: 8, marginTop: 4, maxHeight: 170, overflowY: 'auto' }}>
              {userResults.map((u) => (
                <div key={u.id} className={s.searchRow}
                  onClick={() => {
                    setAssignForm({ ...assignForm, user_id: u.id, user_name: u.name })
                    setUserSearch(u.name); setUserResults([])
                  }}>
                  <span className={s.searchName}>{u.name}</span>
                  <span className={s.searchMeta}>{u.email}</span>
                </div>
              ))}
            </div>
          )}
        </Field>

        <Field label="الدور" required>
          <select className={s.select} value={assignForm.role_id}
            onChange={(e) => setAssignForm({ ...assignForm, role_id: e.target.value })}>
            <option value="">— اختر دوراً —</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.name} ({r.permissions?.length || 0} صلاحية)</option>
            ))}
          </select>
        </Field>
      </Modal>

      <Confirm open={!!confirmDelete} title="حذف الدور"
        message={`سيُحذف «${confirmDelete?.name}» ويُسحب من ${fmtNum(confirmDelete?.members || 0)} عضو. سيفقدون صلاحياته فوراً.`}
        confirmLabel="حذف" danger busy={deleting}
        onConfirm={doDelete} onCancel={() => setConfirmDelete(null)} />
    </>
  )
}
