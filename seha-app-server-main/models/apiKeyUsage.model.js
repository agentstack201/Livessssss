const Sequelize = require("sequelize");
const sequelize = require("../config/database");

/**
 * One row per LLM call attempt (success or failure), for the admin dashboard's
 * average-latency and last-error columns and for auditing rotation behaviour.
 */
const ApiKeyUsage = sequelize.define(
  "api_key_usage",
  {
    id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
    key_id: { type: Sequelize.INTEGER, allowNull: false },
    provider: { type: Sequelize.STRING(50), allowNull: true },
    model: { type: Sequelize.STRING(80), allowNull: true },
    prompt_tokens: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 0 },
    completion_tokens: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 0 },
    latency_ms: { type: Sequelize.INTEGER, allowNull: true },
    status_code: { type: Sequelize.INTEGER, allowNull: true },
    error: { type: Sequelize.TEXT, allowNull: true },
  },
  {
    tableName: "api_key_usage",
    indexes: [{ fields: ["key_id"] }, { fields: ["createdAt"] }],
  }
);

module.exports = ApiKeyUsage;
