// الإعدادات التشغيلية — الشاشة التي تجعل اللوحة مركز تحكّم فعلياً.
//
// كل مفتاح يعرض «تستعمله: …» — اسم الخدمة التي تقرأ القيمة على الخادم. هذا
// ليس زينة توثيقية: إعداد قابل للتعديل ولا يقرأه شيء يخدع المشغّل ويجعله
// يظنّ أنه غيّر سلوكاً. عرض المستهلك يجعل الوعد قابلاً للتحقّق.

import { useState, useEffect, useCallback } from 'react'
import s from '../console.module.css'
import { api, toast } from '../api'
import { Panel, Loading, ErrorBox, Badge, Field, useAsync } from '../components/ui'

const GROUP_LABELS = {
  support: '📞 دعم العملاء',
  payment: '💳 الدفع والتحويل',
  credits: '💰 اقتصاد الأرصدة',
  referral: '🔗 الإحالة',
  fraud: '🛡️ كشف الاحتيال',
  ops: '⚙️ التشغيل',
}

const GROUP_NOTES = {
  support: 'تظهر للعملاء في واجهة الموقع فوراً بعد الحفظ.',
  payment: 'يراها العميل بعد إنشاء الطلب وقبل اعتماد الدفع.',
  credits: 'تسري على العمليات اللاحقة. العمليات السابقة لا تتأثّر.',
  referral: 'تسري على الإحالات الجديدة. الإحالات الجارية تحتفظ بشروطها.',
  fraud: 'العتبات فقط قابلة للضبط. أوزان الإشارات في الكود عمداً.',
  ops: 'مفاتيح تشغيلية تؤثّر على سلوك المنصة مباشرة.',
}

export default function Settings({ can }) {
  const [groups, setGroups] = useState({})
  const [draft, setDraft] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeGroup, setActiveGroup] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const data = await api.settings()
      setGroups(data)
      setDraft({})
      if (!activeGroup) setActiveGroup(Object.keys(data)[0] || null)
    } catch (e) { setError(e) } finally { setLoading(false) }
  }, [activeGroup])

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const setValue = (key, value) => setDraft({ ...draft, [key]: value })

  const dirty = Object.keys(draft).length > 0

  const [save, saving] = useAsync(async () => {
    try {
      const res = await api.updateSettings(draft)
      setGroups(res.settings); setDraft({})
      if (res.clamped?.length) {
        toast(`حُفظت. قُصّت ${res.clamped.length} قيمة عند الحد المسموح`, 'warning')
      } else {
        toast('تم الحفظ — الإعدادات سارية فوراً', 'success')
      }
    } catch (e) { toast(e.message, 'error') }
  })

  const writable = can('settings:write')

  const renderInput = (item) => {
    const value = draft[item.key] !== undefined ? draft[item.key] : item.value

    if (item.type === 'boolean') {
      return (
        <label className={s.checkRow}>
          <input type="checkbox" checked={!!value} disabled={!writable}
            onChange={(e) => setValue(item.key, e.target.checked)} />
          {value ? 'مفعّل' : 'معطّل'}
        </label>
      )
    }

    if (item.type === 'text') {
      return (
        <textarea className={s.textarea} value={value ?? ''} disabled={!writable}
          maxLength={item.maxLength}
          onChange={(e) => setValue(item.key, e.target.value)} />
      )
    }

    if (item.type === 'integer' || item.type === 'decimal') {
      return (
        <input className={s.input} type="number" value={value ?? ''} disabled={!writable}
          min={item.min} max={item.max}
          step={item.type === 'decimal' ? '0.01' : '1'}
          onChange={(e) => setValue(item.key, e.target.value)} />
      )
    }

    return (
      <input className={s.input} value={value ?? ''} disabled={!writable}
        maxLength={item.maxLength}
        onChange={(e) => setValue(item.key, e.target.value)} />
    )
  }

  if (loading) return <Loading />

  return (
    <>
      <div className={s.pageHead}>
        <div>
          <h1 className={s.pageTitle}>الإعدادات التشغيلية</h1>
          <p className={s.pageSub}>
            القيم تُحفظ في قاعدة البيانات وتقرؤها الخدمات في العملية التالية مباشرة — بلا تعديل كود ولا إعادة نشر.
          </p>
        </div>
        {writable && (
          <div className={s.pageActions}>
            <button type="button" className={`${s.btn} ${s.btnPrimary}`}
              onClick={save} disabled={!dirty || saving}>
              {saving ? 'جارٍ الحفظ…' : dirty ? `حفظ (${Object.keys(draft).length})` : 'لا تغييرات'}
            </button>
            {dirty && (
              <button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={() => setDraft({})}>
                تراجع
              </button>
            )}
          </div>
        )}
      </div>

      <ErrorBox error={error} onRetry={load} />

      {!writable && (
        <div className={s.infoBox}>لديك صلاحية العرض فقط. تعديل الإعدادات يحتاج صلاحية «تعديل الإعدادات التشغيلية».</div>
      )}

      <div className={s.tabs}>
        {Object.keys(groups).map((g) => (
          <button key={g} type="button"
            className={`${s.tab} ${activeGroup === g ? s.tabActive : ''}`}
            onClick={() => setActiveGroup(g)}>
            {GROUP_LABELS[g] || g}
          </button>
        ))}
      </div>

      {activeGroup && groups[activeGroup] && (
        <Panel title={GROUP_LABELS[activeGroup] || activeGroup}>
          {GROUP_NOTES[activeGroup] && (
            <div className={s.infoBox}>{GROUP_NOTES[activeGroup]}</div>
          )}

          <div className={s.formGrid}>
            {groups[activeGroup].map((item) => (
              <Field
                key={item.key}
                full={item.type === 'text' || item.maxLength > 200}
                label={(
                  <>
                    {item.label}
                    {item.public && <Badge tone="blue">يراه العميل</Badge>}
                  </>
                )}
                hint={(
                  <>
                    {item.hint && <>{item.hint}<br /></>}
                    {(item.min !== undefined || item.max !== undefined) && (
                      <>المدى المسموح: {item.min ?? '—'} إلى {item.max ?? '—'}<br /></>
                    )}
                    <span style={{ color: '#cbd5e1' }}>تستعمله: {item.usedBy}</span>
                  </>
                )}
              >
                {renderInput(item)}
                {draft[item.key] !== undefined && draft[item.key] !== item.value && (
                  <span style={{ fontSize: '0.72rem', color: '#d97706' }}>
                    غير محفوظ — كان: {String(item.value || '—')}
                  </span>
                )}
              </Field>
            ))}
          </div>
        </Panel>
      )}
    </>
  )
}
