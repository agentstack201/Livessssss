# LLM Key Pool

Treats many provider API keys as one logical LLM. The app calls `llmGenerate` /
`llmChat`; the pool picks the best eligible key, counts usage against per-window
limits, and fails over to the next key on error — the user never sees the churn.

## How a request flows

```
controller → utils/llm/index.js (llmGenerate)
           → pool.chat()
               reserveKey()  ── SELECT … FOR UPDATE, pick best, reserve a slot
               adapter.chat()  ── openai-compatible.js OR gemini.js
               recordSuccess / recordFailure  ── counters, cooldown, breaker
```

Keys are stored encrypted (`crypto.js`, AES-256-GCM) and managed at `/keys`
(admin only) via `controller/apiKeys.controller.js`.

## Selection order

1. Eligible only: `status` active (or a cooldown whose timer expired), not over
   any limit (rpm/rpd/tpm/tpd/monthly), and — if a model was requested — able to
   serve it.
2. `priority` descending → least-utilised (max fraction of any limit used) →
   higher `weight` → least-recently-used.

## Failover

- `429 / 5xx / timeout` → cooldown with exponential backoff (30s → 2m → 10m →
  30m), try the next key immediately.
- `401 / 403` → mark `invalid`, no retry.
- 3 consecutive failures → 15-minute circuit-breaker cooldown.
- Gemini origin errors (region / user-location) are non-retryable and surface
  as-is; other providers are unaffected.
- Nothing eligible → `503` with the earliest reset time.

## Adding a new provider

Most providers are OpenAI chat-completions compatible, so it's one entry — no
new code:

1. Add an entry to `providers/registry.js`:

   ```js
   together: {
     id: "together",
     label: "Together AI",
     adapter: "openai",                       // reuse the shared adapter
     baseUrl: "https://api.together.xyz/v1",
     defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
     models: ["meta-llama/Llama-3.3-70B-Instruct-Turbo-Free"],
     consoleUrl: "https://api.together.xyz/settings/api-keys",
     defaultLimits: { rpm: 60, rpd: 0, tpm: 0, tpd: 0, monthly_tokens: 0 },
   },
   ```

2. Add a key row in the `/keys` admin page (pick the provider, paste the key).

That's it. A provider with a non-OpenAI request shape needs its own file in
`providers/` exporting `chat({apiKey, model, messages, json})` and `test(...)`,
plus `adapter: "<name>"` wired into `ADAPTERS` in `pool.js` — see `gemini.js`.

## Configuration

- `ENCRYPTION_KEY` (32-byte hex) encrypts keys at rest; falls back to
  `JWT_SECRET` if unset.
- Legacy `gemini_api_key` settings are imported into the pool once on boot
  (`bootstrap.js`).
