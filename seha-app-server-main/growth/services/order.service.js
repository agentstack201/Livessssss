// ───────────────────────────────────────────────────────────────────────────
// خدمة الطلبات — السجل التجاري ومصدر حقيقة الإيراد.
//
// مبدأ اللقطة الثابتة: عند الإنشاء تُنسخ قيم المنتج كلّها إلى أعمدة
// _snapshot، ولا يُقرأ growth_products بعدها أبداً لعرض الطلب. لو عرضنا
// الطلب بالانضمام إلى المنتج لتغيّر تاريخ الشراء بأثر رجعي كلّما عدّل الأدمن
// السعر: طلبٌ اشتُري بـ 100 ريال/200 رصيد سيظهر فجأة 150 ريال/350 رصيد.
//
// الاعتماد يدوي في هذه المرحلة (لا بوابة دفع). لحظة الاعتماد هي اللحظة التي
// تُمنح فيها الأرصدة ويُفعَّل الاشتراك وتتقدّم الإحالة وتُقيَّم المكافآت —
// كلّها في معاملة واحدة، فإمّا أن تقع جميعاً أو لا يقع شيء.
// ───────────────────────────────────────────────────────────────────────────

const { Op } = require('sequelize');
const sequelize = require('../../config/database');
const {
  GrowthOrder, GrowthProduct, GrowthProfile, Campaign, ReferralLink,
} = require('../models');
const credits = require('./credit.service');
const coupons = require('./coupon.service');
const referrals = require('./referral.service');
const rewards = require('./reward.service');
const settings = require('./settings.service');
const audit = require('./audit.service');
const { err } = require('../errors');

/** مرجع طلب مقروء للعميل: ORD-<تاريخ>-<عشوائي> */
function makeReference() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `ORD-${ymd}-${credits.randomCode(5)}`;
}

/** يحسب نهاية الفترة من دورة الفوترة. */
function periodEnd(start, cycle) {
  const d = new Date(start);
  switch (cycle) {
    case 'monthly': d.setMonth(d.getMonth() + 1); return d;
    case 'quarterly': d.setMonth(d.getMonth() + 3); return d;
    case 'annual': d.setFullYear(d.getFullYear() + 1); return d;
    case 'lifetime': return null;
    default: return null;
  }
}

/**
 * ينشئ طلباً بلقطة ثابتة من المنتج وقت الشراء.
 * لا يمنح أرصدة — المنح يقع عند اعتماد الدفع فقط.
 */
async function create({ userId, productId, couponCode = null, campaignId = null, req = null, actor = null }) {
  const cfg = await settings.forRequest(req);

  const product = await GrowthProduct.findByPk(productId);
  if (!product) throw err.notFound('المنتج');
  if (!product.is_active) throw err.validation('هذا المنتج غير متاح للشراء حالياً');

  return sequelize.transaction(async (t) => {
    const gross = Number(product.price);

    // ── الكوبون ─────────────────────────────────────────────────────────
    let discount = 0;
    let couponRow = null;
    let couponCredits = 0;

    if (couponCode) {
      // lock: يقفل صفّ الكوبون فيُسلسل الاستخدامات المتوازية — بدونه يتجاوز
      // طلبان متزامنان سقفَ «مرة واحدة لكل مستخدم» معاً.
      const check = await coupons.validateForUse({
        code: couponCode, userId, productId, amount: gross, transaction: t, lock: true,
      });
      if (!check.valid) throw err.validation(check.reason);
      discount = check.discount;
      couponCredits = check.creditsGranted;
      couponRow = check.coupon;
    }

    const net = Math.max(0, Math.round((gross - discount) * 100) / 100);

    // ── إسناد الإحالة ───────────────────────────────────────────────────
    const profile = await credits.ensureProfile(userId, { transaction: t });
    const referralLinkId = profile.referred_by_link_id || null;

    const start = new Date();
    const order = await GrowthOrder.create(
      {
        reference: makeReference(),
        user_id: userId,
        product_id: product.id,

        // لقطة ثابتة — تُكتب مرة واحدة ولا تُمسّ بعدها
        product_name_snapshot: product.name,
        product_kind_snapshot: product.kind,
        billing_cycle_snapshot: product.billing_cycle,
        unit_price_snapshot: product.price,
        credits_snapshot: product.credits_granted,
        features_snapshot: product.features || {},
        currency: product.currency || cfg['payment.currency'],

        gross_amount: gross,
        discount_amount: discount,
        net_amount: net,

        coupon_id: couponRow?.id || null,
        coupon_code_snapshot: couponRow?.code || null,

        campaign_id: campaignId || null,
        referral_link_id: referralLinkId,

        status: 'awaiting_payment',
        period_start: product.kind === 'subscription' ? start : null,
        period_end: product.kind === 'subscription' ? periodEnd(start, product.billing_cycle) : null,
      },
      { transaction: t }
    );

    if (couponRow) {
      await coupons.redeem({
        coupon: couponRow, userId, orderId: order.id,
        originalAmount: gross, discountApplied: discount,
        creditsGranted: couponCredits, transaction: t,
      });
    }

    await audit.log({
      actor: actor || { id: userId }, action: 'order.create',
      resourceType: 'growth_order', resourceId: order.id,
      after: { reference: order.reference, product: product.name, net_amount: net },
      req, severity: 'info', transaction: t,
    });

    return order;
  }).then(async (order) => {
    // الاعتماد التلقائي إعداد تشغيلي — يبقى معطّلاً ما دام الدفع يدوياً.
    if (cfg['ops.auto_approve_orders']) {
      return approve({ orderId: order.id, actor: actor || { id: null, name: 'النظام' }, req, auto: true });
    }
    return order;
  });
}

/**
 * اعتماد الدفع — اللحظة الوحيدة التي تُمنح فيها الأرصدة.
 * كل الآثار في معاملة واحدة: الرصيد، الاشتراك، الحملة، ثم الإحالة والمكافآت
 * بعد التثبيت (فهما يفتحان معاملاتهما الخاصة ويجب ألّا تفشل بسببهما).
 */
async function approve({ orderId, paymentReference = null, actor, req = null, auto = false }) {
  const result = await sequelize.transaction(async (t) => {
    const order = await GrowthOrder.findOne({
      where: { id: orderId }, lock: t.LOCK.UPDATE, transaction: t,
    });
    if (!order) throw err.notFound('الطلب');
    if (order.status === 'paid') throw err.conflict('الطلب معتمَد سلفاً');
    if (['refunded', 'cancelled'].includes(order.status)) {
      throw err.conflict('لا يمكن اعتماد طلب مسترَد أو ملغى');
    }

    const before = { status: order.status };

    // ── منح الأرصدة من لقطة الطلب لا من المنتج الحالي ──────────────────
    let tx = null;
    if (order.credits_snapshot > 0) {
      const applied = await credits.apply({
        userId: order.user_id,
        type: 'grant',
        amount: order.credits_snapshot,
        sourceType: 'order',
        sourceId: String(order.id),
        description: `شراء: ${order.product_name_snapshot} (${order.reference})`,
        idempotencyKey: `order_grant:${order.id}`,
        metadata: { order_reference: order.reference },
        transaction: t,
        req,
      });
      tx = applied.transaction;
    }

    // ── تفعيل الاشتراك ──────────────────────────────────────────────────
    const profile = await credits.ensureProfile(order.user_id, { transaction: t });
    const patch = { first_paid_at: profile.first_paid_at || new Date() };

    if (order.product_kind_snapshot === 'subscription') {
      patch.current_product_id = order.product_id;
      patch.subscription_status = 'active';
      patch.subscription_started_at = order.period_start || new Date();
      patch.subscription_expires_at = order.period_end;
    }
    await profile.update(patch, { transaction: t });

    // ── ميزانية الحملة: زيادة ذرّية تحت شرط السقف ───────────────────────
    if (order.campaign_id && Number(order.discount_amount) > 0) {
      const campaign = await Campaign.findOne({
        where: { id: order.campaign_id }, lock: t.LOCK.UPDATE, transaction: t,
      });
      if (campaign) {
        const spend = Number(order.discount_amount);
        const used = Number(campaign.budget_used) + spend;
        // تجاوز الميزانية لا يُفشل الطلب — الخصم وقع فعلاً ويجب أن يُسجَّل.
        await campaign.update({ budget_used: used }, { transaction: t });
      }
    }

    await order.update(
      {
        status: 'paid',
        payment_reference: paymentReference || order.payment_reference,
        approved_by: actor?.id || null,
        approved_at: new Date(),
        credit_transaction_id: tx?.id || null,
      },
      { transaction: t }
    );

    await audit.log({
      actor, action: auto ? 'order.auto_approve' : 'order.approve',
      resourceType: 'growth_order', resourceId: order.id,
      before, after: { status: 'paid', credits_granted: order.credits_snapshot },
      reason: paymentReference ? `مرجع الدفع: ${paymentReference}` : null,
      req, severity: 'critical', transaction: t,
    });

    return order;
  });

  // ── ما بعد التثبيت: الإحالة والمكافآت ───────────────────────────────────
  // خارج المعاملة عمداً: كلٌّ منهما يفتح معاملته الخاصة، وفشل مكافأة يجب
  // ألّا يُلغي دفعاً معتمَداً بالفعل.
  try {
    await referrals.advanceStage({
      userId: result.user_id, stage: 'first_purchase',
      reference: `order:${result.id}`, req,
    });
  } catch (e) {
    console.error('[growth] تعذّر تقديم مرحلة الإحالة:', e.message);
  }

  try {
    await rewards.evaluate({
      userId: result.user_id, eventType: 'first_purchase',
      data: { orderId: result.id }, req, actor,
    });
  } catch (e) {
    console.error('[growth] تعذّر تقييم المكافآت:', e.message);
  }

  return result;
}

/**
 * استرداد — يعكس الأرصدة الممنوحة ويسترجع مكافآت الإحالة داخل نافذتها.
 * لا يُعدَّل أي سطر دفتر: الاسترداد حركة تعويضية جديدة.
 */
async function refund({ orderId, reason, actor, req = null }) {
  if (!reason?.trim()) throw err.reasonRequired();

  const order = await GrowthOrder.findByPk(orderId);
  if (!order) throw err.notFound('الطلب');
  if (order.status !== 'paid') throw err.conflict('لا يمكن استرداد طلب غير مدفوع');

  await sequelize.transaction(async (t) => {
    if (order.credits_snapshot > 0 && order.credit_transaction_id) {
      await credits.reverse({
        userId: order.user_id,
        originalTransactionId: order.credit_transaction_id,
        amount: order.credits_snapshot,
        sourceType: 'refund',
        description: `استرداد الطلب ${order.reference}`,
        reason,
        performedBy: actor?.id || null,
        req, actor, transaction: t,
      });
    }

    if (order.product_kind_snapshot === 'subscription') {
      const profile = await GrowthProfile.findOne({ where: { user_id: order.user_id }, transaction: t });
      if (profile && profile.current_product_id === order.product_id) {
        await profile.update({ subscription_status: 'cancelled' }, { transaction: t });
      }
    }

    await order.update(
      {
        status: 'refunded',
        refunded_by: actor?.id || null,
        refunded_at: new Date(),
        refund_reason: reason,
      },
      { transaction: t }
    );

    await audit.log({
      actor, action: 'order.refund', resourceType: 'growth_order', resourceId: order.id,
      before: { status: 'paid' }, after: { status: 'refunded' },
      reason, req, severity: 'critical', transaction: t,
    });
  });

  // استرجاع مكافآت الإحالة إن كنّا داخل نافذة الاسترجاع.
  try {
    await referrals.clawbackForOrder({ order, actor, req });
  } catch (e) {
    console.error('[growth] تعذّر استرجاع مكافآت الإحالة:', e.message);
  }

  return order;
}

/** إلغاء طلب لم يُدفع. */
async function cancel({ orderId, reason, actor, req = null }) {
  const order = await GrowthOrder.findByPk(orderId);
  if (!order) throw err.notFound('الطلب');
  if (order.status === 'paid') throw err.conflict('استخدم الاسترداد للطلبات المدفوعة');
  if (order.status === 'cancelled') return order;

  await order.update({ status: 'cancelled', refund_reason: reason || null });
  await audit.log({
    actor, action: 'order.cancel', resourceType: 'growth_order', resourceId: order.id,
    before: { status: 'awaiting_payment' }, after: { status: 'cancelled' },
    reason, req, severity: 'notice',
  });
  return order;
}

/** إيراد مجمَّع من الطلبات المدفوعة — أساس كل مقاييس المال. */
async function revenueSummary({ from = null, to = null } = {}) {
  const where = { status: 'paid' };
  if (from || to) {
    where.approved_at = {};
    if (from) where.approved_at[Op.gte] = new Date(from);
    if (to) where.approved_at[Op.lte] = new Date(to);
  }

  const rows = await GrowthOrder.findAll({
    where,
    attributes: [
      [sequelize.fn('COUNT', sequelize.col('id')), 'orders'],
      [sequelize.fn('COALESCE', sequelize.fn('SUM', sequelize.col('net_amount')), 0), 'net'],
      [sequelize.fn('COALESCE', sequelize.fn('SUM', sequelize.col('gross_amount')), 0), 'gross'],
      [sequelize.fn('COALESCE', sequelize.fn('SUM', sequelize.col('discount_amount')), 0), 'discount'],
      [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('user_id'))), 'buyers'],
    ],
    raw: true,
  });

  const r = rows[0] || {};
  return {
    orders: parseInt(r.orders, 10) || 0,
    buyers: parseInt(r.buyers, 10) || 0,
    gross: Number(r.gross) || 0,
    discount: Number(r.discount) || 0,
    net: Number(r.net) || 0,
  };
}

module.exports = { create, approve, refund, cancel, revenueSummary, makeReference, periodEnd };
