const Sequelize = require('sequelize');
const sequelize = require('../../config/database');

// ───────────────────────────────────────────────────────────────────────────
// الدور — مجموعة صلاحيات قابلة للتركيب من اللوحة.
//
// permissions مصفوفة من مفاتيح config/permissions.js حصراً. يُتحقّق منها عند
// كل حفظ: صلاحية يخترعها الأدمن لا يفحصها أي مسار، فتبدو مفعّلة وهي بلا أثر.
// المفردات ثابتة في الكود؛ التركيب حرّ من اللوحة.
//
// is_system يمنع حذف الأدوار المؤسِّسة (خصوصاً «مدير النمو») حتى لا يقفل
// المشغّل نفسه خارج النظام بحذف آخر دور يملك roles:write.
// ───────────────────────────────────────────────────────────────────────────

const GrowthRole = sequelize.define(
  'growth_roles',
  {
    id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },

    name: { type: Sequelize.STRING(120), allowNull: false },
    slug: { type: Sequelize.STRING(60), allowNull: false, unique: true },
    description: { type: Sequelize.TEXT, allowNull: true },

    permissions: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },

    is_system: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },

    created_by: { type: Sequelize.INTEGER, allowNull: true },
  },
  {
    indexes: [{ unique: true, fields: ['slug'] }],
  }
);

module.exports = GrowthRole;
