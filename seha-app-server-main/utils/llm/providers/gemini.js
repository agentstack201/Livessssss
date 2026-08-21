// Gemini adapter — single key, single model. The pool handles rotation, so this
// makes exactly one generateContent call and translates the result (or the
// failure) into the shared adapter contract. Error classification is reused from
// utils/gemini so all the origin/quota/billing handling stays in one place.
const { httpJson, AdapterError, isRetryableStatus } = require("../http");
const { classify } = require("../../gemini");

const API_BASE = "https://generativelanguage.googleapis.com";
const API_VERSION = "v1beta";

const SAFETY_SETTINGS = [
  "HARM_CATEGORY_HARASSMENT",
  "HARM_CATEGORY_HATE_SPEECH",
  "HARM_CATEGORY_SEXUALLY_EXPLICIT",
  "HARM_CATEGORY_DANGEROUS_CONTENT",
].map((category) => ({ category, threshold: "BLOCK_NONE" }));

// محتوى الرسالة: إمّا نصّ كما كان، أو مصفوفة أجزاء لدعم الملفات والصور.
// الشكل المقبول للأجزاء:
//   { type: 'text',  text: '...' }
//   { type: 'file',  mimeType: 'application/pdf', data: '<base64>' }
// أي شيء آخر يُتجاهل. الاستدعاءات النصّية القديمة تمرّ كما هي بلا تغيير.
function toParts(content) {
  if (typeof content === "string") return [{ text: content }];
  if (!Array.isArray(content)) return [{ text: String(content ?? "") }];
  const parts = [];
  for (const c of content) {
    if (!c) continue;
    if (c.type === "text" && c.text) parts.push({ text: c.text });
    else if (c.type === "file" && c.data && c.mimeType) {
      parts.push({ inlineData: { mimeType: c.mimeType, data: c.data } });
    }
  }
  return parts.length ? parts : [{ text: "" }];
}

// OpenAI-style messages -> Gemini contents + optional systemInstruction.
function toGemini(messages) {
  const contents = [];
  let system = null;
  for (const m of messages) {
    if (m.role === "system") {
      system = { parts: toParts(m.content) };
      continue;
    }
    contents.push({ role: m.role === "assistant" ? "model" : "user", parts: toParts(m.content) });
  }
  return { contents, system };
}

function extractText(body) {
  const candidate = body && body.candidates && body.candidates[0];
  if (!candidate) {
    const blockReason = body && body.promptFeedback && body.promptFeedback.blockReason;
    if (blockReason) {
      throw new AdapterError({
        httpStatus: 200,
        retryable: false,
        code: "SAFETY_BLOCKED",
        message: `تم حجب الطلب بواسطة مرشّحات الأمان (${blockReason}).`,
      });
    }
    return "";
  }
  const parts = (candidate.content && candidate.content.parts) || [];
  return parts.filter((p) => p && p.thought !== true).map((p) => p && p.text).filter(Boolean).join("");
}

async function chat({ apiKey, model, messages, json = false, timeoutMs = 45000 }) {
  const { contents, system } = toGemini(messages);

  const res = await httpJson(
    `${API_BASE}/${API_VERSION}/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents,
        ...(system ? { systemInstruction: system } : {}),
        safetySettings: SAFETY_SETTINGS,
        generationConfig: {
          temperature: 0.1,
          ...(json ? { responseMimeType: "application/json" } : {}),
        },
      }),
    },
    timeoutMs
  );

  if (!res.ok) {
    const c = classify(res.status, res.body);
    // Origin/region rejections are decided by the server IP, not the key — never
    // retryable, and the pool should surface them rather than churn keys.
    const originIssue = c.code === "UNSUPPORTED_REGION" || c.code === "UNSUPPORTED_LOCATION";
    throw new AdapterError({
      httpStatus: c.httpStatus,
      retryable: !originIssue && (c.retryable || isRetryableStatus(res.status)),
      code: c.code,
      providerMessage: c.message,
      providerStatus: c.googleStatus,
      message: c.arabic,
    });
  }

  const text = extractText(res.body);
  const um = (res.body && res.body.usageMetadata) || {};
  return {
    text,
    usage: {
      prompt_tokens: um.promptTokenCount || 0,
      completion_tokens: um.candidatesTokenCount || 0,
      total_tokens: um.totalTokenCount || 0,
    },
    model,
    raw: res.body,
    statusCode: res.status,
  };
}

// Validate a key without spending tokens: list the models it can see. The key
// goes in the x-goog-api-key header, never the URL query string (which would
// leak it into access/proxy logs).
async function test({ apiKey, timeoutMs = 20000 }) {
  const res = await httpJson(
    `${API_BASE}/${API_VERSION}/models?pageSize=1`,
    { method: "GET", headers: { "x-goog-api-key": apiKey } },
    timeoutMs
  );
  if (!res.ok) {
    const c = classify(res.status, res.body);
    return { ok: false, httpStatus: c.httpStatus, message: c.message || c.arabic, code: c.code };
  }
  const models = (res.body && res.body.models) || [];
  return { ok: true, modelsAvailable: models.length };
}

module.exports = { chat, test };
