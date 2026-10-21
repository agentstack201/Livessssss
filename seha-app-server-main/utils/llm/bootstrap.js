// One-time migration of the legacy single-setting key(s) into the pool.
//
// Before the pool existed, Gemini keys lived in the `gemini_api_key` setting
// (newline/comma separated). On first boot after this feature ships we copy any
// such keys into the api_keys table as encrypted gemini rows using
// gemini-2.5-flash, so the existing configuration keeps working with zero manual
// steps. Idempotent: it never runs once the pool already contains gemini keys.
const ApiKey = require("../../models/apiKey.model");
const { getSettingValue } = require("../../controller/settings.controller");
const { getProvider } = require("./providers/registry");
const { encrypt, decrypt, isConfigured } = require("./crypto");
const { parseKeys } = require("../gemini");

async function importLegacyGeminiKeys() {
  try {
    if (!isConfigured()) {
      console.warn("⚠️ Key pool import skipped: no ENCRYPTION_KEY/JWT_SECRET to encrypt with.");
      return;
    }

    const existing = await ApiKey.count({ where: { provider: "gemini" } });
    if (existing > 0) return; // already migrated

    const raw = await getSettingValue("gemini_api_key");
    const keys = parseKeys(raw);
    if (keys.length === 0) return;

    const gemini = getProvider("gemini");
    let created = 0;
    for (let i = 0; i < keys.length; i++) {
      await ApiKey.create({
        provider: "gemini",
        label: `Gemini ${i + 1}`,
        key_encrypted: encrypt(keys[i]),
        models: ["gemini-2.5-flash"],
        priority: 100,
        weight: 1,
        status: "active",
        rpm: gemini.defaultLimits.rpm,
        rpd: gemini.defaultLimits.rpd,
        tpm: gemini.defaultLimits.tpm,
        tpd: gemini.defaultLimits.tpd,
        monthly_tokens: gemini.defaultLimits.monthly_tokens,
      });
      created++;
    }
    console.log(`✅ Imported ${created} legacy Gemini key(s) into the pool.`);
  } catch (err) {
    console.error("⚠️ Legacy key import failed (non-fatal):", err.message);
  }
}

/**
 * Recovery: the old adapter classified every 403 (including "model unavailable
 * for free") as INVALID_KEY, which permanently marked the key. This one-time
 * pass reactivates OpenRouter keys whose last_error mentions "free" or generic
 * 403 text — they were never truly invalid.
 *
 * Also updates any stored `:free` model slugs to their paid equivalents so the
 * account's credits are actually used.
 */
async function recoverInvalidatedKeys() {
  try {
    const { Op } = require("sequelize");
    const invalid = await ApiKey.findAll({
      where: { status: "invalid", provider: "openrouter" },
    });
    if (invalid.length === 0) return;

    let recovered = 0;
    for (const k of invalid) {
      const err = (k.last_error || "").toLowerCase();
      // Only recover keys that were clearly hit by the 403 misclassification —
      // not keys that have a genuine auth problem (e.g. "invalid api key").
      const misclassified =
        err.includes("unavailable for free") ||
        err.includes("free tier") ||
        err.includes("forbidden") ||
        err.includes("http 403") ||
        err === "";

      if (misclassified) {
        k.status = "active";
        k.cooldown_until = null;
        k.consecutive_failures = 0;
        k.last_error = null;

        // Fix stored :free model slugs → paid slugs
        if (Array.isArray(k.models) && k.models.length) {
          k.models = k.models.map((m) =>
            m === "meta-llama/llama-3.3-70b-instruct:free"
              ? "meta-llama/llama-3.3-70b-instruct"
              : m
          );
        }

        await k.save();
        recovered++;
      }
    }
    if (recovered) {
      console.log(`🔧 Recovered ${recovered} OpenRouter key(s) wrongly marked invalid by the 403 bug.`);
    }
  } catch (err) {
    console.error("⚠️ Key recovery failed (non-fatal):", err.message);
  }
}

/**
 * Syncs the pool's OpenRouter key with the OPENROUTER_API_KEY env var on boot.
 */
async function importEnvOpenRouterKey() {
  try {
    const raw = (process.env.OPENROUTER_API_KEY || "").trim();
    if (!raw) return;
    if (!isConfigured()) return;

    // OpenRouter is the sole official provider: pause every other key so the
    // pool never routes to them (pickBest sorts priority descending).
    await ApiKey.update(
      { status: "paused" },
      { where: { provider: { [require("sequelize").Op.ne]: "openrouter" } } }
    );
    // The env var is the source of truth: drop any stored OpenRouter key that
    // differs (a rotated/revoked one, or one encrypted under an old ENCRYPTION_KEY).
    const or = getProvider("openrouter");
    let current = null;
    for (const k of await ApiKey.findAll({ where: { provider: "openrouter" } })) {
      let plain = null;
      try { plain = decrypt(k.key_encrypted); } catch { /* undecryptable → stale */ }
      if (plain === raw && !current) current = k;
      else await k.destroy();
    }

    if (current) {
      await current.update({
        status: "active", cooldown_until: null, consecutive_failures: 0, last_error: null,
        priority: 1000, weight: 10, models: or.models,
      });
      return;
    }

    await ApiKey.create({
      provider: "openrouter",
      label: "OpenRouter — Primary",
      key_encrypted: encrypt(raw),
      models: or.models,
      priority: 1000,
      weight: 10,
      status: "active",
      rpm: 0,
      rpd: 0,
      tpm: 0,
      tpd: 0,
      monthly_tokens: 0,
    });
    console.log("✅ OpenRouter key imported from OPENROUTER_API_KEY env var.");
  } catch (err) {
    console.error("⚠️ OpenRouter key import failed (non-fatal):", err.message);
  }
}

module.exports = { importLegacyGeminiKeys, recoverInvalidatedKeys, importEnvOpenRouterKey };

