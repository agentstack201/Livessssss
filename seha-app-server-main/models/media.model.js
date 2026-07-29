const Sequelize = require("sequelize");
const sequelize = require("../config/database");

const Media = sequelize.define(
  "media",
  {
    id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      allowNull: false,
      primaryKey: true,
    },
    filename: {
      type: Sequelize.STRING(255),
      allowNull: false,
      comment: 'اسم الملف المخزن على السيرفر',
    },
    original_name: {
      type: Sequelize.STRING(255),
      allowNull: false,
      comment: 'اسم الملف الأصلي',
    },
    mime_type: {
      type: Sequelize.STRING(100),
      allowNull: false,
      comment: 'نوع الملف (image/jpeg, image/png, etc.)',
    },
    size: {
      type: Sequelize.INTEGER,
      allowNull: false,
      comment: 'حجم الملف بالبايت',
    },
    path: {
      type: Sequelize.STRING(500),
      allowNull: false,
      comment: 'مسار الملف على السيرفر',
    },
    url: {
      // TEXT وليس STRING(500) حتى يتّسع لرابط data:base64 عند تعذّر Supabase.
      type: Sequelize.TEXT,
      allowNull: false,
      comment: 'رابط الوصول للملف (أو data URI عند الرفع المحلي)',
    },
    alt_text: {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'نص بديل للصورة',
    },
    category: {
      type: Sequelize.STRING(100),
      allowNull: true,
      defaultValue: 'general',
      comment: 'تصنيف الوسائط (logos, headers, general)',
    },
    uploaded_by: {
      type: Sequelize.STRING(100),
      allowNull: true,
      comment: 'اسم المستخدم الذي رفع الملف',
    },
  },
  {
    timestamps: true,
    indexes: [
      { fields: ["category"] },
      { fields: ["mime_type"] },
    ],
  }
);

module.exports = Media;
