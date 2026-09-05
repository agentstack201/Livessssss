// ───────────────────────────────────────────────────────────────────────────
// محرّك المكافآت — EVENT → RULE → ELIGIBILITY → GRANT → AUDIT
//
// حدّ الأمان الذي يمنع «النظام القابل للضبط بالكامل»: أنواع الأحداث قائمة
// مغلقة في invariants.REWARD_EVENT_TYPES، وكل نوع له مُقيِّم مكتوب هنا.
// الأدمن يضبط العتبة والمبلغ والسقوف والمدّة — ولا يخترع منطقاً. قاعدة بنوع
// حدث لا يعرفه المحرّك لن يُطلقها شيء أبداً، وهذا «إعداد وهمي» بعينه، لذلك
// يُرفض إنشاؤها أصلاً.
//
// منع التكرار ليس بعدّ متفائل بل بمفتاح idempotency فريد على مستوى قاعدة
// البيانات: rule:<id>:user:<id>:<reference>. حدث يصل مرتين لا يمنح مرتين.
// ───────────────────────────────────────────────────────────────────────────

const { Op } = require('sequelize');
const sequelize = require('../../config/database');
const { RewardRule, RewardGrant, GrowthProfile, GrowthOrder } = require('../models');
const INV = require('../config/invariants');
const credits = require('./credit.service');
const audit = require('./audit.service');
const { err } = require('../errors');

/**
 * مُقيِّمو الأهلية — واحد لكل نوع حدث معروف.
 * يعيد كلٌّ منهم { eligible, reference } — و reference يدخل مفتاح المنع.
 */
const EVALUATORS = {
  /** أول طلب مدفوع للمستخدم. */
  async first_purchase({ userId, data }) {
    const count = await GrowthOrder.count({ where: { user_id: userId, status: 'paid' } });
    return { eligible: count === 1, reference: data?.orderId ? `order:${data.orderId}` : 'first_purchase' };
  },

  /** بلوغ عدد استخدامات محدّد. العتبة من event_config. */
  async nth_usage({ userId, rule }) {
    const threshold = parseInt(rule.event_config?.threshold, 10) || 0;
    if (threshold <= 0) return { eligible: false };
    const profile = await GrowthProfile.findOne({ where: { user_id: userId } });
    const used = profile?.documents_created || 0;
    // يُمنح عند بلوغ العتبة بالضبط أو تجاوزها لأول مرة — المفتاح يمنع التكرار.
    return { eligible: used >= threshold, reference: `nth_usage:${threshold}` };
  },

  /** بلوغ عدد إحالات مفعَّلة محدّد. */
  async referral_milestone({ userId, rule }) {
    const threshold = parseInt(rule.event_config?.threshold, 10) || 0;
    if (threshold <= 0) return { eligible: false };
    const { ReferralEvent } = require('../models');
    const activated = await ReferralEvent.count({
      where: {
        referrer_id: userId,
        activated_at: { [Op.ne]: null },
        stage_reached: { [Op.ne]: 'revoked' },
      },
    });
    return { eligible: activated >= threshold, reference: `referral_milestone:${threshold}` };
  },

  /** ترقية إلى منتج أعلى سعراً. */
  async product_upgrade({ data }) {
    const ok = Boolean(data?.upgraded);
    return { eligible: ok, reference: data?.orderId ? `upgrade:${data.orderId}` : 'upgrade' };
  },
};

/** يتحقّق من تعريف قاعدة قبل الحفظ. */
function validateDefinition(payload) {
  const out = { ...payload };

  if (!INV.REWARD_EVENT_TYPES.includes(out.event_type)) {
    throw err.validation(
      `نوع حدث غير مدعوم «${out.event_type}». المدعوم: ${INV.REWARD_EVENT_TYPES.join(', ')}`
    );
  }

  const value = parseInt(out.reward_value, 10);
  if (!Number.isFinite(value) || value <= 0) throw err.validation('قيمة المكافأة غير صالحة');
  out.reward_value = INV.clamp(value, INV.HARD_MAX_SINGLE_GRANT);

  // الأنواع القائمة على عتبة تحتاجها فعلاً، وإلا كانت القاعدة بلا معنى.
  if (['nth_usage', 'referral_milestone'].includes(out.event_type)) {
    const threshold = parseInt(out.event_config?.threshold, 10);
    if (!Number.isFinite(threshold) || threshold <= 0) {
      throw err.validation('هذا النوع يتطلّب عتبة رقمية موجبة في إعداد الحدث');
    }
    out.event_config = { ...(out.event_config || {}), threshold };
  }

  const perUser = parseInt(out.max_grants_per_user, 10);
  out.max_grants_per_user = Number.isFinite(perUser) && perUser > 0 ? perUser : 1;

  return out;
}

/**
 * يقيّم كل القواعد المطابقة لحدث ويمنح ما يستحق.
 * آمن للاستدعاء المتكرّر: المفتاح الفريد يجعل الأثر at-most-once.
 */
async function evaluate({ userId, eventType, data = {}, req = null, actor = null }) {
  if (!INV.REWARD_EVENT_TYPES.includes(eventType)) return { granted: [] };

  const now = new Date();
  const rules = await RewardRule.findAll({
    where: {
      event_type: eventType,
      is_active: true,
      valid_from: { [Op.lte]: now },
      [Op.or]: [{ valid_until: null }, { valid_until: { [Op.gte]: now } }],
    },
  });

  const granted = [];

  for (const rule of rules) {
    // سقف كلّي على مستوى القاعدة.
    if (rule.max_total_grants !== null && rule.total_granted >= rule.max_total_grants) continue;

    const evaluator = EVALUATORS[rule.event_type];
    if (!evaluator) continue;

    let verdict;
    try {
      verdict = await evaluator({ userId, rule, data });
    } catch {
      continue; // قاعدة معطوبة لا تُسقط بقية القواعد
    }
    if (!verdict?.eligible) continue;

    // سقف لكل مستخدم.
    const existing = await RewardGrant.count({
      where: { reward_rule_id: rule.id, user_id: userId, status: { [Op.ne]: 'revoked' } },
    });
    if (existing >= rule.max_grants_per_user) continue;

    const reference = verdict.reference || eventType;
    const idempotencyKey = `rule:${rule.id}:user:${userId}:${reference}`;

    try {
      const result = await grantFromRule({ rule, userId, reference, idempotencyKey, req, actor });
      if (result) granted.push(result);
    } catch (e) {
      // منحة واحدة تفشل لا تُسقط البقية؛ يُسجَّل الخطأ ويُكمَل.
      console.error(`[growth] فشل منح المكافأة للقاعدة ${rule.id}:`, e.message);
    }
  }

  return { granted };
}

/** يمنح مكافأة قاعدة واحدة: سطر منحة + حركة رصيد + تدقيق، في معاملة واحدة. */
async function grantFromRule({ rule, userId, reference, idempotencyKey, req = null, actor = null }) {
  return sequelize.transaction(async (t) => {
    const [grant, created] = await RewardGrant.findOrCreate({
      where: { idempotency_key: idempotencyKey },
      defaults: {
        user_id: userId,
        source_kind: 'reward_rule',
        reward_rule_id: rule.id,
        event_reference: reference,
        // لقطة ثابتة: تعديل قيمة القاعدة غداً لا يعيد كتابة ما مُنح اليوم.
        value_snapshot: rule.reward_value,
        status: 'pending',
        idempotency_key: idempotencyKey,
      },
      transaction: t,
    });

    if (!created && grant.status === 'granted') return null; // مُنحت سلفاً

    const { transaction: tx } = await credits.apply({
      userId,
      type: 'grant',
      amount: grant.value_snapshot,
      sourceType: 'reward_rule',
      sourceId: String(grant.id),
      description: `مكافأة: ${rule.name}`,
      idempotencyKey: `credit:${idempotencyKey}`,
      metadata: { reward_rule_id: rule.id, reference },
      transaction: t,
      req,
    });

    await grant.update({ status: 'granted', credit_transaction_id: tx.id }, { transaction: t });
    await RewardRule.increment('total_granted', { where: { id: rule.id }, transaction: t });

    await audit.log({
      actor: actor || { id: null, name: 'النظام', role: 'system' },
      action: 'reward.grant',
      resourceType: 'reward_grant',
      resourceId: grant.id,
      after: { rule: rule.name, user_id: userId, amount: grant.value_snapshot },
      req, severity: 'info', transaction: t,
    });

    return {
      grantId: grant.id, ruleId: rule.id, ruleName: rule.name,
      amount: grant.value_snapshot, transactionId: tx.id,
    };
  });
}

/** إلغاء منحة قاعدة — بحركة تعويضية، كما في الإحالات. */
async function revokeGrant({ grantId, reason, actor, req }) {
  if (!reason?.trim()) throw err.reasonRequired();

  const grant = await RewardGrant.findByPk(grantId);
  if (!grant) throw err.notFound('المنحة');
  if (grant.status === 'revoked') throw err.conflict('المنحة مُلغاة سلفاً');

  if (grant.status !== 'granted') {
    await grant.update({
      status: 'revoked', revoked_by: actor?.id || null,
      revoked_at: new Date(), revoke_reason: reason,
    });
    return { revoked: true, recovered: 0, shortfall: 0 };
  }

  const rev = await credits.reverse({
    userId: grant.user_id,
    originalTransactionId: grant.credit_transaction_id,
    amount: grant.value_snapshot,
    sourceType: 'admin_adjustment',
    description: `إلغاء مكافأة #${grant.id}`,
    reason,
    performedBy: actor?.id || null,
    req, actor,
  });

  await grant.update({
    status: 'revoked',
    reversal_transaction_id: rev.transaction.id,
    revoked_by: actor?.id || null,
    revoked_at: new Date(),
    revoke_reason: reason,
  });

  return { revoked: true, recovered: rev.recovered, shortfall: rev.shortfall };
}

module.exports = { EVALUATORS, validateDefinition, evaluate, grantFromRule, revokeGrant };
