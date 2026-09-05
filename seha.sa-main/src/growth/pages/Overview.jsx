// النظرة العامة — سطح قرار لا لوحة عدّادات.
//
// ثلاثة نطاقات بالترتيب: افعل ← انمُ ← اربح.
// «يحتاج إجراءك» فوق الطية ويحمل أزراراً، لأن السؤال الأول كل صباح هو «ما
// الذي يحتاج انتباهي؟» لا «كم الرقم؟». حالته الفارغة معلومة بحدّ ذاتها.

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import s from '../console.module.css'
import { api } from '../api'
import {
  Stat, Panel, Loading, ErrorBox, BarChart, Empty, Badge, fmtMoney, fmtNum,
} from '../components/ui'

export default function Overview() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setData(await api.overview(30)) } catch (e) { setError(e) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <Loading />
  if (error) return <ErrorBox error={error} onRetry={load} />
  if (!data) return null

  const { north_star: ns, leading, lagging, alerts = [], revenue_trend: trend = [] } = data
  const incentive = lagging.incentive_cost
  const warnRatio = incentive.ratio > 25

  return (
    <>
      <div className={s.pageHead}>
        <div>
          <h1 className={s.pageTitle}>نظرة عامة</h1>
          <p className={s.pageSub}>حالة الأعمال خلال آخر 30 يوماً</p>
        </div>
        <div className={s.pageActions}>
          <button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={load}>تحديث</button>
        </div>
      </div>

      {/* ── ١. يحتاج إجراءك ─────────────────────────────────────────────── */}
      <Panel title="⚡ يحتاج إجراءك الآن" flush>
        {alerts.length === 0 ? (
          <div className={s.emptyOk}>✓ لا شيء يحتاج انتباهك — كل الأنظمة سليمة</div>
        ) : (
          <div className={s.alertList}>
            {alerts.map((a) => (
              <div key={a.key} className={s.alert}>
                <span className={`${s.alertDot} ${
                  a.severity === 'critical' ? s.alertCritical
                    : a.severity === 'warning' ? s.alertWarning : s.alertInfo}`} />
                <span className={s.alertText}>{a.title}</span>
                <button type="button" className={`${s.btn} ${s.btnGhost} ${s.btnSm}`}
                  onClick={() => navigate(a.target)}>
                  {a.action}
                </button>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* ── ٢. هل ننمو؟ ─────────────────────────────────────────────────── */}
      <h2 className={s.panelTitle} style={{ margin: '1.5rem 0 0.75rem' }}>📈 هل ننمو؟</h2>

      <div className={s.statGrid}>
        <Stat
          northStar
          label="MAPU — مستخدمون دافعون نشطون"
          value={fmtNum(ns.value)}
          trend={ns.trend_pct}
          foot="النجم القطبي · دفع + استخدام"
        />
        <Stat
          label="معدّل التفعيل (7 أيام)"
          value={`${leading.activation_rate_7d.rate}%`}
          foot={`${fmtNum(leading.activation_rate_7d.activated)} من ${fmtNum(leading.activation_rate_7d.cohort)}`}
        />
        <Stat
          label="التحويل المدفوع (30 يوماً)"
          value={`${leading.paid_conversion_30d.rate}%`}
          foot={`${fmtNum(leading.paid_conversion_30d.converted)} من ${fmtNum(leading.paid_conversion_30d.activated)} مفعَّل`}
        />
        <Stat
          label="عمق الاستهلاك"
          value={fmtNum(leading.consumption_depth.median)}
          foot={`وسيط الأرصدة لكل مستخدم نشط`}
        />
        <Stat
          label="تفعيل الإحالة"
          value={`${leading.referral_activation_rate}%`}
          foot={`${fmtNum(data.referral.activated)} مفعَّل من ${fmtNum(data.referral.clicks)} نقرة`}
        />
      </div>

      <Panel title="اتجاه الإيراد اليومي">
        <BarChart data={trend} valueKey="revenue" labelKey="day" />
      </Panel>

      {/* ── ٣. هل هو مربح؟ ──────────────────────────────────────────────── */}
      <h2 className={s.panelTitle} style={{ margin: '1.5rem 0 0.75rem' }}>💰 هل هو مربح؟</h2>

      {warnRatio && (
        <div className={s.warnBox}>
          نسبة تكلفة الحوافز {incentive.ratio}% وهي فوق حدّ التنبيه (25%). راجع مكافآت الإحالة
          وقيم الكوبونات — الحلقة تشتري نمواً بتكلفة قد لا تكون مستدامة.
        </div>
      )}

      <div className={s.statGrid}>
        <Stat label="الإيراد الشهري المتكرر" value={fmtMoney(lagging.mrr.mrr)}
          foot={`${fmtNum(lagging.mrr.subscribers)} مشترك فعّال`} />
        <Stat label="إيراد آخر 30 يوماً" value={fmtMoney(lagging.mrr.new_revenue_30d)}
          foot={`${fmtNum(lagging.mrr.new_paid_30d)} طلب مدفوع`} />
        <Stat label="نسبة تكلفة الحوافز" value={`${incentive.ratio}%`}
          foot={`${fmtMoney(incentive.total_incentive_cost)} مقابل ${fmtMoney(incentive.net_revenue)}`} />
        <Stat label="التزام الأرصدة" value={fmtNum(lagging.credit_liability.outstanding)}
          foot={`رصيد غير مستهلك لدى ${fmtNum(lagging.credit_liability.holders)} مستخدم`} />
        <Stat label="البقاء (شهر / 3 أشهر)"
          value={`${lagging.retention.m1}% / ${lagging.retention.m3}%`}
          foot={`من ${fmtNum(lagging.retention.m1_cohort)} دافع`} />
      </div>

      {data.referral.held > 0 && (
        <Panel title="مراجعة مطلوبة">
          <div className={s.infoBox}>
            {fmtNum(data.referral.held)} مكافأة إحالة معلّقة، منها {fmtNum(data.referral.high_risk)} عالية
            المخاطر. المكافآت المعلّقة لا تُدفع ولا تُلغى حتى تراجعها.
            <button type="button" className={`${s.btn} ${s.btnPrimary} ${s.btnSm}`}
              style={{ marginInlineStart: '0.75rem' }}
              onClick={() => navigate('/growth/referrals?filter=held')}>
              فتح طابور المراجعة
            </button>
          </div>
        </Panel>
      )}
    </>
  )
}
