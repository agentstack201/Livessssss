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

module.exports = { importLegacyGeminiKeys };
