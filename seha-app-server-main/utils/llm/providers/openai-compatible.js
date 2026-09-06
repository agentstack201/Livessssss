// Adapter for every OpenAI chat-completions-compatible provider: Groq, Cerebras,
// OpenRouter, Mistral, Together, and most others. They differ only by baseUrl,
// so one adapter serves them all.
const { httpJson, AdapterError, isRetryableStatus } = require("../http");

/**
 * @param {object} p
 * @param {string} p.apiKey        raw (already decrypted) key
 * @param {string} p.baseUrl       e.g. https://api.groq.com/openai/v1
 * @param {string} p.model
 * @param {Array<{role,content}>} p.messages
 * @param {boolean} [p.json]       request a JSON object response
 * @param {number} [p.timeoutMs]
 * @returns {Promise<{text, usage, model, raw, statusCode}>}
 */
async function chat({ apiKey, baseUrl, model, messages, json = false, timeoutMs = 45000 }) {
  const url = `${String(baseUrl).replace(/\/$/, "")}/chat/completions`;
  const payload = {
    model,
    messages,
    temperature: 0.1,
    ...(json ? { response_format: { type: "json_object" } } : {}),
  };

  const res = await httpJson(
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        // OpenRouter recommends these; harmless elsewhere.
        "HTTP-Referer": process.env.FRONTEND_URL || "https://seha.local",
        "X-Title": "Seha Sick Leave Platform",
      },
      body: JSON.stringify(payload),
    },
    timeoutMs
  );

  if (!res.ok) {
    const body = res.body || {};
    // OpenAI-style bodies nest the error under `.error`. Mistral (and some
    // others) return it flat: {object:"error", message, type, code}. Without
    // this fallback, err.message is always undefined for Mistral and every
    // failure — 429 included — collapses to the uninformative `HTTP ${status}`,
    // hiding the actual reason (rate limit vs quota vs plan/billing issue).
    const err = body.error || body;
    const providerMessage = err.message || body.raw || `HTTP ${res.status}`;
    const hay = (providerMessage || "").toLowerCase();

    // Classify the error granularly so the pool can make intelligent decisions.
    // Only a true 401 means the key itself is invalid. A 403 from OpenRouter can
    // mean "model unavailable for free", content policy, or permission issues —
    // none of which should permanently disable the key.
    let code;
    let retryable = isRetryableStatus(res.status);

    if (res.status === 401) {
      code = "INVALID_KEY";
    } else if (res.status === 402) {
      code = "INSUFFICIENT_CREDITS";
    } else if (hay.includes("unavailable for free") || hay.includes("free tier")) {
      code = "FREE_TIER_UNAVAILABLE";
      retryable = true; // other keys/models may work
    } else if (res.status === 404 || hay.includes("not found") || hay.includes("does not exist")) {
      code = "MODEL_NOT_FOUND";
    } else if (res.status === 429) {
      code = "QUOTA";
    } else if (res.status === 403 && (hay.includes("content") || hay.includes("moderation") || hay.includes("safety"))) {
      code = "SAFETY_BLOCKED";
    } else if (res.status === 403) {
      code = "PERMISSION_DENIED";
    } else {
      code = "PROVIDER_ERROR";
    }

    throw new AdapterError({
      httpStatus: res.status,
      retryable,
      code,
      providerMessage,
      providerStatus: err.type || err.code || null,
      message: providerMessage,
    });
  }

  const choice = res.body && res.body.choices && res.body.choices[0];
  const text = (choice && choice.message && choice.message.content) || "";
  const u = (res.body && res.body.usage) || {};
  return {
    text,
    usage: {
      prompt_tokens: u.prompt_tokens || 0,
      completion_tokens: u.completion_tokens || 0,
      total_tokens: u.total_tokens || (u.prompt_tokens || 0) + (u.completion_tokens || 0),
    },
    model: (res.body && res.body.model) || model,
    raw: res.body,
    statusCode: res.status,
  };
}

// Validate a key without spending tokens: list the models it can see.
async function test({ apiKey, baseUrl, timeoutMs = 20000 }) {
  const url = `${String(baseUrl).replace(/\/$/, "")}/models`;
  const res = await httpJson(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${apiKey}` },
  }, timeoutMs);
  if (!res.ok) {
    const body = res.body || {};
    const err = body.error || body; // see comment in chat() re: flat-shaped provider errors
    return { ok: false, httpStatus: res.status, message: err.message || body.raw || `HTTP ${res.status}` };
  }
  const data = (res.body && (res.body.data || res.body.models)) || [];
  return { ok: true, modelsAvailable: Array.isArray(data) ? data.length : undefined };
}

module.exports = { chat, test };
