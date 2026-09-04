// ───────────────────────────────────────────────────────────────────────────
// خدمة التحليلات — تُحسب من الجداول مباشرة، بلا مخزن مقاييس منفصل.
//
// لماذا بلا تجميع مسبق؟ عند عشرات الآلاف من المستخدمين تُنفَّذ هذه
// الاستعلامات في أجزاء من الثانية مع الفهارس المُعلنة. جدول تجميع يومي
// يضيف مهمة مجدولة وطبقة قِدَم وفرصة تباعد بين رقمين — مقابل مكسب أداء
// لا يحتاجه أحد بعد. يُضاف حين يثبت القياس أنه لازم، لا قبله.
//
// النجم القطبي: MAPU — المستخدمون الدافعون النشطون شهرياً.
//   عدد لا نسبة (لا يُرفَع بتقليص القمع)، ويشترط الدفع والاستخدام معاً،
//   فالمستخدم الذي يدفع ولا يستعمل يسقط منه قبل أن يلغي اشتراكه بشهرين.
// ───────────────────────────────────────────────────────────────────────────

const sequelize = require('../../config/database');
const { Op } = require('sequelize');
const {
  GrowthOrder, GrowthProfile, ReferralEvent, RewardGrant,
  CouponRedemption, Campaign, GrowthProduct, CreditTransaction,
} = require('../models');

const QT = { type: sequelize.QueryTypes.SELECT };
const num = (v) => Number(v) || 0;
const int = (v) => parseInt(v, 10) || 0;
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);

/**
 * النجم القطبي — MAPU.
 * (أ) اشتراك فعّال أو شراء خلال 90 يوماً، و(ب) استهلاك رصيد خلال 30 يوماً.
 */
async function mapu() {
  const [row] = await sequelize.query(
    `WITH paying AS (
       SELECT DISTINCT p.user_id
         FROM growth_profiles p
         LEFT JOIN growth_orders o
                ON o.user_id = p.user_id
               AND o.status = 'paid'
               AND o.approved_at >= NOW() - INTERVAL '90 days'
        WHERE (p.subscription_status = 'active'
               AND (p.subscription_expires_at IS NULL OR p.subscription_expires_at > NOW()))
           OR o.id IS NOT NULL
     ),
     consuming AS (
       SELECT DISTINCT user_id
         FROM credit_transactions
        WHERE source_type = 'service_usage'
          AND "createdAt" >= NOW() - INTERVAL '30 days'
     )
     SELECT COUNT(*)::int AS mapu
       FROM paying JOIN consuming USING (user_id)`,
    QT
  );
  return int(row?.mapu);
}

/** MAPU قبل 30 يوماً — لحساب الاتجاه. */
async function mapuPrevious() {
  const [row] = await sequelize.query(
    `WITH paying AS (
       SELECT DISTINCT o.user_id
         FROM growth_orders o
        WHERE o.status = 'paid'
          AND o.approved_at BETWEEN NOW() - INTERVAL '120 days' AND NOW() - INTERVAL '30 days'
     ),
     consuming AS (
       SELECT DISTINCT user_id
         FROM credit_transactions
        WHERE source_type = 'service_usage'
          AND "createdAt" BETWEEN NOW() - INTERVAL '60 days' AND NOW() - INTERVAL '30 days'
     )
     SELECT COUNT(*)::int AS mapu
       FROM paying JOIN consuming USING (user_id)`,
    QT
  );
  return int(row?.mapu);
}

/** معدّل التفعيل خلال 7 أيام — أقوى مؤشر مبكر. */
async function activationRate(days = 30) {
  const [row] = await sequelize.query(
    `SELECT COUNT(*)::int AS cohort,
            COUNT(*) FILTER (
              WHERE activated_at IS NOT NULL
                AND activated_at <= "createdAt" + INTERVAL '7 days'
            )::int AS activated
       FROM growth_profiles
      WHERE "createdAt" >= NOW() - INTERVAL '1 day' * :days
        AND "createdAt" <= NOW() - INTERVAL '7 days'`,
    { ...QT, replacements: { days } }
  );
  const cohort = int(row?.cohort);
  const activated = int(row?.activated);
  return { cohort, activated, rate: pct(activated, cohort) };
}

/** التحويل المدفوع خلال 30 يوماً من التفعيل. */
async function paidConversion(days = 60) {
  const [row] = await sequelize.query(
    `SELECT COUNT(*)::int AS activated,
            COUNT(*) FILTER (
              WHERE first_paid_at IS NOT NULL
                AND first_paid_at <= activated_at + INTERVAL '30 days'
            )::int AS converted
       FROM growth_profiles
      WHERE activated_at IS NOT NULL
        AND activated_at >= NOW() - INTERVAL '1 day' * :days`,
    { ...QT, replacements: { days } }
  );
  const activated = int(row?.activated);
  const converted = int(row?.converted);
  return { activated, converted, rate: pct(converted, activated) };
}

/** عمق الاستهلاك — وسيط الأرصدة المستهلكة لكل مستخدم نشط شهرياً. */
async function consumptionDepth() {
  const [row] = await sequelize.query(
    `WITH per_user AS (
       SELECT user_id, SUM(ABS(amount))::int AS used
         FROM credit_transactions
        WHERE source_type = 'service_usage'
          AND "createdAt" >= NOW() - INTERVAL '30 days'
        GROUP BY user_id
     )
     SELECT COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY used), 0) AS median,
            COALESCE(AVG(used), 0) AS mean,
            COUNT(*)::int AS users
       FROM per_user`,
    QT
  );
  return {
    median: Math.round(num(row?.median) * 10) / 10,
    mean: Math.round(num(row?.mean) * 10) / 10,
    users: int(row?.users),
  };
}

/** MRR + حركته مفكوكة. */
async function mrr() {
  const [row] = await sequelize.query(
    `SELECT COALESCE(SUM(
              CASE pr.billing_cycle
                WHEN 'monthly'   THEN pr.price
                WHEN 'quarterly' THEN pr.price / 3
                WHEN 'annual'    THEN pr.price / 12
                ELSE 0
              END), 0) AS mrr,
            COUNT(*)::int AS subscribers
       FROM growth_profiles p
       JOIN growth_products pr ON pr.id = p.current_product_id
      WHERE p.subscription_status = 'active'
        AND (p.subscription_expires_at IS NULL OR p.subscription_expires_at > NOW())`,
    QT
  );

  const [movement] = await sequelize.query(
    `SELECT
       COUNT(*) FILTER (WHERE o.approved_at >= NOW() - INTERVAL '30 days')::int AS new_paid,
       COALESCE(SUM(o.net_amount) FILTER (WHERE o.approved_at >= NOW() - INTERVAL '30 days'), 0) AS new_revenue,
       COUNT(*) FILTER (WHERE o.status = 'refunded'
                          AND o.refunded_at >= NOW() - INTERVAL '30 days')::int AS refunded
       FROM growth_orders o
      WHERE o.status IN ('paid','refunded')`,
    QT
  );

  return {
    mrr: Math.round(num(row?.mrr) * 100) / 100,
    subscribers: int(row?.subscribers),
    new_paid_30d: int(movement?.new_paid),
    new_revenue_30d: Math.round(num(movement?.new_revenue) * 100) / 100,
    refunded_30d: int(movement?.refunded),
  };
}

/** بقاء الشعارات — نسبة الدافعين المستمرين بعد شهر وثلاثة. */
async function retention() {
  const [row] = await sequelize.query(
    `SELECT
       COUNT(*) FILTER (WHERE first_paid_at <= NOW() - INTERVAL '30 days')::int AS m1_cohort,
       COUNT(*) FILTER (WHERE first_paid_at <= NOW() - INTERVAL '30 days'
                          AND last_active_at >= NOW() - INTERVAL '30 days')::int AS m1_retained,
       COUNT(*) FILTER (WHERE first_paid_at <= NOW() - INTERVAL '90 days')::int AS m3_cohort,
       COUNT(*) FILTER (WHERE first_paid_at <= NOW() - INTERVAL '90 days'
                          AND last_active_at >= NOW() - INTERVAL '30 days')::int AS m3_retained
       FROM growth_profiles
      WHERE first_paid_at IS NOT NULL`,
    QT
  );
  return {
    m1: pct(int(row?.m1_retained), int(row?.m1_cohort)),
    m3: pct(int(row?.m3_retained), int(row?.m3_cohort)),
    m1_cohort: int(row?.m1_cohort),
    m3_cohort: int(row?.m3_cohort),
  };
}

/** نسبة تكلفة الحوافز — حارس الاستدامة. */
async function incentiveCostRatio({ days = 30 } = {}) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [rewardCredits, couponDiscount, revenue] = await Promise.all([
    RewardGrant.sum('value_snapshot', {
      where: { status: 'granted', createdAt: { [Op.gte]: since } },
    }),
    CouponRedemption.sum('discount_applied', { where: { createdAt: { [Op.gte]: since } } }),
    GrowthOrder.sum('net_amount', {
      where: { status: 'paid', approved_at: { [Op.gte]: since } },
    }),
  ]);

  // الأرصدة تُقيَّم بمتوسط سعر الرصيد الفعلي من المنتجات النشطة.
  const [priceRow] = await sequelize.query(
    `SELECT COALESCE(AVG(price / NULLIF(credits_granted, 0)), 0) AS credit_price
       FROM growth_products
      WHERE is_active = true AND credits_granted > 0 AND "deletedAt" IS NULL`,
    QT
  );
  const creditPrice = num(priceRow?.credit_price);

  const rewardCost = num(rewardCredits) * creditPrice;
  const totalIncentive = rewardCost + num(couponDiscount);
  const net = num(revenue);

  return {
    reward_credits: num(rewardCredits),
    credit_unit_price: Math.round(creditPrice * 100) / 100,
    reward_cost: Math.round(rewardCost * 100) / 100,
    coupon_discount: Math.round(num(couponDiscount) * 100) / 100,
    total_incentive_cost: Math.round(totalIncentive * 100) / 100,
    net_revenue: Math.round(net * 100) / 100,
    ratio: net > 0 ? Math.round((totalIncentive / net) * 1000) / 10 : 0,
  };
}

/** التزام الأرصدة — رصيد ممنوح غير مستهلك. مقياس ميزانية لا أداء. */
async function creditLiability() {
  const [row] = await sequelize.query(
    `SELECT COALESCE(SUM(credit_balance), 0)::int AS outstanding,
            COALESCE(SUM(reward_debt), 0)::int    AS debt,
            COUNT(*) FILTER (WHERE credit_balance > 0)::int AS holders
       FROM growth_profiles`,
    QT
  );
  return {
    outstanding: int(row?.outstanding),
    debt: int(row?.debt),
    holders: int(row?.holders),
  };
}

/** معدّل تفعيل الإحالة — صحة حلقة النمو. */
async function referralHealth() {
  const [row] = await sequelize.query(
    `SELECT COUNT(*)::int AS clicks,
            COUNT(registered_at)::int      AS registered,
            COUNT(activated_at)::int       AS activated,
            COUNT(first_purchase_at)::int  AS purchased,
            COUNT(*) FILTER (WHERE payout_status = 'hold')::int    AS held,
            COUNT(*) FILTER (WHERE risk_band = 'high')::int        AS high_risk
       FROM referral_events
      WHERE "createdAt" >= NOW() - INTERVAL '90 days'`,
    QT
  );

  const clicks = int(row?.clicks);
  const activated = int(row?.activated);
  return {
    clicks,
    registered: int(row?.registered),
    activated,
    purchased: int(row?.purchased),
    held: int(row?.held),
    high_risk: int(row?.high_risk),
    activation_rate: pct(activated, clicks),
    purchase_rate: pct(int(row?.purchased), activated),
  };
}

/** كل مؤشرات الصفحة الرئيسية في نداء واحد. */
async function overview() {
  const [
    northStar, prev, activation, conversion, depth, revenue,
    retentionRates, incentive, liability, referral,
  ] = await Promise.all([
    mapu(), mapuPrevious(), activationRate(), paidConversion(),
    consumptionDepth(), mrr(), retention(), incentiveCostRatio(),
    creditLiability(), referralHealth(),
  ]);

  const trend = prev > 0 ? Math.round(((northStar - prev) / prev) * 1000) / 10 : null;

  return {
    north_star: { key: 'MAPU', label: 'مستخدمون دافعون نشطون', value: northStar, previous: prev, trend_pct: trend },
    leading: {
      activation_rate_7d: activation,
      paid_conversion_30d: conversion,
      consumption_depth: depth,
      referral_activation_rate: referral.activation_rate,
    },
    lagging: {
      mrr: revenue,
      retention: retentionRates,
      incentive_cost: incentive,
      credit_liability: liability,
    },
    referral,
    generated_at: new Date().toISOString(),
  };
}

/**
 * التنبيهات — الشريط الأعلى في اللوحة.
 * كل تنبيه يحمل إجراءً ووجهة، فالصفحة سطح قرار لا لوحة عدّادات.
 */
async function alerts() {
  const out = [];

  const heldCount = await ReferralEvent.count({ where: { payout_status: 'hold' } });
  if (heldCount > 0) {
    out.push({
      severity: 'critical', key: 'referral_holds',
      title: `${heldCount} مكافأة إحالة معلّقة للمراجعة`,
      action: 'مراجعة', target: '/growth/referrals?filter=held',
    });
  }

  const pendingOrders = await GrowthOrder.count({ where: { status: 'awaiting_payment' } });
  if (pendingOrders > 0) {
    out.push({
      severity: 'warning', key: 'pending_orders',
      title: `${pendingOrders} طلب بانتظار اعتماد الدفع`,
      action: 'عرض', target: '/growth/orders?status=awaiting_payment',
    });
  }

  const overBudget = await sequelize.query(
    `SELECT id, name, budget, budget_used,
            ROUND((budget_used / NULLIF(budget, 0)) * 100)::int AS pct
       FROM campaigns
      WHERE status = 'active' AND budget IS NOT NULL
        AND budget_used >= budget * 0.8 AND "deletedAt" IS NULL
      LIMIT 5`,
    QT
  );
  for (const c of overBudget) {
    out.push({
      severity: c.pct >= 100 ? 'critical' : 'warning', key: `campaign_budget_${c.id}`,
      title: `حملة «${c.name}» بلغت ${c.pct}% من الميزانية`,
      action: 'إدارة', target: `/growth/campaigns?id=${c.id}`,
    });
  }

  const expiring = await GrowthProfile.count({
    where: {
      subscription_status: 'active',
      subscription_expires_at: {
        [Op.between]: [new Date(), new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)],
      },
    },
  });
  if (expiring > 0) {
    out.push({
      severity: 'info', key: 'expiring_subs',
      title: `${expiring} اشتراكاً ينتهي خلال 3 أيام`,
      action: 'عرض', target: '/growth/orders?expiring=1',
    });
  }

  // تباين بين الرصيد المخزَّن والدفتر = خلل يستحق الإيقاف الفوري.
  const [drift] = await sequelize.query(
    `SELECT COUNT(*)::int AS n FROM (
       SELECT p.user_id
         FROM growth_profiles p
         LEFT JOIN credit_transactions t ON t.user_id = p.user_id
        GROUP BY p.user_id, p.credit_balance
       HAVING p.credit_balance <> COALESCE(SUM(t.amount), 0)::int
     ) d`,
    QT
  );
  if (int(drift?.n) > 0) {
    out.push({
      severity: 'critical', key: 'ledger_drift',
      title: `تباين بين الرصيد والدفتر لدى ${int(drift.n)} مستخدم`,
      action: 'فحص', target: '/growth/credits?tab=reconcile',
    });
  }

  return out;
}

/** اتجاه الإيراد اليومي — للرسم البياني. */
async function revenueTrend({ days = 30 } = {}) {
  return sequelize.query(
    `SELECT DATE(o.approved_at) AS day,
            COALESCE(SUM(o.net_amount), 0) AS revenue,
            COUNT(*)::int AS orders
       FROM growth_orders o
      WHERE o.status = 'paid'
        AND o.approved_at >= NOW() - INTERVAL '1 day' * :days
      GROUP BY DATE(o.approved_at)
      ORDER BY day ASC`,
    { ...QT, replacements: { days } }
  );
}

/** أداء الحملات مرتّباً بالعائد — للوحة الرئيسية وصفحة الحملات. */
async function campaignPerformance({ limit = 10 } = {}) {
  return sequelize.query(
    `SELECT c.id, c.name, c.status, c.budget, c.budget_used,
            COUNT(DISTINCT o.id)::int                  AS orders,
            COUNT(DISTINCT o.user_id)::int             AS buyers,
            COALESCE(SUM(o.net_amount), 0)             AS revenue,
            CASE WHEN c.budget_used > 0
                 THEN ROUND((COALESCE(SUM(o.net_amount), 0) / c.budget_used)::numeric, 2)
                 ELSE NULL END                          AS roi
       FROM campaigns c
       LEFT JOIN growth_orders o ON o.campaign_id = c.id AND o.status = 'paid'
      WHERE c."deletedAt" IS NULL
      GROUP BY c.id
      ORDER BY revenue DESC
      LIMIT :limit`,
    { ...QT, replacements: { limit } }
  );
}

/** أداء المنتجات — مشتركون وإيراد لكل منتج. */
async function productPerformance() {
  return sequelize.query(
    `SELECT p.id, p.name, p.kind, p.price, p.is_active,
            COUNT(DISTINCT o.id)::int      AS orders,
            COUNT(DISTINCT o.user_id)::int AS buyers,
            COALESCE(SUM(o.net_amount), 0) AS revenue,
            (SELECT COUNT(*)::int FROM growth_profiles gp
              WHERE gp.current_product_id = p.id
                AND gp.subscription_status = 'active') AS active_subscribers
       FROM growth_products p
       LEFT JOIN growth_orders o ON o.product_id = p.id AND o.status = 'paid'
      WHERE p."deletedAt" IS NULL
      GROUP BY p.id
      ORDER BY p.sort_order ASC, p.id ASC`,
    QT
  );
}

/** أفضل المُحيلين. */
async function topReferrers({ limit = 10 } = {}) {
  return sequelize.query(
    `SELECT u.id, u.name, u.email,
            COUNT(e.id)::int                        AS total_referrals,
            COUNT(e.activated_at)::int              AS activated,
            COUNT(e.first_purchase_at)::int         AS purchased,
            COALESCE(SUM(g.value_snapshot) FILTER (WHERE g.status = 'granted'), 0)::int AS credits_earned
       FROM referral_events e
       JOIN users u ON u.id = e.referrer_id
       LEFT JOIN reward_grants g ON g.referral_event_id = e.id AND g.party = 'referrer'
      WHERE e.stage_reached <> 'revoked'
      GROUP BY u.id
      ORDER BY activated DESC, total_referrals DESC
      LIMIT :limit`,
    { ...QT, replacements: { limit } }
  );
}

/** ملخّص حركة الأرصدة حسب النوع. */
async function creditSummary({ days = 30 } = {}) {
  return sequelize.query(
    `SELECT type,
            COUNT(*)::int              AS count,
            COALESCE(SUM(amount), 0)::int AS total
       FROM credit_transactions
      WHERE "createdAt" >= NOW() - INTERVAL '1 day' * :days
      GROUP BY type
      ORDER BY type`,
    { ...QT, replacements: { days } }
  );
}

module.exports = {
  mapu, activationRate, paidConversion, consumptionDepth, mrr, retention,
  incentiveCostRatio, creditLiability, referralHealth, overview, alerts,
  revenueTrend, campaignPerformance, productPerformance, topReferrers, creditSummary,
};
