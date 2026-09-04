// التحليلات وسجل التدقيق.

const { Op } = require('sequelize');
const { GrowthAuditLog, User } = require('../models');
const analytics = require('../services/analytics.service');
const { handle, ok } = require('../middlewares/growthAuth');

exports.overview = handle(async (req, res) => {
  const [metrics, alerts, trend] = await Promise.all([
    analytics.overview(),
    analytics.alerts(),
    analytics.revenueTrend({ days: parseInt(req.query.days, 10) || 30 }),
  ]);
  return ok(res, { ...metrics, alerts, revenue_trend: trend });
});

exports.alerts = handle(async (req, res) => ok(res, await analytics.alerts()));

exports.revenue = handle(async (req, res) => {
  const [trend, campaigns, products] = await Promise.all([
    analytics.revenueTrend({ days: parseInt(req.query.days, 10) || 30 }),
    analytics.campaignPerformance({ limit: 20 }),
    analytics.productPerformance(),
  ]);
  return ok(res, { trend, campaigns, products });
});

exports.growth = handle(async (req, res) => {
  const [activation, conversion, depth, retention, referral] = await Promise.all([
    analytics.activationRate(),
    analytics.paidConversion(),
    analytics.consumptionDepth(),
    analytics.retention(),
    analytics.referralHealth(),
  ]);
  return ok(res, { activation, conversion, depth, retention, referral });
});

exports.economics = handle(async (req, res) => {
  const [incentive, liability, credits] = await Promise.all([
    analytics.incentiveCostRatio({ days: parseInt(req.query.days, 10) || 30 }),
    analytics.creditLiability(),
    analytics.creditSummary({ days: parseInt(req.query.days, 10) || 30 }),
  ]);
  return ok(res, { incentive, liability, credit_movement: credits });
});

// ── سجل التدقيق ────────────────────────────────────────────────────────────

exports.auditLog = handle(async (req, res) => {
  const {
    actor_id: actorId, action, resource_type: resourceType, resource_id: resourceId,
    severity, from, to, q, page = 1, limit = 50,
  } = req.query;

  const where = {};
  if (actorId) where.actor_id = actorId;
  if (action) where.action = { [Op.iLike]: `%${action}%` };
  if (resourceType) where.resource_type = resourceType;
  if (resourceId) where.resource_id = String(resourceId);
  if (severity) where.severity = severity;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt[Op.gte] = new Date(from);
    if (to) where.createdAt[Op.lte] = new Date(to);
  }
  if (q) {
    where[Op.or] = [
      { action: { [Op.iLike]: `%${q}%` } },
      { actor_name: { [Op.iLike]: `%${q}%` } },
      { reason: { [Op.iLike]: `%${q}%` } },
    ];
  }

  const take = Math.min(parseInt(limit, 10) || 50, 200);
  const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * take;

  const { rows, count } = await GrowthAuditLog.findAndCountAll({
    where,
    include: [{ model: User, as: 'actor', attributes: ['id', 'name', 'email'] }],
    order: [['id', 'DESC']],
    limit: take,
    offset: skip,
  });

  return ok(res, {
    entries: rows,
    pagination: { page: Number(page), limit: take, total: count, pages: Math.ceil(count / take) },
  });
});

/** تصدير CSV — نفس الفلاتر، بلا ترقيم صفحات. */
exports.auditExport = handle(async (req, res) => {
  const where = {};
  if (req.query.from) where.createdAt = { [Op.gte]: new Date(req.query.from) };
  if (req.query.severity) where.severity = req.query.severity;

  const rows = await GrowthAuditLog.findAll({
    where, order: [['id', 'DESC']], limit: 10000,
  });

  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };

  const header = 'id,timestamp,actor,role,action,resource_type,resource_id,severity,reason,before,after,ip\n';
  const body = rows.map((r) => [
    r.id, r.createdAt?.toISOString(), r.actor_name, r.actor_role, r.action,
    r.resource_type, r.resource_id, r.severity, r.reason,
    r.before, r.after, r.ip_address,
  ].map(esc).join(',')).join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="growth-audit-${Date.now()}.csv"`);
  // BOM ليفتح Excel العربية بترميز صحيح.
  return res.send(`﻿${header}${body}`);
});
