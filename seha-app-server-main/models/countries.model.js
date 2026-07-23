const Sequelize = require("sequelize");
const sequelize = require("../config/database");

const Country = sequelize.define("countries", {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true,
  },
  country_name_en: {
    type: Sequelize.STRING(191),
    allowNull: false,
  },
  country_name_ar: {
    type: Sequelize.STRING(191),
    allowNull: false,
    unique: true,
  },
  created_by: {
    type: Sequelize.STRING(191),
    allowNull: true,
    defaultValue: 'system',
    comment: 'اسم المستخدم الذي أضاف الدولة',
  },
  user_id: {
    type: Sequelize.INTEGER,
    allowNull: true,
    comment: 'رقم المستخدم الذي أضاف الدولة',
  },
});

module.exports = Country;
