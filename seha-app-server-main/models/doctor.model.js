const Sequelize = require("sequelize");
const sequelize = require("../config/database");

const Doctor = sequelize.define("doctors", {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true,
  },
  name_en: {
    type: Sequelize.STRING(191),
    allowNull: false,
  },
  name_ar: {
    type: Sequelize.STRING(191),
    allowNull: false,
    unique: true,
  },
  position_en: {
    type: Sequelize.STRING(191),
    allowNull: true,
  },
  position_ar: {
    type: Sequelize.STRING(191),
    allowNull: true,
  },

  created_by: {
    type: Sequelize.STRING(191),
    allowNull: true,
    defaultValue: 'system',
  },
  user_id: {
    type: Sequelize.INTEGER,
    allowNull: true,
  },
});

module.exports = Doctor;
