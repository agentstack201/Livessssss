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

// Fixed application salt for passphrase stretching. A per-record salt would be
// stronger but would have to be stored alongside each ciphertext; a fixed salt
// still forces an attacker to pay scrypt's cost per guess, which is the point.
const KDF_SALT = Buffer.from("seha-llm-keypool-v1", "utf8");

let _cachedKey = null;
let _cachedFrom = null;

function masterKey() {
  const raw = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || "";
  if (!raw) {
    throw new Error(
      "ENCRYPTION_KEY غير مضبوط. أضِف متغيّر بيئة ENCRYPTION_KEY (32 بايت) لتشفير المفاتيح."
    );
  }
  if (_cachedKey && _cachedFrom === raw) return _cachedKey; // scrypt is expensive

  if (!process.env.ENCRYPTION_KEY) {
    console.warn(
      "⚠️ ENCRYPTION_KEY غير مضبوط — يُستخدم JWT_SECRET مؤقتاً لتشفير مفاتيح المزوّدين. " +
      "يُفضّل مفتاح مستقل: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }

  // A 64-char hex value is used directly as a 256-bit key. Anything else is a
  // passphrase and is stretched with scrypt (far harder to brute-force offline
  // than a single unsalted hash).
  _cachedKey = /^[0-9a-fA-F]{64}$/.test(raw)
    ? Buffer.from(raw, "hex")
    : crypto.scryptSync(raw, KDF_SALT, 32);
  _cachedFrom = raw;
  return _cachedKey;
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
