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
  // monthly_tokens / used_month are BIGINT → returned as STRINGS by pg. Comparing
  // them directly is a lexicographic ("1000" < "500") comparison, so coerce.
  if (Number(k.monthly_tokens) > 0 && Number(k.used_month) >= Number(k.monthly_tokens)) return false;
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
 * Reserve one request slot (and an estimated token cost) on the best eligible
 * key, atomically.
 * @param {string|null} model
 * @param {number[]} excludeIds        keys already tried this request
 * @param {string[]} blockedProviders  providers to skip this request (origin errors)
 * @param {number} estTokens           tokens to reserve up front, reconciled later
 * @returns {Promise<null | {id, provider, adapter, model, apiKey, baseUrl, estTokens}>}
 */
async function reserveKey(model, excludeIds, blockedProviders = [], estTokens = 0) {
  return sequelize.transaction(async (t) => {
    const rows = await ApiKey.findAll({
      where: {
        // Cooldown keys are included so an expired cooldown can be revived.
        status: { [Op.in]: ["active", "cooldown"] },
        ...(excludeIds.length ? { id: { [Op.notIn]: excludeIds } } : {}),
        ...(blockedProviders.length ? { provider: { [Op.notIn]: blockedProviders } } : {}),
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

    // Reserve BOTH the request slot and an estimated token cost up front. Tokens
    // are reconciled to the true count after the call. Reserving an estimate is
    // what keeps tpm/tpd from being overshot by a burst of concurrent requests
    // that would otherwise all read the same stale (pre-call) token counter.
    chosen.used_rpm += 1;
    chosen.used_rpd += 1;
    chosen.used_tpm += estTokens;
    chosen.used_tpd += estTokens;
    chosen.used_month = Number(chosen.used_month) + estTokens;
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
      estTokens,
    };
  });
}

async function recordSuccess(keyId, provider, model, usage, latencyMs, statusCode, estTokens = 0) {
  await sequelize.transaction(async (t) => {
    const k = await ApiKey.findByPk(keyId, { lock: t.LOCK.UPDATE, transaction: t });
    if (!k) return;
    applyResets(k, now());
    // Reconcile the up-front estimate with the true token count (delta may be
    // negative). Clamp at 0 in case a window reset already zeroed the counter.
    const delta = (usage.total_tokens || 0) - estTokens;
    k.used_tpm = Math.max(0, k.used_tpm + delta);
    k.used_tpd = Math.max(0, k.used_tpd + delta);
    k.used_month = Math.max(0, Number(k.used_month) + delta);
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

// Origin/region rejections are decided by the server IP, not the key, and
// persist — cool the key for a while so the pool stops re-selecting it on every
// request and falls through to other providers.
const ORIGIN_COOLDOWN_MS = 15 * 60_000;
const ORIGIN_CODES = ["UNSUPPORTED_REGION", "UNSUPPORTED_LOCATION"];

async function recordFailure(keyId, provider, model, err, latencyMs, estTokens = 0) {
  await sequelize.transaction(async (t) => {
    const k = await ApiKey.findByPk(keyId, { lock: t.LOCK.UPDATE, transaction: t });
    if (!k) return;

    // The call did not consume tokens, so give back the up-front estimate.
    applyResets(k, now());
    k.used_tpm = Math.max(0, k.used_tpm - estTokens);
    k.used_tpd = Math.max(0, k.used_tpd - estTokens);
    k.used_month = Math.max(0, Number(k.used_month) - estTokens);

    k.consecutive_failures += 1;
    k.last_error = (err.providerMessage || err.message || "").slice(0, 500);
    k.last_latency_ms = latencyMs;

    if (err.code === "INVALID_KEY" || err.httpStatus === 401) {
      k.status = "invalid"; // needs human attention; do not auto-retry
    } else if (err.code === "FREE_TIER_UNAVAILABLE") {
      // The free variant of a model is temporarily down — not the key's fault.
      // Brief cooldown then retry with other models/keys.
      k.status = "cooldown";
      k.cooldown_until = new Date(Date.now() + 5 * 60_000);
    } else if (err.code === "INSUFFICIENT_CREDITS") {
      // Account has no credits. Needs human action, but the key itself is valid.
      k.status = "cooldown";
      k.cooldown_until = new Date(Date.now() + 30 * 60_000);
    } else if (err.code === "PERMISSION_DENIED" && err.httpStatus === 403) {
      // 403 from provider — could be temporary model-level denial, not key auth.
      k.status = "cooldown";
      k.cooldown_until = new Date(Date.now() + 10 * 60_000);
    } else if (err.code === "SAFETY_BLOCKED") {
      // Content problem, not the key's fault — do not penalise it.
    } else if (ORIGIN_CODES.includes(err.code)) {
      k.status = "cooldown";
      k.cooldown_until = new Date(Date.now() + ORIGIN_COOLDOWN_MS);
    } else if (err.retryable) {
      const step = Math.min(k.consecutive_failures - 1, BACKOFF_STEPS_MS.length - 1);
      let cooldownMs = BACKOFF_STEPS_MS[step];
      if (k.consecutive_failures >= BREAKER_THRESHOLD) cooldownMs = Math.max(cooldownMs, BREAKER_COOLDOWN_MS);
      k.status = "cooldown";
      k.cooldown_until = new Date(Date.now() + cooldownMs);
    } else {
      // Any other terminal error (BAD_REQUEST, BILLING, unknown): don't leave the
      // key hot to be re-picked every request. Trip the breaker after repeats.
      if (k.consecutive_failures >= BREAKER_THRESHOLD) {
        k.status = "cooldown";
        k.cooldown_until = new Date(Date.now() + BREAKER_COOLDOWN_MS);
      }
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
  const blockedProviders = [];
  const failures = [];

  // Rough up-front token estimate (~4 chars/token) plus a completion budget, so a
  // concurrent burst reserves token budget instead of all reading a stale count.
  const promptChars = messages.reduce((n, m) => n + String(m.content || "").length, 0);
  const estTokens = Math.ceil(promptChars / 4) + 512;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const remaining = OVERALL_DEADLINE_MS - (Date.now() - startedAt);
    if (remaining <= 1000) break;

    const reserved = await reserveKey(opts.model, tried, blockedProviders, estTokens);
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
        // Never let a single attempt run past the overall deadline.
        timeoutMs: Math.min(45000, remaining),
      });
      const latency = Date.now() - t0;
      await recordSuccess(reserved.id, reserved.provider, reserved.model, out.usage, latency, out.statusCode, reserved.estTokens);
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
      await recordFailure(reserved.id, reserved.provider, reserved.model, err, latency, reserved.estTokens);
      failures.push(`${reserved.provider}#${reserved.id}: ${err.message}`);

      // A safety block is about the content, not the key — other keys will block
      // the same prompt, so stop and surface it instead of burning attempts.
      if (err.code === "SAFETY_BLOCKED") {
        const e = new Error(err.message || "تم حجب المحتوى بواسطة مرشّحات الأمان.");
        e.code = "SAFETY_BLOCKED"; e.httpStatus = 422;
        throw e;
      }
      // An origin/region rejection hits every key of this provider — skip the
      // whole provider for the rest of this request rather than trying each key.
      if (ORIGIN_CODES.includes(err.code) && !blockedProviders.includes(reserved.provider)) {
        blockedProviders.push(reserved.provider);
      }
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
