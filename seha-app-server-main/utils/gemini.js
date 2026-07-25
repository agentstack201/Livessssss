// ---------------------------------------------------------------------------
// Google Gemini integration layer.
//
// This talks to the Generative Language REST API directly with fetch instead of
// going through @google/generative-ai. The SDK pinned an API version and a model
// surface of its own, so a model that Google had published could still fail
// locally with a version-mismatch error that surfaced to the user as a bare
// "فشل في استخراج البيانات". Speaking REST removes that whole class of failure.
//
// Design points:
//   * Keys are sanitised hard. They are pasted from a phone into an RTL page, so
//     they routinely arrive carrying directional marks, zero-width characters or
//     a non-breaking space — invisible in the input yet enough to make Google
//     reject the key as invalid.
//   * Model names are discovered per key via ListModels rather than hardcoded, so
//     a retired or renamed model can never break extraction again.
//   * Errors are classified from Google's machine-readable error.details[].reason
//     rather than by matching English message text.
//   * Transient failures (429/500/503/504) retry with exponential backoff and
//     jitter; terminal ones (bad key, bad request) fail fast with a real reason.
// ---------------------------------------------------------------------------
const { getSettingValue } = require("../controller/settings.controller");

const API_BASE = "https://generativelanguage.googleapis.com";
const API_VERSION = "v1beta";

const ATTEMPT_TIMEOUT_MS = 45000;   // per HTTP attempt
const OVERALL_DEADLINE_MS = 110000; // whole operation, below typical proxy limits
const MAX_ATTEMPTS = 4;
const MODEL_CACHE_TTL_MS = 10 * 60 * 1000;

// Preference order applied to whatever the key actually exposes. Flash tiers are
// fast and cheap enough for field extraction; pro is kept as a last resort.
const MODEL_PREFERENCE = [
  /^gemini-flash-latest$/,
  /^gemini-3(\.\d+)?-flash(?!.*(preview|exp))/,
  /^gemini-2\.5-flash$/,
  /^gemini-2\.0-flash$/,
  /^gemini-.*-flash-latest$/,
  /^gemini-.*flash(?!.*(preview|exp|thinking))/,
  /^gemini-2\.5-pro$/,
  /^gemini-.*pro(?!.*(preview|exp|vision))/,
];

// Used only if ListModels itself cannot be reached.
const FALLBACK_MODELS = [
  "gemini-flash-latest",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
];

// ---------------------------------------------------------------------------
// Key handling
// ---------------------------------------------------------------------------

// Characters that survive a copy/paste but are not part of any API key:
// LRM/RLM and the other bidi controls, zero-width space/joiners, BOM, and NBSP.
const INVISIBLE_RE = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\u206A-\u206F\uFEFF\u00A0]/g;

function sanitizeKey(raw) {
  return String(raw || "")
    .replace(INVISIBLE_RE, "")
    // Quotes picked up when pasting from a note or a chat message. Whitespace is
    // stripped outright rather than trimmed: a key never contains any, and a
    // phone keyboard will happily insert one mid-paste.
    .replace(/["'`]/g, "")
    .replace(/\s+/g, "");
}

// Google AI Studio keys look like AIza + 35 chars of [A-Za-z0-9_-].
function looksLikeKey(key) {
  return /^AIza[A-Za-z0-9_\-]{30,}$/.test(key);
}

function maskKey(key) {
  if (!key) return "(فارغ)";
  if (key.length <= 12) return `${key.slice(0, 4)}…`;
  return `${key.slice(0, 8)}…${key.slice(-4)}`;
}

// Accepts several keys separated by any whitespace, comma or semicolon. Splitting
// on whitespace is safe because a key can never contain any, and it means two
// keys pasted onto one line are still read as two.
function parseKeys(raw) {
  return [
    ...new Set(
      String(raw || "")
        .replace(INVISIBLE_RE, "")
        .split(/[\s,;]+/)
        .map(sanitizeKey)
        .filter(Boolean)
    ),
  ];
}

async function loadKeys() {
  const fromDb = parseKeys(await getSettingValue("gemini_api_key"));
  const fromEnv = parseKeys(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
  return [...new Set([...fromDb, ...fromEnv])];
}

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

// Maps a Google error payload to a stable code, an Arabic explanation, and
// whether retrying could possibly help.
function classify(httpStatus, body) {
  const err = (body && body.error) || {};
  const status = err.status || "";
  const message = err.message || "";
  const reasons = (err.details || [])
    .map((d) => d && d.reason)
    .filter(Boolean);
  const reason = reasons[0] || "";
  const hay = `${status} ${reason} ${message}`.toLowerCase();

  const retryInfo = (err.details || []).find(
    (d) => d && typeof d["@type"] === "string" && d["@type"].includes("RetryInfo")
  );
  const retryDelayMs = retryInfo && typeof retryInfo.retryDelay === "string"
    ? Math.round(parseFloat(retryInfo.retryDelay) * 1000) || 0
    : 0;

  const out = (code, arabic, retryable) => ({
    code, arabic, retryable, httpStatus, googleStatus: status, reason, message, retryDelayMs,
  });

  if (reason === "API_KEY_INVALID" || hay.includes("api key not valid")) {
    return out("INVALID_KEY", "المفتاح غير صالح — انسخه من جديد من Google AI Studio (تأكد أنه كامل ويبدأ بـ AIza).", false);
  }
  if (reason.includes("API_KEY_HTTP_REFERRER") || reason.includes("API_KEY_IP") || reason.includes("API_KEY_ANDROID") || reason.includes("API_KEY_IOS")) {
    return out("KEY_RESTRICTED", "المفتاح مقيَّد (Application restrictions). افتح إعدادات المفتاح واختر None، أو اسمح لخادمك.", false);
  }
  if (reason === "SERVICE_DISABLED" || hay.includes("has not been used in project") || hay.includes("is disabled")) {
    return out("API_DISABLED", "واجهة Generative Language غير مفعّلة في مشروع Google الخاص بالمفتاح — فعّلها ثم انتظر دقيقة.", true);
  }
  if (reason === "BILLING_DISABLED" || hay.includes("billing")) {
    return out("BILLING", "الفوترة غير مفعّلة على مشروع Google المرتبط بالمفتاح.", false);
  }
  if (status === "FAILED_PRECONDITION") {
    return out("UNSUPPORTED_REGION", "الطلب مرفوض لسبب يتعلق بالدولة أو بالفوترة (الخطة المجانية غير متاحة في بعض الدول). فعّل الفوترة أو استخدم مفتاحاً من مشروع مفوتر.", false);
  }
  if (httpStatus === 404 || status === "NOT_FOUND") {
    return out("MODEL_NOT_FOUND", "الموديل المطلوب غير متاح لهذا المفتاح — سيتم التحويل تلقائياً لموديل متاح.", false);
  }
  if (httpStatus === 429 || status === "RESOURCE_EXHAUSTED") {
    return out("QUOTA", "تم تجاوز الحصة أو معدّل الطلبات لهذا المفتاح — سيتم التحويل للمفتاح التالي.", true);
  }
  if (httpStatus === 403 || status === "PERMISSION_DENIED") {
    return out("PERMISSION", "المفتاح لا يملك صلاحية الوصول لهذه الواجهة.", false);
  }
  if (httpStatus === 503 || status === "UNAVAILABLE" || hay.includes("overloaded")) {
    return out("OVERLOADED", "خدمة Google مزدحمة مؤقتاً — إعادة المحاولة تلقائياً.", true);
  }
  if (httpStatus === 500 || status === "INTERNAL") {
    return out("INTERNAL", "خطأ داخلي مؤقت لدى Google — إعادة المحاولة تلقائياً.", true);
  }
  if (httpStatus === 504 || status === "DEADLINE_EXCEEDED") {
    return out("TIMEOUT", "انتهت مهلة الطلب — إعادة المحاولة تلقائياً.", true);
  }
  if (httpStatus === 400) {
    return out("BAD_REQUEST", `طلب غير صالح: ${message || "تحقق من البيانات المُرسلة"}`, false);
  }
  return out("UNKNOWN", message || `خطأ غير متوقع (رمز ${httpStatus})`, httpStatus >= 500);
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

async function httpJson(url, options = {}, timeoutMs = ATTEMPT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const text = await res.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text }; }
    return { ok: res.ok, status: res.status, body };
  } catch (e) {
    const aborted = e && (e.name === "AbortError" || e.name === "TimeoutError");
    return {
      ok: false,
      status: aborted ? 504 : 0,
      body: {
        error: {
          status: aborted ? "DEADLINE_EXCEEDED" : "NETWORK",
          message: aborted ? "انتهت مهلة الاتصال بخدمة Google" : `تعذّر الاتصال بخدمة Google: ${e.message}`,
        },
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Exponential backoff with full jitter, honouring Google's own RetryInfo.
function backoffDelay(attempt, suggestedMs) {
  if (suggestedMs > 0) return Math.min(suggestedMs, 20000);
  const capped = Math.min(1000 * 2 ** attempt, 8000);
  return Math.floor(Math.random() * capped);
}

// ---------------------------------------------------------------------------
// Model discovery
// ---------------------------------------------------------------------------

const modelCache = new Map(); // sanitised key -> { models: string[], at: number }

async function listModels(key) {
  const cached = modelCache.get(key);
  if (cached && Date.now() - cached.at < MODEL_CACHE_TTL_MS) {
    return { models: cached.models, cached: true };
  }

  const res = await httpJson(
    `${API_BASE}/${API_VERSION}/models?key=${encodeURIComponent(key)}&pageSize=200`,
    { method: "GET" },
    20000
  );

  if (!res.ok) {
    return { models: null, error: classify(res.status, res.body) };
  }

  const models = ((res.body && res.body.models) || [])
    .filter((m) => Array.isArray(m.supportedGenerationMethods)
      ? m.supportedGenerationMethods.includes("generateContent")
      : true)
    .map((m) => String(m.name || "").replace(/^models\//, ""))
    .filter(Boolean);

  modelCache.set(key, { models, at: Date.now() });
  return { models, cached: false };
}

function rankModels(available, preferred) {
  const pool = [...new Set(available)];
  const ordered = [];

  // An explicitly configured model wins, but only if the key really has it.
  if (preferred && pool.includes(preferred)) ordered.push(preferred);

  for (const pattern of MODEL_PREFERENCE) {
    for (const m of pool) {
      if (!ordered.includes(m) && pattern.test(m)) ordered.push(m);
    }
  }
  // Anything left, so we never end up with an empty list.
  for (const m of pool) if (!ordered.includes(m)) ordered.push(m);

  return ordered;
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

// Medical records contain injuries and diagnoses; the default safety thresholds
// can block them, and a block arrives as HTTP 200 with no candidate text, which
// naive code reads as success. Thresholds are relaxed and blocks are detected.
const SAFETY_SETTINGS = [
  "HARM_CATEGORY_HARASSMENT",
  "HARM_CATEGORY_HATE_SPEECH",
  "HARM_CATEGORY_SEXUALLY_EXPLICIT",
  "HARM_CATEGORY_DANGEROUS_CONTENT",
].map((category) => ({ category, threshold: "BLOCK_NONE" }));

function extractText(body) {
  const candidate = body && body.candidates && body.candidates[0];

  if (!candidate) {
    const blockReason = body && body.promptFeedback && body.promptFeedback.blockReason;
    if (blockReason) {
      const e = new Error(`تم حجب الطلب بواسطة مرشّحات الأمان (${blockReason}). عدّل النص وحاول مجدداً.`);
      e.code = "SAFETY_BLOCKED";
      throw e;
    }
    return null;
  }

  const finish = candidate.finishReason;
  if (finish && !["STOP", "MAX_TOKENS"].includes(finish)) {
    const e = new Error(`توقّف التوليد بسبب: ${finish}`);
    e.code = "FINISH_" + finish;
    throw e;
  }

  const parts = (candidate.content && candidate.content.parts) || [];
  const text = parts.map((p) => p && p.text).filter(Boolean).join("");
  return text || null;
}

/**
 * Run a prompt through Gemini, moving across keys and models until one works.
 *
 * @param {string} prompt
 * @param {{ json?: boolean }} [opts] json:true asks Google for application/json
 * @returns {Promise<{text: string, usedKeyIndex: number, usedModel: string, attempts: object[]}>}
 */
async function geminiGenerate(prompt, opts = {}) {
  const startedAt = Date.now();
  const keys = await loadKeys();

  if (keys.length === 0) {
    const e = new Error("لا يوجد أي مفتاح ربط مع Google Gemini. أضف مفتاحاً في صفحة الإعدادات.");
    e.code = "NO_KEYS";
    throw e;
  }

  const malformed = keys.filter((k) => !looksLikeKey(k));
  if (malformed.length === keys.length) {
    const e = new Error(
      `صيغة المفتاح غير صحيحة (${maskKey(keys[0])}). مفتاح Google يبدأ بـ AIza ويتكوّن من ٣٩ خانة تقريباً — انسخه كاملاً من Google AI Studio.`
    );
    e.code = "MALFORMED_KEY";
    throw e;
  }

  const configuredModel =
    (await getSettingValue("gemini_model")) || process.env.GEMINI_MODEL || null;

  const attempts = [];
  let lastClassified = null;

  for (let ki = 0; ki < keys.length; ki++) {
    const key = keys[ki];
    const label = `مفتاح#${ki + 1} (${maskKey(key)})`;

    if (!looksLikeKey(key)) {
      attempts.push({ key: label, stage: "validate", error: "صيغة غير صحيحة — تم تخطّيه" });
      continue;
    }

    // Ask this key which models it can actually use.
    const discovery = await listModels(key);
    let candidates;

    if (discovery.models && discovery.models.length) {
      candidates = rankModels(discovery.models, configuredModel).slice(0, 4);
    } else {
      if (discovery.error) {
        attempts.push({ key: label, stage: "listModels", error: discovery.error.arabic, code: discovery.error.code });
        lastClassified = discovery.error;
        // A key that cannot even list models will not generate either.
        if (!discovery.error.retryable) continue;
      }
      candidates = FALLBACK_MODELS;
    }

    for (const model of candidates) {
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        if (Date.now() - startedAt > OVERALL_DEADLINE_MS) {
          const e = new Error("انتهت المهلة الكلية أثناء محاولة الاتصال بـ Gemini.");
          e.code = "DEADLINE";
          e.details = attempts;
          throw e;
        }

        const t0 = Date.now();
        const res = await httpJson(
          `${API_BASE}/${API_VERSION}/models/${encodeURIComponent(model)}:generateContent`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": key },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              safetySettings: SAFETY_SETTINGS,
              generationConfig: {
                temperature: 0.1,
                ...(opts.json ? { responseMimeType: "application/json" } : {}),
              },
            }),
          }
        );
        const ms = Date.now() - t0;

        if (res.ok) {
          let text;
          try {
            text = extractText(res.body);
          } catch (blockErr) {
            attempts.push({ key: label, model, ms, error: blockErr.message, code: blockErr.code });
            break; // a safety block will repeat on this model — try the next one
          }
          if (text) {
            console.log(`✅ Gemini OK — ${label} | model=${model} | ${ms}ms | attempt ${attempt + 1}`);
            return { text, usedKeyIndex: ki, usedModel: model, attempts };
          }
          attempts.push({ key: label, model, ms, error: "رد فارغ من Google" });
          break;
        }

        const c = classify(res.status, res.body);
        lastClassified = c;
        attempts.push({ key: label, model, ms, code: c.code, http: c.httpStatus, error: c.arabic });
        console.warn(`⚠️ Gemini ${c.code} — ${label} | model=${model} | http=${c.httpStatus} | ${c.message}`);

        // A key problem affects every model: stop testing models for this key.
        if (["INVALID_KEY", "KEY_RESTRICTED", "PERMISSION", "BILLING", "UNSUPPORTED_REGION"].includes(c.code)) {
          attempt = MAX_ATTEMPTS;
          candidates = [];
          break;
        }
        // Quota is per key: move to the next key.
        if (c.code === "QUOTA") { candidates = []; break; }
        // Model problems: next model, no retry.
        if (c.code === "MODEL_NOT_FOUND" || c.code === "BAD_REQUEST") break;

        if (!c.retryable || attempt === MAX_ATTEMPTS - 1) break;
        await sleep(backoffDelay(attempt, c.retryDelayMs));
      }
      if (candidates.length === 0) break;
    }
  }

  const e = new Error(
    lastClassified
      ? `تعذّر تنفيذ الطلب: ${lastClassified.arabic}`
      : "تعذّر تنفيذ الطلب عبر جميع المفاتيح المتاحة."
  );
  e.code = lastClassified ? lastClassified.code : "ALL_FAILED";
  e.details = attempts;
  throw e;
}

// ---------------------------------------------------------------------------
// Diagnostics — lets the user see exactly what is wrong with each key.
// ---------------------------------------------------------------------------

async function diagnose() {
  const raw = (await getSettingValue("gemini_api_key")) || "";
  const envRaw = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
  const keys = await loadKeys();
  const configuredModel = (await getSettingValue("gemini_model")) || process.env.GEMINI_MODEL || null;

  const report = {
    keysConfigured: keys.length,
    savedInDatabase: Boolean(raw.trim()),
    savedInEnvironment: Boolean(envRaw.trim()),
    configuredModel,
    // Proves whether a paste carried invisible characters.
    hiddenCharactersRemoved: (String(raw).match(INVISIBLE_RE) || []).length,
    keys: [],
  };

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const entry = {
      index: i + 1,
      fingerprint: maskKey(key),
      length: key.length,
      formatValid: looksLikeKey(key),
    };

    if (!entry.formatValid) {
      entry.status = "خطأ";
      entry.verdict = "صيغة المفتاح غير صحيحة — يجب أن يبدأ بـ AIza ويكون كاملاً.";
      report.keys.push(entry);
      continue;
    }

    modelCache.delete(key); // always probe live when diagnosing
    const discovery = await listModels(key);

    if (discovery.models) {
      const ranked = rankModels(discovery.models, configuredModel);
      entry.status = "يعمل";
      entry.modelsAvailable = discovery.models.length;
      entry.selectedModel = ranked[0] || null;
      entry.configuredModelAvailable = configuredModel
        ? discovery.models.includes(configuredModel)
        : null;
      entry.verdict = configuredModel && !discovery.models.includes(configuredModel)
        ? `المفتاح سليم، لكن الموديل المحفوظ "${configuredModel}" غير متاح له — سيُستخدم "${ranked[0]}" تلقائياً.`
        : `المفتاح سليم وجاهز — سيُستخدم الموديل "${ranked[0]}".`;
    } else {
      entry.status = "خطأ";
      entry.code = discovery.error && discovery.error.code;
      entry.httpStatus = discovery.error && discovery.error.httpStatus;
      entry.verdict = discovery.error ? discovery.error.arabic : "سبب غير معروف";
      entry.googleMessage = discovery.error && discovery.error.message;
    }

    report.keys.push(entry);
  }

  const working = report.keys.filter((k) => k.status === "يعمل");
  report.healthy = working.length > 0;
  report.summary = report.keysConfigured === 0
    ? "لا يوجد أي مفتاح محفوظ. أضف مفتاحاً في صفحة الإعدادات."
    : report.healthy
      ? `${working.length} من ${report.keysConfigured} مفتاح يعمل بنجاح.`
      : "لا يوجد أي مفتاح يعمل — راجع تفاصيل كل مفتاح بالأسفل.";

  return report;
}

module.exports = {
  geminiGenerate,
  diagnose,
  parseKeys,
  sanitizeKey,
  looksLikeKey,
  maskKey,
  classify,
  rankModels,
};
