// The rotation pool: one logical LLM backed by many keys.
//
// A request reserves a slot on the best eligible key inside a row-locked
// transaction (so parallel requests on the same instance cannot both spend the
// last unit of a limit), calls the provider, then records token usage. On a
// retryable failure the key is cooled down with exponential backoff and the next
// key is tried immediately; the caller never sees the churn. Invalid keys are
// marked and skipped. Three consecutive failures trip a 15-minute breaker.
const { Op } = require("sequelize");
const sequelize = require("../../config/database");
const ApiKey = require("../../models/apiKey.model");
const ApiKeyUsage = require("../../models/apiKeyUsage.model");
const { getProvider, modelsForKey } = require("./providers/registry");
const { decrypt } = require("./crypto");
const openai = require("./providers/openai-compatible");
const gemini = require("./providers/gemini");

const ADAPTERS = { openai, gemini };
const MAX_ATTEMPTS = 5;
const OVERALL_DEADLINE_MS = 110000;
const BACKOFF_STEPS_MS = [30_000, 120_000, 600_000, 1_800_000]; // 30s → 2m → 10m → 30m
const BREAKER_THRESHOLD = 3;
const BREAKER_COOLDOWN_MS = 15 * 60_000;

const now = () => new Date();

// ---- window boundaries -----------------------------------------------------
function nextMinute(d) { return new Date(d.getTime() + 60_000); }
function nextUtcMidnight(d) {
  const n = new Date(d);
  n.setUTCHours(24, 0, 0, 0);
  return n;
}
function nextMonthStart(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
}

// Roll a key's counters forward if its window elapsed. Mutates `k` in place.
function applyResets(k, t = now()) {
  if (!k.minute_reset_at || t >= k.minute_reset_at) {
    k.used_rpm = 0; k.used_tpm = 0; k.minute_reset_at = nextMinute(t);
  }
  if (!k.day_reset_at || t >= k.day_reset_at) {
    k.used_rpd = 0; k.used_tpd = 0; k.day_reset_at = nextUtcMidnight(t);
  }
  if (!k.month_reset_at || t >= k.month_reset_at) {
    k.used_month = 0; k.month_reset_at = nextMonthStart(t);
  }
}

// Is a key eligible right now for an optional required model?
// A key in cooldown becomes eligible again once cooldown_until has passed — the
// row is only reactivated to "active" when it is actually chosen (see reserveKey),
// so an expired cooldown must count as eligible here or the key stays stuck.
function isEligible(k, model, t = now()) {
  if (k.status !== "active" && k.status !== "cooldown") return false;
  if (k.cooldown_until && t < k.cooldown_until) return false;
  if (k.rpm > 0 && k.used_rpm >= k.rpm) return false;
  if (k.rpd > 0 && k.used_rpd >= k.rpd) return false;
  if (k.tpm > 0 && k.used_tpm >= k.tpm) return false;
  if (k.tpd > 0 && k.used_tpd >= k.tpd) return false;
  if (k.monthly_tokens > 0 && k.used_month >= k.monthly_tokens) return false;
  if (model && !modelsForKey(k).includes(model)) return false;
  return true;
}

// Utilisation = worst-case fraction of any limit already consumed (0..1).
function utilisation(k) {
  const ratios = [];
  if (k.rpm > 0) ratios.push(k.used_rpm / k.rpm);
  if (k.rpd > 0) ratios.push(k.used_rpd / k.rpd);
  if (k.tpm > 0) ratios.push(k.used_tpm / k.tpm);
  if (k.tpd > 0) ratios.push(k.used_tpd / k.tpd);
  if (k.monthly_tokens > 0) ratios.push(Number(k.used_month) / Number(k.monthly_tokens));
  return ratios.length ? Math.max(...ratios) : 0;
}

// priority desc → least-utilised → higher weight (weighted round-robin bias).
function pickBest(candidates) {
  return candidates.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    const ua = utilisation(a), ub = utilisation(b);
    if (ua !== ub) return ua - ub;
    if (b.weight !== a.weight) return b.weight - a.weight;
    // Deterministic tie-break that still spreads load: least-recently-used first.
    const la = a.last_used_at ? a.last_used_at.getTime() : 0;
    const lb = b.last_used_at ? b.last_used_at.getTime() : 0;
    return la - lb;
  })[0];
}

/**
 * Reserve one request slot on the best eligible key, atomically.
 * @returns {Promise<null | {id, provider, model, apiKey, baseUrl, row}>}
 */
async function reserveKey(model, excludeIds) {
  return sequelize.transaction(async (t) => {
    const rows = await ApiKey.findAll({
      where: {
        // Cooldown keys are included so an expired cooldown can be revived.
        status: { [Op.in]: ["active", "cooldown"] },
        ...(excludeIds.length ? { id: { [Op.notIn]: excludeIds } } : {}),
      },
      lock: t.LOCK.UPDATE,
      transaction: t,
    });

    const clock = now();
    const eligible = [];
    for (const k of rows) {
      applyResets(k, clock); // lazily rolls windows; persisted below if chosen
      if (isEligible(k, model, clock)) eligible.push(k);
    }
    if (eligible.length === 0) return null;

    const chosen = pickBest(eligible);
    const provider = getProvider(chosen.provider);
    if (!provider) return null;

    // Revive a key whose cooldown has elapsed now that it is being used again.
    if (chosen.status === "cooldown") {
      chosen.status = "active";
      chosen.cooldown_until = null;
    }

    // Reserve the request now; tokens are added after the call completes.
    chosen.used_rpm += 1;
    chosen.used_rpd += 1;
    chosen.last_used_at = clock;
    await chosen.save({
      fields: ["used_rpm", "used_rpd", "used_tpm", "used_tpd", "used_month",
        "minute_reset_at", "day_reset_at", "month_reset_at", "last_used_at",
        "status", "cooldown_until"],
      transaction: t,
    });

    const chosenModel = model
      || (Array.isArray(chosen.models) && chosen.models[0])
      || provider.defaultModel;

    return {
      id: chosen.id,
      provider: chosen.provider,
      adapter: provider.adapter,
      model: chosenModel,
      apiKey: decrypt(chosen.key_encrypted),
      baseUrl: chosen.base_url || provider.baseUrl,
    };
  });
}

async function recordSuccess(keyId, provider, model, usage, latencyMs, statusCode) {
  await sequelize.transaction(async (t) => {
    const k = await ApiKey.findByPk(keyId, { lock: t.LOCK.UPDATE, transaction: t });
    if (!k) return;
    applyResets(k, now());
    k.used_tpm += usage.total_tokens || 0;
    k.used_tpd += usage.total_tokens || 0;
    k.used_month = Number(k.used_month) + (usage.total_tokens || 0);
    k.consecutive_failures = 0;
    k.last_latency_ms = latencyMs;
    k.last_error = null;
    if (k.status === "cooldown") k.status = "active";
    await k.save({ transaction: t });
  });
  await ApiKeyUsage.create({
    key_id: keyId, provider, model,
    prompt_tokens: usage.prompt_tokens || 0,
    completion_tokens: usage.completion_tokens || 0,
    latency_ms: latencyMs, status_code: statusCode,
  }).catch(() => {});
}

async function recordFailure(keyId, provider, model, err, latencyMs) {
  await sequelize.transaction(async (t) => {
    const k = await ApiKey.findByPk(keyId, { lock: t.LOCK.UPDATE, transaction: t });
    if (!k) return;

    k.consecutive_failures += 1;
    k.last_error = (err.providerMessage || err.message || "").slice(0, 500);
    k.last_latency_ms = latencyMs;

    if (err.code === "INVALID_KEY" || err.httpStatus === 401 || err.httpStatus === 403) {
      k.status = "invalid"; // needs human attention; do not auto-retry
    } else if (err.retryable) {
      const step = Math.min(k.consecutive_failures - 1, BACKOFF_STEPS_MS.length - 1);
      let cooldownMs = BACKOFF_STEPS_MS[step];
      if (k.consecutive_failures >= BREAKER_THRESHOLD) cooldownMs = Math.max(cooldownMs, BREAKER_COOLDOWN_MS);
      k.status = "cooldown";
      k.cooldown_until = new Date(Date.now() + cooldownMs);
    }
    await k.save({ transaction: t });
  });
  await ApiKeyUsage.create({
    key_id: keyId, provider, model,
    latency_ms: latencyMs, status_code: err.httpStatus || 0,
    error: (err.providerMessage || err.message || "").slice(0, 500),
  }).catch(() => {});
}

// Earliest moment any key could become usable again — for the 503 message.
async function earliestReset() {
  const rows = await ApiKey.findAll({ where: { status: { [Op.in]: ["active", "cooldown"] } } });
  const times = [];
  for (const k of rows) {
    if (k.cooldown_until) times.push(k.cooldown_until.getTime());
    if (k.minute_reset_at) times.push(k.minute_reset_at.getTime());
  }
  if (!times.length) return null;
  return new Date(Math.min(...times));
}

/**
 * Send a chat completion through the pool.
 * @param {Array<{role,content}>} messages
 * @param {{model?:string, json?:boolean}} [opts]
 * @returns {Promise<{text, usage, model, provider, keyId, attempts}>}
 */
async function chat(messages, opts = {}) {
  const startedAt = Date.now();
  const tried = [];
  const failures = [];

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (Date.now() - startedAt > OVERALL_DEADLINE_MS) break;

    const reserved = await reserveKey(opts.model, tried);
    if (!reserved) break; // no eligible key left
    tried.push(reserved.id);

    const adapter = ADAPTERS[reserved.adapter];
    const t0 = Date.now();
    try {
      const out = await adapter.chat({
        apiKey: reserved.apiKey,
        baseUrl: reserved.baseUrl,
        model: reserved.model,
        messages,
        json: Boolean(opts.json),
      });
      const latency = Date.now() - t0;
      await recordSuccess(reserved.id, reserved.provider, reserved.model, out.usage, latency, out.statusCode);
      return {
        text: out.text,
        usage: out.usage,
        model: out.model,
        provider: reserved.provider,
        keyId: reserved.id,
        attempts: tried.length,
      };
    } catch (err) {
      const latency = Date.now() - t0;
      await recordFailure(reserved.id, reserved.provider, reserved.model, err, latency);
      failures.push(`${reserved.provider}#${reserved.id}: ${err.message}`);
      // INVALID_KEY / retryable both fall through to the next key immediately.
    }
  }

  const resetAt = await earliestReset();
  const e = new Error(
    failures.length
      ? `تعذّر تنفيذ الطلب عبر جميع المفاتيح المتاحة.`
      : `لا يوجد أي مفتاح صالح متاح حالياً. أضِف مفتاحاً أو انتظر تصفير الحدود.`
  );
  e.code = "POOL_EXHAUSTED";
  e.httpStatus = 503;
  e.details = failures;
  e.retryAt = resetAt;
  throw e;
}

module.exports = {
  chat,
  // exported for unit tests
  _internals: { applyResets, isEligible, utilisation, pickBest, nextUtcMidnight, nextMonthStart },
};
