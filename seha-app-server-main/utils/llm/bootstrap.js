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
const { encrypt, isConfigured } = require("./crypto");
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

module.exports = { importLegacyGeminiKeys, recoverInvalidatedKeys };

