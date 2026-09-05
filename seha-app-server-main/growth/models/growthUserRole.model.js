const Sequelize = require('sequelize');
const sequelize = require('../../config/database');

// إسناد دور لمستخدم. مستخدم واحد قد يحمل أكثر من دور، وصلاحياته اتّحاد
// صلاحيات أدواره. القيد الفريد يمنع الإسناد المكرر.

const GrowthUserRole = sequelize.define(
  'growth_user_roles',
  {
    id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },

    user_id: { type: Sequelize.INTEGER, allowNull: false },
    role_id: { type: Sequelize.INTEGER, allowNull: false },

    assigned_by: { type: Sequelize.INTEGER, allowNull: true },
  },
  {
    updatedAt: false,
    indexes: [
      { unique: true, fields: ['user_id', 'role_id'] },
      { fields: ['user_id'] },
    ],
  }
);

module.exports = GrowthUserRole;
