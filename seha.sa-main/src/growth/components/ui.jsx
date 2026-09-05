// مكوّنات مشتركة للكونسول. مبنية حول ما يحتاجه المشغّل فعلاً: جدول له حالة
// فارغة مفيدة، وتأكيد يفرض سبباً حين تكون العملية مالية، ونافذة لا تُغلق
// بالخطأ أثناء الكتابة.

import { useState, useEffect, useRef } from 'react'
import s from '../console.module.css'

export function Stat({ label, value, foot, trend, northStar = false }) {
  return (
    <div className={`${s.stat} ${northStar ? s.northStar : ''}`}>
      <div className={s.statLabel}>{label}</div>
      <div className={s.statValue}>{value}</div>
      {(foot || trend !== undefined && trend !== null) && (
        <div className={s.statFoot}>
          {trend !== undefined && trend !== null && (
            <span className={trend >= 0 ? s.statUp : s.statDown}>
              {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%
            </span>
          )}
          {trend !== undefined && trend !== null && foot ? ' · ' : ''}
          {foot}
        </div>
      )}
    </div>
  )
}

export function Badge({ tone = 'gray', children }) {
  const map = {
    green: s.badgeGreen, red: s.badgeRed, amber: s.badgeAmber,
    blue: s.badgeBlue, gray: s.badgeGray,
  }
  return <span className={`${s.badge} ${map[tone] || s.badgeGray}`}>{children}</span>
}

export function Panel({ title, actions, children, flush = false }) {
  return (
    <section className={s.panel}>
      {(title || actions) && (
        <header className={s.panelHead}>
          {title && <h2 className={s.panelTitle}>{title}</h2>}
          {actions && <div className={s.pageActions}>{actions}</div>}
        </header>
      )}
      <div className={flush ? s.panelBodyFlush : s.panelBody}>{children}</div>
    </section>
  )
}

/** حالة فارغة تشرح ما الذي يجب فعله، لا مجرد «لا توجد بيانات». */
export function Empty({ icon = '📭', title, text, action }) {
  return (
    <div className={s.empty}>
      <div className={s.emptyIcon}>{icon}</div>
      <div className={s.emptyTitle}>{title}</div>
      {text && <div className={s.emptyText}>{text}</div>}
      {action}
    </div>
  )
}

export function Loading({ text = 'جارٍ التحميل…' }) {
  return <div className={s.loading}>{text}</div>
}

export function ErrorBox({ error, onRetry }) {
  if (!error) return null
  return (
    <div className={s.errorBox}>
      {error.message || String(error)}
      {onRetry && (
        <button type="button" className={`${s.btn} ${s.btnGhost} ${s.btnSm}`}
          style={{ marginInlineStart: '0.75rem' }} onClick={onRetry}>
          إعادة المحاولة
        </button>
      )}
    </div>
  )
}

/** نافذة: تُغلق بـ Escape وبالنقر خارجها، لا بالنقر داخلها. */
export function Modal({ open, title, onClose, children, footer, wide = false }) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className={s.overlay} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}>
      <div className={`${s.modal} ${wide ? s.modalWide : ''}`} role="dialog" aria-modal="true">
        <header className={s.modalHead}>
          <h3 className={s.modalTitle}>{title}</h3>
          <button type="button" className={s.modalClose} onClick={onClose} aria-label="إغلاق">×</button>
        </header>
        <div className={s.modalBody}>{children}</div>
        {footer && <footer className={s.modalFoot}>{footer}</footer>}
      </div>
    </div>
  )
}

/**
 * تأكيد. حين requireReason يكون الزر معطّلاً حتى يُكتب سبب — لأن الخادم
 * سيرفض بدونه على أي حال، والرفض بعد الضغط تجربة أسوأ من زر معطّل واضح.
 */
export function Confirm({
  open, title, message, confirmLabel = 'تأكيد', danger = false,
  requireReason = false, reasonLabel = 'السبب', onConfirm, onCancel, busy = false,
}) {
  const [reason, setReason] = useState('')
  useEffect(() => { if (open) setReason('') }, [open])

  const blocked = requireReason && reason.trim().length < 3

  return (
    <Modal
      open={open} title={title} onClose={busy ? undefined : onCancel}
      footer={(
        <>
          <button type="button" disabled={blocked || busy}
            className={`${s.btn} ${danger ? s.btnDanger : s.btnPrimary}`}
            onClick={() => onConfirm(reason)}>
            {busy ? 'جارٍ التنفيذ…' : confirmLabel}
          </button>
          <button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={onCancel} disabled={busy}>
            إلغاء
          </button>
        </>
      )}
    >
      {message && <p style={{ margin: '0 0 1rem', color: '#334155', fontSize: '0.9rem' }}>{message}</p>}
      {requireReason && (
        <div className={s.field}>
          <label className={s.label}>{reasonLabel} <span className={s.required}>*</span></label>
          <textarea className={s.textarea} value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="اكتب سبباً واضحاً — يُسجَّل في سجل التدقيق ولا يمكن تعديله لاحقاً" />
          {blocked && <span className={s.hint}>السبب مطلوب (3 أحرف على الأقل)</span>}
        </div>
      )}
    </Modal>
  )
}

export function Field({ label, hint, required, full, children }) {
  return (
    <div className={`${s.field} ${full ? s.fieldFull : ''}`}>
      {label && (
        <label className={s.label}>
          {label} {required && <span className={s.required}>*</span>}
        </label>
      )}
      {children}
      {hint && <span className={s.hint}>{hint}</span>}
    </div>
  )
}

export function Pagination({ page, pages, total, onChange }) {
  if (!pages || pages <= 1) return null
  return (
    <div className={s.pagination}>
      <span>صفحة {page} من {pages} — {total} سجلاً</span>
      <div className={s.pageBtns}>
        <button type="button" className={`${s.btn} ${s.btnGhost} ${s.btnSm}`}
          disabled={page <= 1} onClick={() => onChange(page - 1)}>السابق</button>
        <button type="button" className={`${s.btn} ${s.btnGhost} ${s.btnSm}`}
          disabled={page >= pages} onClick={() => onChange(page + 1)}>التالي</button>
      </div>
    </div>
  )
}

/** رسم أعمدة بسيط بلا مكتبة — البيانات يومية وقليلة. */
export function BarChart({ data, valueKey = 'revenue', labelKey = 'day' }) {
  if (!data?.length) return <Empty icon="📊" title="لا توجد بيانات بعد" text="ستظهر هنا فور تسجيل أول عملية" />
  const max = Math.max(...data.map((d) => Number(d[valueKey]) || 0), 1)
  const fmt = (d) => {
    const date = new Date(d)
    return Number.isNaN(date.getTime()) ? String(d) : `${date.getDate()}/${date.getMonth() + 1}`
  }
  return (
    <>
      <div className={s.chart}>
        {data.map((d, i) => (
          <div key={i} className={s.chartBar}
            style={{ height: `${((Number(d[valueKey]) || 0) / max) * 100}%` }}
            title={`${fmt(d[labelKey])} — ${Number(d[valueKey]).toLocaleString('ar')}`} />
        ))}
      </div>
      <div className={s.chartAxis}>
        <span>{fmt(data[0]?.[labelKey])}</span>
        <span>{fmt(data[data.length - 1]?.[labelKey])}</span>
      </div>
    </>
  )
}

/** قمع أفقي بنسب مئوية من القمة. */
export function Funnel({ stages }) {
  const top = Math.max(...stages.map((st) => st.value), 1)
  return (
    <div className={s.funnel}>
      {stages.map((st) => (
        <div key={st.key} className={s.funnelRow}>
          <span className={s.funnelLabel}>{st.label}</span>
          <div className={s.funnelBarWrap}>
            <div className={s.funnelBar} style={{ width: `${(st.value / top) * 100}%` }} />
          </div>
          <span className={s.funnelValue}>
            {st.value.toLocaleString('ar')}
            {top > 0 && <span style={{ color: '#94a3b8', fontWeight: 400 }}> · {Math.round((st.value / top) * 100)}%</span>}
          </span>
        </div>
      ))}
    </div>
  )
}

/** يمنع إرسالاً مكرراً أثناء انتظار الخادم. */
export function useAsync(fn) {
  const [busy, setBusy] = useState(false)
  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])

  const run = async (...args) => {
    if (busy) return undefined
    setBusy(true)
    try {
      return await fn(...args)
    } finally {
      if (mounted.current) setBusy(false)
    }
  }
  return [run, busy]
}

export const fmtMoney = (v, currency = 'SAR') =>
  `${(Number(v) || 0).toLocaleString('ar-SA', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${currency}`

export const fmtNum = (v) => (Number(v) || 0).toLocaleString('ar')

export const fmtDate = (v) => {
  if (!v) return '—'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('ar-SA', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

export const fmtDateTime = (v) => {
  if (!v) return '—'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? '—' : `${d.toLocaleDateString('ar-SA', {
    month: 'short', day: 'numeric',
  })} ${d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}`
}

export { s as styles }
