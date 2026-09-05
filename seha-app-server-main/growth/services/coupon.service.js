// ───────────────────────────────────────────────────────────────────────────
// خدمة الكوبونات — التحقّق والاستخدام.
//
// التحقّق والاستخدام منفصلان عمداً: الواجهة تتحقّق أثناء الكتابة لتُظهر الخصم
// فوراً، والاستخدام يقع مرة واحدة داخل معاملة الطلب. لو دُمجا لأمكن أن يستهلك
// «معاينة الخصم» رصيداً من سقف الكوبون.
//
// حاجز أمان مفروض هنا لا في المخطّط: كوبون بلا سقف كلّي ولا سقف لكل مستخدم
// ولا تاريخ انتهاء يُرفض. الحقول الثلاثة مشروعة منفردة، ومجتمعةً على null
// تصنع منحة لا نهائية.
// ───────────────────────────────────────────────────────────────────────────

const { Op } = require('sequelize');
const sequelize = require('../../config/database');
const { Coupon, CouponRedemption, GrowthProfile } = require('../models');
const INV = require('../config/invariants');
const { err } = require('../errors');

const normalize = (code) => String(code || '').trim().toUpperCase();

/** يفرض حاجز «حدّ واحد على الأقل» + السقوف الصلبة عند الإنشاء والتعديل. */
function validateDefinition(payload) {
  const out = { ...payload };
  if (out.code) out.code = normalize(out.code);

  if (INV.COUPON_REQUIRES_AT_LEAST_ONE_BOUND) {
    const noTotal = out.usage_limit === null || out.usage_limit === undefined || out.usage_limit === '';
    const noPerUser = out.per_user_limit === null || out.per_user_limit === undefined || out.per_user_limit === '';
    const noExpiry = !out.valid_until;
    if (noTotal && noPerUser && noExpiry) {
      throw err.validation(
        'الكوبون يحتاج حدّاً واحداً على الأقل: سقف استخدام كلّي، أو سقف لكل مستخدم، أو تاريخ انتهاء'
      );
    }
  }

  // النوع قائمة مغلقة في المخطّط. بلا هذا الفحص يمرّ نوع مجهول إلى INSERT
  // فيرتدّ خطأ Postgres خاماً كـ 500 مبهم، ولا يمرّ بأي سقف من السقوف أدناه.
  if (out.discount_type !== undefined) {
    const allowed = Coupon.rawAttributes.discount_type.values;
    if (!allowed.includes(out.discount_type)) {
      throw err.validation(
        `نوع خصم غير مدعوم «${out.discount_type}». المدعوم: ${allowed.join(', ')}`
      );
    }
  }

  if (out.discount_type === 'percentage') {
    const v = parseFloat(out.discount_value);
    if (!Number.isFinite(v) || v <= 0) throw err.validation('نسبة الخصم غير صالحة');
    out.discount_value = INV.clamp(v, INV.HARD_MAX_DISCOUNT_PERCENT);
  }

  if (out.discount_type === 'fixed_amount') {
    const v = parseFloat(out.discount_value);
    if (!Number.isFinite(v) || v <= 0) throw err.validation('قيمة الخصم غير صالحة');
    out.discount_value = v;
  }

  if (out.discount_type === 'credit_grant') {
    const v = parseInt(out.discount_value, 10);
    if (!Number.isFinite(v) || v <= 0) throw err.validation('عدد الأرصدة غير صالح');
    out.discount_value = INV.clamp(v, INV.HARD_MAX_SINGLE_GRANT);
  }

  if (out.valid_from && out.valid_until && new Date(out.valid_until) <= new Date(out.valid_from)) {
    throw err.validation('تاريخ الانتهاء يجب أن يكون بعد تاريخ البدء');
  }

  return out;
}

/**
 * يتحقّق من صلاحية كوبون لمستخدم ومبلغ محدّدين، ويحسب الخصم.
 * لا يغيّر شيئاً — آمن للاستدعاء عند كل ضغطة مفتاح في الواجهة.
 *
 * `lock`: يقفل صفّ الكوبون قبل الفحوص. إلزامي في مسار الاستخدام الفعلي.
 *
 * لماذا؟ السقف الكلّي محميّ بزيادة ذرّية في redeem()، لكن السقف لكل مستخدم
 * وشرط «العملاء الجدد» قراءتان عاديتان. عند READ COMMITTED يقرأ طلبان
 * متوازيان العدد صفراً معاً فيمرّان معاً — ويحصل العميل على خصمين من كوبون
 * «مرة واحدة لكل مستخدم». قفل صفّ الكوبون يُسلسل الطلبين فيرى الثاني أثر
 * الأول. المعاينة في الواجهة تستدعي الدالة بلا قفل: لا تكتب شيئاً ولا يجوز
 * أن تحجز صفاً عند كل ضغطة مفتاح.
 */
async function validateForUse({
  code, userId, productId = null, amount = 0, transaction = null, lock = false,
}) {
  const normalized = normalize(code);
  if (!normalized) return { valid: false, reason: 'أدخل رمز الكوبون' };

  const coupon = await Coupon.findOne({
    where: { code: normalized },
    transaction,
    ...(lock && transaction ? { lock: transaction.LOCK.UPDATE } : {}),
  });
  if (!coupon) return { valid: false, reason: 'رمز غير صحيح' };
  if (!coupon.is_active) return { valid: false, reason: 'الكوبون غير مفعّل' };

  const now = new Date();
  if (coupon.valid_from && new Date(coupon.valid_from) > now) {
    return { valid: false, reason: 'الكوبون لم يبدأ بعد' };
  }
  if (coupon.valid_until && new Date(coupon.valid_until) < now) {
    return { valid: false, reason: 'انتهت صلاحية الكوبون' };
  }
  if (coupon.usage_limit !== null && coupon.times_used >= coupon.usage_limit) {
    return { valid: false, reason: 'بلغ الكوبون سقف الاستخدام' };
  }

  if (coupon.per_user_limit !== null && userId) {
    const used = await CouponRedemption.count({
      where: { coupon_id: coupon.id, user_id: userId }, transaction,
    });
    if (used >= coupon.per_user_limit) {
      return { valid: false, reason: 'استخدمت هذا الكوبون بالفعل' };
    }
  }

  if (coupon.require_new_user && userId) {
    const profile = await GrowthProfile.findOne({ where: { user_id: userId }, transaction });
    if (profile?.first_paid_at) {
      return { valid: false, reason: 'الكوبون للعملاء الجدد فقط' };
    }
  }

  if (Array.isArray(coupon.applicable_product_ids) && coupon.applicable_product_ids.length) {
    if (!productId || !coupon.applicable_product_ids.includes(Number(productId))) {
      return { valid: false, reason: 'الكوبون لا ينطبق على هذا المنتج' };
    }
  }

  const gross = Number(amount) || 0;
  if (Number(coupon.min_purchase_amount) > 0 && gross < Number(coupon.min_purchase_amount)) {
    return {
      valid: false,
      reason: `الحد الأدنى للشراء ${Number(coupon.min_purchase_amount)} ${''}`.trim(),
    };
  }

  let discount = 0;
  let creditsGranted = 0;

  switch (coupon.discount_type) {
    case 'percentage': {
      discount = (gross * Number(coupon.discount_value)) / 100;
      if (coupon.max_discount_amount !== null && coupon.max_discount_amount !== undefined) {
        discount = Math.min(discount, Number(coupon.max_discount_amount));
      }
      break;
    }
    case 'fixed_amount':
      discount = Math.min(Number(coupon.discount_value), gross);
      break;
    case 'credit_grant':
      creditsGranted = parseInt(coupon.discount_value, 10) || 0;
      break;
    default:
      break;
  }

  discount = Math.max(0, Math.round(discount * 100) / 100);

  return {
    valid: true,
    coupon,
    discount,
    creditsGranted,
    netAmount: Math.max(0, Math.round((gross - discount) * 100) / 100),
  };
}

/**
 * يسجّل الاستخدام ويزيد العدّاد ذرّياً.
 * يُستدعى دائماً داخل معاملة الطلب: لو نجح الطلب وفشل تسجيل الاستخدام لأمكن
 * استعمال الكوبون مرات بلا حصر.
 */
async function redeem({
  coupon, userId, orderId = null, originalAmount = 0,
  discountApplied = 0, creditsGranted = 0, transaction,
}) {
  // زيادة ذرّية تحت شرط السقف: تُصيب صفر صفوف إن سبقنا أحدٌ إلى آخر استخدام.
  //
  // تُستعمل Model.update لا Model.increment: الأخيرة تُعيد في Sequelize 6
  // `[[[], 0]]` فلا يصل عدد الصفوف المتأثّرة إلى المستدعي — فيبقى الحارس
  // مكتوباً ولا يرمي أبداً، ويُسجَّل استخدام فوق السقف بصمت. `update` تُعيد
  // `[affectedCount]` فعلياً، وهو ما يجعل الفحص حقيقياً.
  if (coupon.usage_limit !== null) {
    const [affectedCount] = await Coupon.update(
      { times_used: sequelize.literal('times_used + 1') },
      { where: { id: coupon.id, times_used: { [Op.lt]: coupon.usage_limit } }, transaction }
    );
    if (!affectedCount) throw err.limitExceeded('بلغ الكوبون سقف الاستخدام');
  } else {
    await Coupon.increment({ times_used: 1 }, { where: { id: coupon.id }, transaction });
  }

  return CouponRedemption.create(
    {
      coupon_id: coupon.id,
      user_id: userId,
      code_snapshot: coupon.code,
      discount_type_snapshot: coupon.discount_type,
      discount_value_snapshot: coupon.discount_value,
      original_amount: originalAmount,
      discount_applied: discountApplied,
      credits_granted: creditsGranted,
      order_id: orderId,
      context_type: 'order',
    },
    { transaction }
  );
}

/** أداء الكوبون — لصفحة الكوبونات. */
async function performance(couponId) {
  const rows = await CouponRedemption.findAll({
    where: { coupon_id: couponId },
    attributes: ['discount_applied', 'original_amount', 'credits_granted', 'user_id'],
    raw: true,
  });

  const uniqueUsers = new Set(rows.map((r) => r.user_id)).size;
  const totalDiscount = rows.reduce((s, r) => s + Number(r.discount_applied || 0), 0);
  const grossInfluenced = rows.reduce((s, r) => s + Number(r.original_amount || 0), 0);

  return {
    redemptions: rows.length,
    unique_users: uniqueUsers,
    total_discount: Math.round(totalDiscount * 100) / 100,
    gross_influenced: Math.round(grossInfluenced * 100) / 100,
    net_revenue: Math.round((grossInfluenced - totalDiscount) * 100) / 100,
    credits_granted: rows.reduce((s, r) => s + Number(r.credits_granted || 0), 0),
  };
}

module.exports = { normalize, validateDefinition, validateForUse, redeem, performance };
