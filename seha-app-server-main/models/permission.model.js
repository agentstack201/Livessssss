const Sequelize = require("sequelize");
const sequelize = require("../config/database");

const Permission = sequelize.define(
  "permissions",
  {
    id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      allowNull: false,
      primaryKey: true,
    },
    user_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    // Sick Leave Permissions
    can_view_leaves: {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
    },
    can_create_leaves: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    },
    can_edit_leaves: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    },
    can_delete_leaves: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    },
    // User Management Permissions
    can_view_users: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    },
    can_create_users: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    },
    can_edit_users: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    },
    can_delete_users: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    },
    // Media Management Permissions
    can_manage_media: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    },
    // Country Management Permissions
    can_manage_countries: {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
    },
    // Settings Management Permissions
    can_manage_settings: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    },
    // Doctor & Hospital Management Permissions
    can_manage_doctors: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    },
    can_manage_hospitals: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    indexes: [{ unique: true, fields: ["user_id"] }],
  }
);

module.exports = Permission;
