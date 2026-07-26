// Admin API for the key pool. Every response is safe to send to the browser:
// the raw key is never returned, only a last-4 fingerprint.
const { fn, col, Op } = require("sequelize");
const ApiKey = require("../models/apiKey.model");
const ApiKeyUsage = require("../models/apiKeyUsage.model");
const { getProvider, listProviders } = require("../utils/llm/providers/registry");
const { encrypt, decrypt, last4 } = require("../utils/llm/crypto");

const openai = require("../utils/llm/providers/openai-compatible");
const gemini = require("../utils/llm/providers/gemini");
const ADAPTERS = { openai, gemini };

const pct = (used, limit) => (limit > 0 ? Math.min(100, Math.round((Number(used) / Number(limit)) * 100)) : null);
const remaining = (used, limit) => (limit > 0 ? Math.max(0, Number(limit) - Number(used)) : null);

// Turn a stored row into a client-safe view. Never leaks key_encrypted.
function serialize(k, avgLatency) {
  return {
    id: k.id,
    provider: k.provider,
    providerLabel: (getProvider(k.provider) || {}).label || k.provider,
    label: k.label,
    fingerprint: last4(safeDecrypt(k.key_encrypted)),
    models: k.models,
    priority: k.priority,
    weight: k.weight,
    status: k.status,
    limits: { rpm: k.rpm, rpd: k.rpd, tpm: k.tpm, tpd: k.tpd, monthly_tokens: k.monthly_tokens },
    used: { rpm: k.used_rpm, rpd: k.used_rpd, tpm: k.used_tpm, tpd: k.used_tpd, month: k.used_month },
    remaining: {
      rpd: remaining(k.used_rpd, k.rpd),
      tpd: remaining(k.used_tpd, k.tpd),
      month: remaining(k.used_month, k.monthly_tokens),
    },
    usagePercent: {
      rpd: pct(k.used_rpd, k.rpd),
      tpd: pct(k.used_tpd, k.tpd),
      month: pct(k.used_month, k.monthly_tokens),
    },
    dayResetAt: k.day_reset_at,
    cooldownUntil: k.cooldown_until,
    consecutiveFailures: k.consecutive_failures,
    avgLatencyMs: avgLatency != null ? Math.round(avgLatency) : k.last_latency_ms,
    lastUsedAt: k.last_used_at,
    lastError: k.last_error,
  };
}

function safeDecrypt(enc) {
  try { return decrypt(enc); } catch { return ""; }
}

// GET /api/keys
exports.list = async (req, res) => {
  try {
    const keys = await ApiKey.findAll({ order: [["priority", "DESC"], ["id", "ASC"]] });

    // Average latency per key over the last 24h, in one grouped query.
    const since = new Date(Date.now() - 24 * 3600 * 1000);
    const rows = await ApiKeyUsage.findAll({
      attributes: ["key_id", [fn("AVG", col("latency_ms")), "avg"]],
      where: { createdAt: { [Op.gte]: since }, latency_ms: { [Op.ne]: null } },
      group: ["key_id"],
      raw: true,
    });
    const avg = {};
    rows.forEach((r) => { avg[r.key_id] = Number(r.avg); });

    const data = keys.map((k) => serialize(k, avg[k.id]));
    const totals = {
      total: keys.length,
      active: keys.filter((k) => k.status === "active").length,
      paused: keys.filter((k) => k.status === "paused").length,
      cooldown: keys.filter((k) => k.status === "cooldown").length,
      invalid: keys.filter((k) => k.status === "invalid").length,
      exhausted: keys.filter((k) => k.status === "exhausted").length,
      remainingTokensToday: keys.reduce((s, k) => s + (remaining(k.used_tpd, k.tpd) || 0), 0),
      remainingRequestsToday: keys.reduce((s, k) => s + (remaining(k.used_rpd, k.rpd) || 0), 0),
    };

    return res.status(200).json({ success: true, data, totals, providers: listProviders() });
  } catch (error) {
    console.error("keys.list failed:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/keys
exports.create = async (req, res) => {
  try {
    const { provider, key, label, models, priority, weight, limits } = req.body;
    const p = getProvider(provider);
    if (!p) return res.status(400).json({ success: false, message: "مزوّد غير معروف" });
    if (!key || !String(key).trim()) return res.status(400).json({ success: false, message: "المفتاح مطلوب" });

    const lim = limits || p.defaultLimits || {};
    const created = await ApiKey.create({
      provider: p.id,
      label: label || `${p.label}`,
      key_encrypted: encrypt(String(key).trim()),
      models: Array.isArray(models) && models.length ? models : (provider === "gemini" ? ["gemini-2.5-flash"] : []),
      priority: Number.isFinite(priority) ? priority : 100,
      weight: Number.isFinite(weight) ? weight : 1,
      status: "active",
      rpm: lim.rpm || 0, rpd: lim.rpd || 0, tpm: lim.tpm || 0, tpd: lim.tpd || 0,
      monthly_tokens: lim.monthly_tokens || 0,
    });
    return res.status(201).json({ success: true, data: serialize(created) });
  } catch (error) {
    console.error("keys.create failed:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/keys/:id
exports.update = async (req, res) => {
  try {
    const k = await ApiKey.findByPk(req.params.id);
    if (!k) return res.status(404).json({ success: false, message: "المفتاح غير موجود" });

    const { label, status, priority, weight, models, limits, key } = req.body;
    if (label !== undefined) k.label = label;
    if (priority !== undefined) k.priority = priority;
    if (weight !== undefined) k.weight = weight;
    if (Array.isArray(models)) k.models = models;
    if (status && ["active", "paused"].includes(status)) {
      k.status = status;
      if (status === "active") { k.cooldown_until = null; k.consecutive_failures = 0; }
    }
    if (limits) {
      ["rpm", "rpd", "tpm", "tpd"].forEach((f) => { if (limits[f] !== undefined) k[f] = limits[f]; });
      if (limits.monthly_tokens !== undefined) k.monthly_tokens = limits.monthly_tokens;
    }
    if (key && String(key).trim()) k.key_encrypted = encrypt(String(key).trim());
    await k.save();
    return res.status(200).json({ success: true, data: serialize(k) });
  } catch (error) {
    console.error("keys.update failed:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/keys/:id
exports.remove = async (req, res) => {
  try {
    const k = await ApiKey.findByPk(req.params.id);
    if (!k) return res.status(404).json({ success: false, message: "المفتاح غير موجود" });
    await k.destroy();
    return res.status(200).json({ success: true, message: "تم حذف المفتاح" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/keys/:id/reset — zero counters, clear cooldown, reactivate.
exports.reset = async (req, res) => {
  try {
    const k = await ApiKey.findByPk(req.params.id);
    if (!k) return res.status(404).json({ success: false, message: "المفتاح غير موجود" });
    Object.assign(k, {
      used_rpm: 0, used_rpd: 0, used_tpm: 0, used_tpd: 0, used_month: 0,
      minute_reset_at: null, day_reset_at: null, month_reset_at: null,
      cooldown_until: null, consecutive_failures: 0, last_error: null,
      status: k.status === "invalid" || k.status === "cooldown" ? "active" : k.status,
    });
    await k.save();
    return res.status(200).json({ success: true, data: serialize(k) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/keys/:id/test — live-check the key against its provider.
exports.test = async (req, res) => {
  try {
    const k = await ApiKey.findByPk(req.params.id);
    if (!k) return res.status(404).json({ success: false, message: "المفتاح غير موجود" });
    const p = getProvider(k.provider);
    const adapter = p && ADAPTERS[p.adapter];
    if (!adapter || !adapter.test) {
      return res.status(400).json({ success: false, message: "الاختبار غير مدعوم لهذا المزوّد" });
    }
    const result = await adapter.test({ apiKey: safeDecrypt(k.key_encrypted), baseUrl: k.base_url || p.baseUrl });

    if (result.ok) {
      if (k.status === "invalid") { k.status = "active"; k.last_error = null; }
      await k.save();
      return res.status(200).json({ success: true, working: true, message: `المفتاح سليم — ${result.modelsAvailable || 0} موديل متاح` });
    }
    if (result.httpStatus === 401 || result.httpStatus === 403 || result.code === "INVALID_KEY") {
      k.status = "invalid"; k.last_error = result.message; await k.save();
    }
    return res.status(200).json({ success: true, working: false, message: result.message, httpStatus: result.httpStatus });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
