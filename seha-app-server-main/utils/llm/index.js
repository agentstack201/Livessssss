// Unified LLM entry point for the rest of the app.
//
// Everything goes through the key pool. For backward compatibility, if the pool
// has no keys yet (e.g. a deployment that has not added any and whose legacy
// migration found nothing), it falls back to the original settings-based Gemini
// path so extraction keeps working with zero configuration changes.
const ApiKey = require("../../models/apiKey.model");
const pool = require("./pool");
const legacyGemini = require("../gemini");

async function poolHasKeys() {
  try {
    const n = await ApiKey.count({ where: { status: "active" } });
    return n > 0;
  } catch {
    return false;
  }
}

/**
 * Chat with automatic key rotation + failover.
 * @param {Array<{role,content}>} messages
 * @param {{model?:string, json?:boolean}} [opts]
 */
async function llmChat(messages, opts = {}) {
  return pool.chat(messages, opts);
}

/**
 * Single-prompt helper returning { text, provider, model, usage }.
 * Bridges to the legacy Gemini-only path when the pool is empty.
 */
async function llmGenerate(prompt, opts = {}) {
  if (await poolHasKeys()) {
    const out = await pool.chat([{ role: "user", content: prompt }], opts);
    return { text: out.text, provider: out.provider, model: out.model, usage: out.usage };
  }
  // Legacy fallback: keys still only in the gemini_api_key setting.
  const out = await legacyGemini.geminiGenerate(prompt, opts);
  return { text: out.text, provider: "gemini", model: out.usedModel, usage: null };
}

module.exports = { llmChat, llmGenerate, poolHasKeys };
