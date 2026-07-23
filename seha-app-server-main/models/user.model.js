const Sequelize = require("sequelize");
const sequelize = require("../config/database");

const User = sequelize.define(
  "users",
  {
    id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      allowNull: false,
      primaryKey: true,
    },
    name: {
      type: Sequelize.STRING(191),
      allowNull: false,
    },
    email: {
      type: Sequelize.STRING(191),
      allowNull: false,
      unique: true,
    },
    password: {
      type: Sequelize.STRING(191),
      allowNull: false,
    },
    role: {
      type: Sequelize.STRING(50),
      allowNull: false,
      defaultValue: 'user',
    },
  },

  {
    indexes: [{ unique: true, fields: ["email"] }],
  }
);

module.exports = User;
