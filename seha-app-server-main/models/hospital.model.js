const Sequelize = require("sequelize");
const sequelize = require("../config/database");

const Hospital = sequelize.define("hospitals", {
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
  license_number: {
    type: Sequelize.STRING(50),
    allowNull: true,
  },
  logo: {
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

module.exports = Hospital;
