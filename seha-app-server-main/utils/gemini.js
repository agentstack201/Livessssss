// Shared Google Gemini helper with multi-key + multi-model failover.
// Keys are read from the `gemini_api_key` setting (DB) and/or the
// GEMINI_API_KEY env var; multiple keys may be separated by newline/comma/;
// If a key is invalid or over quota, the next key is tried automatically.
const { getSettingValue } = require("../controller/settings.controller");

const parseKeys = (raw) =>
  (raw || "")
    .split(/[\n,;]+/)
    .map((k) => k.trim())
    .filter(Boolean);

async function geminiGenerate(prompt) {
  const { GoogleGenerativeAI } = require("@google/generative-ai");

  const dbKeys = parseKeys(await getSettingValue("gemini_api_key"));
  const envKeys = parseKeys(process.env.GEMINI_API_KEY);
  const apiKeys = [...new Set([...dbKeys, ...envKeys])];

  if (apiKeys.length === 0) {
    const e = new Error(
      "لا يوجد أي مفتاح ربط مع Google Gemini. أضف مفتاحاً واحداً على الأقل في الإعدادات."
    );
    e.code = "NO_KEYS";
    throw e;
  }

  const configuredModel =
    (await getSettingValue("gemini_model")) ||
    process.env.GEMINI_MODEL ||
    "gemini-flash-latest";
  const modelsToTry = [
    configuredModel,
    "gemini-flash-latest",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
  ].filter((m, i, a) => m && a.indexOf(m) === i);

  const attemptErrors = [];

  for (let ki = 0; ki < apiKeys.length; ki++) {
    const genAI = new GoogleGenerativeAI(apiKeys[ki]);
    for (let mi = 0; mi < modelsToTry.length; mi++) {
      const modelName = modelsToTry[mi];
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        return { text: result.response.text(), usedKey: ki, usedModel: modelName };
      } catch (err) {
        const msg = err && err.message ? err.message : String(err);
        attemptErrors.push(`مفتاح#${ki + 1} / ${modelName}: ${msg}`);
        const low = msg.toLowerCase();
        const invalidKey =
          low.includes("api key not valid") ||
          low.includes("api_key_invalid") ||
          low.includes("invalid api key") ||
          low.includes("permission denied") ||
          low.includes("403");
        const quota =
          low.includes("quota") ||
          low.includes("rate limit") ||
          low.includes("resource_exhausted") ||
          low.includes("429") ||
          low.includes("overloaded") ||
          low.includes("503");
        // Invalid key or quota → skip to the next key; otherwise try next model.
        if (invalidKey || quota) break;
      }
    }
  }

  const e = new Error(
    "فشلت جميع مفاتيح Gemini. تأكد من صحة المفاتيح ومن عدم تجاوز الحصة."
  );
  e.code = "ALL_FAILED";
  e.details = attemptErrors;
  throw e;
}

module.exports = { geminiGenerate, parseKeys };
