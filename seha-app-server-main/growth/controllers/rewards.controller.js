// المكافآت — قواعد الأحداث وسجل المنح.
// أنواع الأحداث قائمة مغلقة: الأدمن يضبط العتبات والمبالغ لا المنطق.

const { Op } = require('sequelize');
const { RewardRule, RewardGrant, User, Campaign } = require('../models');
const rewards = require('../services/reward.service');
const audit = require('../services/audit.service');
const INV = require('../config/invariants');
const { handle, ok } = require('../middlewares/growthAuth');
const { err } = require('../errors');

const EDITABLE = [
  'name', 'description', 'event_type', 'event_config', 'reward_type',
  'reward_value', 'max_grants_per_user', 'max_total_grants',
  'campaign_id', 'valid_from', 'valid_until', 'is_active',
];

const EVENT_LABELS = {
  first_purchase: 'أول عملية شراء',
  nth_usage: 'بلوغ عدد استخدامات',
  referral_milestone: 'بلوغ عدد إحالات مفعّلة',
  product_upgrade: 'الترقية إلى منتج أعلى',
};

function pick(body) {
  const out = {};
  for (const f of EDITABLE) if (Object.hasOwn(body, f)) out[f] = body[f];
  return out;
}

/** أنواع الأحداث المدعومة — تملأ القائمة المنسدلة في اللوحة. */
exports.eventTypes = handle(async (req, res) =>
  ok(res, INV.REWARD_EVENT_TYPES.map((t) => ({
    value: t,
    label: EVENT_LABELS[t] || t,
    needs_threshold: ['nth_usage', 'referral_milestone'].includes(t),
  }))));

exports.list = handle(async (req, res) => {
  const { active, event_type: eventType } = req.query;
  const where = {};
  if (active === 'true') where.is_active = true;
  if (active === 'false') where.is_active = false;
  if (eventType) where.event_type = eventType;

  const rules = await RewardRule.findAll({
    where,
    include: [{ model: Campaign, as: 'campaign', attributes: ['id', 'name'] }],
    order: [['id', 'DESC']],
  });

  return ok(res, rules.map((r) => ({
    ...r.get({ plain: true }),
    event_label: EVENT_LABELS[r.event_type] || r.event_type,
    // التكلفة الفعلية بجانب كل قاعدة: قاعدة بلا رقم تكلفة تُدار بالعمى.
    total_cost: r.total_granted * r.reward_value,
  })));
});

exports.create = handle(async (req, res) => {
  const payload = rewards.validateDefinition(pick(req.body));
  if (!payload.name) throw err.validation('اسم القاعدة مطلوب');

  const rule = await RewardRule.create({ ...payload, created_by: req.user.id });

  await audit.log({
    actor: req.user, action: 'reward.rule_create', resourceType: 'reward_rule', resourceId: rule.id,
    after: {
      name: rule.name, event_type: rule.event_type,
      reward_value: rule.reward_value, event_config: rule.event_config,
    },
    req, severity: 'critical',
  });

  return ok(res, rule, 'تم إنشاء القاعدة', 201);
});

exports.update = handle(async (req, res) => {
  const rule = await RewardRule.findByPk(req.params.id);
  if (!rule) throw err.notFound('القاعدة');

  const merged = { ...rule.get({ plain: true }), ...pick(req.body) };
  const payload = rewards.validateDefinition(merged);

  const before = audit.snapshot(rule, EDITABLE);
  await rule.update(pick(payload));
  const changes = audit.diff(before, rule, EDITABLE);

  if (changes.changed) {
    await audit.log({
      actor: req.user, action: 'reward.rule_update', resourceType: 'reward_rule', resourceId: rule.id,
      before: changes.before, after: changes.after, req, severity: 'critical',
    });
  }

  return ok(res, rule, 'تم حفظ التعديلات');
});

exports.remove = handle(async (req, res) => {
  const rule = await RewardRule.findByPk(req.params.id);
  if (!rule) throw err.notFound('القاعدة');

  const before = audit.snapshot(rule, ['name', 'event_type', 'reward_value']);
  await rule.destroy();

  await audit.log({
    actor: req.user, action: 'reward.rule_delete', resourceType: 'reward_rule', resourceId: rule.id,
    before, reason: req.body?.reason || null, req, severity: 'critical',
  });

  return ok(res, { deleted: true }, 'تم حذف القاعدة');
});

exports.grants = handle(async (req, res) => {
  const { status, rule_id: ruleId, user_id: userId, page = 1, limit = 50 } = req.query;
  const where = {};
  if (status) where.status = status;
  if (ruleId) where.reward_rule_id = ruleId;
  if (userId) where.user_id = userId;

  const take = Math.min(parseInt(limit, 10) || 50, 200);
  const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * take;

  const { rows, count } = await RewardGrant.findAndCountAll({
    where,
    include: [
      { model: User, as: 'user', attributes: ['id', 'name', 'email'] },
      { model: RewardRule, as: 'rule', attributes: ['id', 'name', 'event_type'] },
    ],
    order: [['id', 'DESC']],
    limit: take,
    offset: skip,
  });

  return ok(res, {
    grants: rows,
    pagination: { page: Number(page), limit: take, total: count, pages: Math.ceil(count / take) },
  });
});

exports.revokeGrant = handle(async (req, res) => {
  const { reason } = req.body;
  if (!reason?.trim()) throw err.reasonRequired();

  const result = await rewards.revokeGrant({
    grantId: req.params.grantId, reason, actor: req.user, req,
  });

  return ok(res, result, result.shortfall > 0
    ? `تم الإلغاء. استُرجع ${result.recovered} وسُجّل ${result.shortfall} ديناً`
    : 'تم إلغاء المكافأة');
});

/** فعالية القواعد — كم كلّفت وكم مستخدماً مسّت. */
exports.effectiveness = handle(async (req, res) => {
  const rules = await RewardRule.findAll({ paranoid: true });
  const grants = await RewardGrant.findAll({
    where: { source_kind: 'reward_rule', status: 'granted' },
    attributes: ['reward_rule_id', 'user_id', 'value_snapshot'],
    raw: true,
  });

  const byRule = new Map();
  for (const g of grants) {
    if (!byRule.has(g.reward_rule_id)) byRule.set(g.reward_rule_id, { users: new Set(), cost: 0, count: 0 });
    const entry = byRule.get(g.reward_rule_id);
    entry.users.add(g.user_id);
    entry.cost += g.value_snapshot;
    entry.count += 1;
  }

  return ok(res, rules.map((r) => {
    const e = byRule.get(r.id) || { users: new Set(), cost: 0, count: 0 };
    return {
      id: r.id, name: r.name, event_type: r.event_type,
      event_label: EVENT_LABELS[r.event_type] || r.event_type,
      is_active: r.is_active,
      grants: e.count, unique_users: e.users.size, credits_cost: e.cost,
    };
  }));
});
