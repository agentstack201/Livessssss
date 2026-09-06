// Provider catalogue. Adding a provider = one entry here (plus a row in api_keys).
//
// Most providers speak the OpenAI chat-completions shape, so they share a single
// adapter and differ only by baseUrl + model list. Gemini uses its own REST
// shape and its own adapter.
//
// `consoleUrl` is the page where a user creates a fresh key — surfaced in the
// admin UI so that when a key is exhausted a replacement is one click away.
// `defaultLimits` reflect each provider's free tier (0 = no limit / unknown);
// they are only defaults — every key can override them.

const PROVIDERS = {
  gemini: {
    id: "gemini",
    label: "Google Gemini",
    adapter: "gemini",
    // baseUrl handled inside the Gemini adapter (REST, not OpenAI-compatible).
    defaultModel: "gemini-2.5-flash",
    models: ["gemini-2.5-flash", "gemini-flash-latest", "gemini-2.0-flash", "gemini-2.5-pro"],
    consoleUrl: "https://aistudio.google.com/app/apikey",
    // Free tier for gemini-2.5-flash (per key/project).
    defaultLimits: { rpm: 10, rpd: 250, tpm: 250000, tpd: 0, monthly_tokens: 0 },
  },
  groq: {
    id: "groq",
    label: "Groq",
    adapter: "openai",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "openai/gpt-oss-120b", "moonshotai/kimi-k2-instruct"],
    consoleUrl: "https://console.groq.com/keys",
    defaultLimits: { rpm: 30, rpd: 1000, tpm: 12000, tpd: 100000, monthly_tokens: 0 },
  },
  cerebras: {
    id: "cerebras",
    label: "Cerebras",
    adapter: "openai",
    baseUrl: "https://api.cerebras.ai/v1",
    defaultModel: "llama-3.3-70b",
    models: ["llama-3.3-70b", "llama3.1-8b", "qwen-3-235b-a22b-instruct-2507"],
    consoleUrl: "https://cloud.cerebras.ai/platform/apikeys",
    defaultLimits: { rpm: 30, rpd: 14400, tpm: 60000, tpd: 1000000, monthly_tokens: 0 },
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    adapter: "openai",
    baseUrl: "https://openrouter.ai/api/v1",
    // Paid slug first (uses account credits). Free variants kept as fallbacks.
    defaultModel: "google/gemini-flash-1.5-8b",
    models: [
      "google/gemini-flash-1.5-8b",
      "google/gemini-2.0-flash-exp:free",
      "deepseek/deepseek-chat-v3.1:free",
      "qwen/qwen3-235b-a22b:free",
    ],
    consoleUrl: "https://openrouter.ai/keys",
    defaultLimits: { rpm: 20, rpd: 50, tpm: 0, tpd: 0, monthly_tokens: 0 },
  },
  mistral: {
    id: "mistral",
    label: "Mistral",
    adapter: "openai",
    baseUrl: "https://api.mistral.ai/v1",
    defaultModel: "mistral-small-latest",
    models: ["mistral-small-latest", "open-mistral-nemo", "mistral-large-latest"],
    consoleUrl: "https://console.mistral.ai/api-keys",
    defaultLimits: { rpm: 60, rpd: 0, tpm: 0, tpd: 0, monthly_tokens: 1000000000 },
  },
  sambanova: {
    id: "sambanova",
    label: "SambaNova",
    adapter: "openai",
    baseUrl: "https://api.sambanova.ai/v1",
    defaultModel: "Meta-Llama-3.3-70B-Instruct",
    models: [
      "Meta-Llama-3.3-70B-Instruct",
      "Meta-Llama-3.1-8B-Instruct",
      "Qwen2.5-72B-Instruct",
      "DeepSeek-R1",
    ],
    consoleUrl: "https://cloud.sambanova.ai/apis",
    defaultLimits: { rpm: 30, rpd: 0, tpm: 0, tpd: 0, monthly_tokens: 0 },
  },
  nvidia: {
    id: "nvidia",
    label: "NVIDIA NIM",
    adapter: "openai",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    defaultModel: "meta/llama-3.3-70b-instruct",
    models: [
      "meta/llama-3.3-70b-instruct",
      "meta/llama-3.1-8b-instruct",
      "deepseek-ai/deepseek-r1",
      "qwen/qwen2.5-72b-instruct",
    ],
    consoleUrl: "https://build.nvidia.com",
    defaultLimits: { rpm: 40, rpd: 0, tpm: 0, tpd: 0, monthly_tokens: 0 },
  },
  github: {
    id: "github",
    label: "GitHub Models",
    adapter: "openai",
    baseUrl: "https://models.github.ai/inference",
    defaultModel: "openai/gpt-4o-mini",
    models: [
      "openai/gpt-4o-mini",
      "meta/Llama-3.3-70B-Instruct",
      "mistral-ai/Mistral-Small-2503",
      "deepseek/DeepSeek-V3-0324",
    ],
    consoleUrl: "https://github.com/marketplace/models",
    defaultLimits: { rpm: 15, rpd: 150, tpm: 0, tpd: 0, monthly_tokens: 0 },
  },
  together: {
    id: "together",
    label: "Together AI",
    adapter: "openai",
    baseUrl: "https://api.together.xyz/v1",
    defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
    models: [
      "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
      "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
      "deepseek-ai/DeepSeek-R1-Distill-Llama-70B-free",
    ],
    consoleUrl: "https://api.together.ai/settings/api-keys",
    defaultLimits: { rpm: 60, rpd: 0, tpm: 0, tpd: 0, monthly_tokens: 0 },
  },
};

function getProvider(id) {
  return PROVIDERS[String(id || "").toLowerCase()] || null;
}

function listProviders() {
  return Object.values(PROVIDERS).map((p) => ({
    id: p.id,
    label: p.label,
    defaultModel: p.defaultModel,
    models: p.models,
    consoleUrl: p.consoleUrl,
    defaultLimits: p.defaultLimits,
  }));
}

// The model list a key can serve: its own override, else the provider's list.
function modelsForKey(keyRow) {
  const provider = getProvider(keyRow.provider);
  const own = Array.isArray(keyRow.models) ? keyRow.models.filter(Boolean) : [];
  if (own.length) return own;
  return provider ? provider.models : [];
}

module.exports = { PROVIDERS, getProvider, listProviders, modelsForKey };
