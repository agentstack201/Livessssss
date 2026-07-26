const Sequelize = require("sequelize");
const sequelize = require("../config/database");

/**
 * A single provider API key in the rotation pool.
 *
 * The pool treats all keys as one logical LLM: it picks the best eligible key,
 * counts usage against per-window limits, and moves to the next key on failure.
 * The secret itself is stored only as AES-256-GCM ciphertext in key_encrypted.
 */
const ApiKey = sequelize.define(
  "api_keys",
  {
    id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },

    // e.g. "gemini", "groq", "openrouter", "cerebras", "mistral"
    provider: { type: Sequelize.STRING(50), allowNull: false },
    // Human label shown in the admin table.
    label: { type: Sequelize.STRING(120), allowNull: true },
    // AES-256-GCM ciphertext of the raw key. Never returned to the client.
    key_encrypted: { type: Sequelize.TEXT, allowNull: false },
    // Optional per-key base URL override (defaults come from the provider registry).
    base_url: { type: Sequelize.STRING(255), allowNull: true },
    // Models this key may serve. Empty = inherit the provider's model list.
    models: { type: Sequelize.JSON, allowNull: true, defaultValue: [] },

    // Selection controls.
    priority: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 100 },
    weight: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },

    // active | paused | cooldown | exhausted | invalid
    status: { type: Sequelize.STRING(16), allowNull: false, defaultValue: "active" },

    // Limits (0 = unlimited).
    rpm: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    rpd: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    tpm: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    tpd: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    monthly_tokens: { type: Sequelize.BIGINT, allowNull: false, defaultValue: 0 },

    // Rolling counters (reset on their window boundaries).
    used_rpm: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    used_rpd: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    used_tpm: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    used_tpd: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    used_month: { type: Sequelize.BIGINT, allowNull: false, defaultValue: 0 },

    // Window boundaries. minute/day/month resets are derived from these.
    minute_reset_at: { type: Sequelize.DATE, allowNull: true },
    day_reset_at: { type: Sequelize.DATE, allowNull: true },
    month_reset_at: { type: Sequelize.DATE, allowNull: true },

    // Failover state.
    cooldown_until: { type: Sequelize.DATE, allowNull: true },
    consecutive_failures: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },

    // Observability.
    last_used_at: { type: Sequelize.DATE, allowNull: true },
    last_latency_ms: { type: Sequelize.INTEGER, allowNull: true },
    last_error: { type: Sequelize.TEXT, allowNull: true },
  },
  {
    tableName: "api_keys",
    indexes: [
      { fields: ["provider"] },
      { fields: ["status"] },
      { fields: ["priority"] },
    ],
  }
);

module.exports = ApiKey;
