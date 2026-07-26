// AES-256-GCM encryption for stored provider API keys.
//
// Keys live in the database only as ciphertext. The master key comes from the
// ENCRYPTION_KEY env var; if it is missing we fall back to JWT_SECRET so the
// feature still works on an existing deployment, but a dedicated 32-byte key is
// strongly preferred (generate with: openssl rand -hex 32).
//
// Stored format: v1:<iv-b64>:<authTag-b64>:<ciphertext-b64>
const crypto = require("crypto");

const ALGO = "aes-256-gcm";
const VERSION = "v1";

function masterKey() {
  const raw = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || "";
  if (!raw) {
    throw new Error(
      "ENCRYPTION_KEY غير مضبوط. أضِف متغيّر بيئة ENCRYPTION_KEY (32 بايت) لتشفير المفاتيح."
    );
  }
  // Accept a 64-char hex key directly; otherwise derive 32 bytes deterministically.
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
  return crypto.createHash("sha256").update(raw, "utf8").digest();
}

function encrypt(plainText) {
  const iv = crypto.randomBytes(12); // 96-bit nonce, recommended for GCM
  const cipher = crypto.createCipheriv(ALGO, masterKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plainText), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

function decrypt(payload) {
  if (!payload || typeof payload !== "string") return "";
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("صيغة القيمة المشفّرة غير صحيحة");
  }
  const [, ivB64, tagB64, dataB64] = parts;
  const decipher = crypto.createDecipheriv(ALGO, masterKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}

// Last-4 fingerprint for the admin UI. Never returns more than the tail.
function last4(plainText) {
  const s = String(plainText || "");
  return s.length <= 4 ? "••••" : `••••${s.slice(-4)}`;
}

// Whether encryption is usable at all (used by diagnostics before we throw).
function isConfigured() {
  return Boolean(process.env.ENCRYPTION_KEY || process.env.JWT_SECRET);
}

module.exports = { encrypt, decrypt, last4, isConfigured };
