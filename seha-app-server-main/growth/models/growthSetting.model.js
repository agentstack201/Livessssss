const Sequelize = require('sequelize');
const sequelize = require('../../config/database');

// ───────────────────────────────────────────────────────────────────────────
// الإعدادات التشغيلية — القيم في قاعدة البيانات، والمفاتيح مُعلنة في الكود.
//
// القيمة تُخزَّن نصاً دائماً ويحوّلها settingsRegistry إلى نوعها المُعلن عند
// القراءة. السبب: عمود واحد يخدم كل الأنواع، والتحقّق يبقى في مكان واحد
// بدل تشتّته بين المخطّط والكود.
//
// لا يُقبل مفتاح غير موجود في السجل — لا عبر الـ API ولا عبر بذرة. مفتاح
// بلا سطر في السجل هو مفتاح لا يقرأه أي كود، أي «إعداد وهمي» يخدع المشغّل.
// ───────────────────────────────────────────────────────────────────────────

const GrowthSetting = sequelize.define(
  'growth_settings',
  {
    id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },

    key: { type: Sequelize.STRING(120), allowNull: false, unique: true },
    value: { type: Sequelize.TEXT, allowNull: true },

    updated_by: { type: Sequelize.INTEGER, allowNull: true },
  },
  {
    indexes: [{ unique: true, fields: ['key'] }],
  }
);

module.exports = GrowthSetting;
