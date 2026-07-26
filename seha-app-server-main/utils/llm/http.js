// Small fetch wrapper with a hard per-attempt timeout. Adapters use it so a
// hung provider can never stall a user's request past the pool's deadline.
async function httpJson(url, options = {}, timeoutMs = 45000) {
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
      body: { error: { message: aborted ? "انتهت مهلة الاتصال بالمزوّد" : `تعذّر الاتصال بالمزوّد: ${e.message}` } },
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Uniform adapter error. The pool reads `retryable` to decide failover vs abort,
 * and `httpStatus` to classify (429/5xx = retry, 401/403 = invalid key).
 */
class AdapterError extends Error {
  constructor({ message, httpStatus, retryable, code, providerMessage, providerStatus }) {
    super(message || providerMessage || "Provider error");
    this.name = "AdapterError";
    this.httpStatus = httpStatus || 0;
    this.retryable = Boolean(retryable);
    this.code = code || "PROVIDER_ERROR";
    this.providerMessage = providerMessage || null;
    this.providerStatus = providerStatus || null;
  }
}

// Shared retryability rule for HTTP-level failures across all adapters.
function isRetryableStatus(status) {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504 || status === 0;
}

module.exports = { httpJson, AdapterError, isRetryableStatus };
