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
    const err = (res.body && res.body.error) || {};
    const providerMessage = err.message || (res.body && res.body.raw) || `HTTP ${res.status}`;
    const invalidKey = res.status === 401 || res.status === 403;
    throw new AdapterError({
      httpStatus: res.status,
      retryable: isRetryableStatus(res.status),
      code: invalidKey ? "INVALID_KEY" : res.status === 429 ? "QUOTA" : "PROVIDER_ERROR",
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

module.exports = { chat };
