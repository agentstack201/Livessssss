const Sequelize = require('sequelize');
const sequelize = require('../../config/database');

// ───────────────────────────────────────────────────────────────────────────
// سجل التدقيق — إلحاقي فقط. لا UPDATE ولا DELETE، ولا حتى لمالك النظام.
//
// يُكتب داخل نفس معاملة العملية التي يوثّقها. لو كُتب خارجها لأمكن أن تنجح
// عملية حسّاسة ويفشل توثيقها، فتقع تغييرات غير مرئية — وهذا أسوأ من عدم
// وجود سجل أصلاً لأنه يمنح ثقة كاذبة.
//
// before/after يحملان اللقطتين قبل التغيير وبعده للحقول المتغيّرة فقط، لا
// الصفّ كاملاً: أصغر حجماً وأوضح في القراءة.
// ───────────────────────────────────────────────────────────────────────────

const GrowthAuditLog = sequelize.define(
  'growth_audit_logs',
  {
    id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },

    actor_id: { type: Sequelize.INTEGER, allowNull: true },
    actor_name: { type: Sequelize.STRING(191), allowNull: true },
    actor_role: { type: Sequelize.STRING(60), allowNull: true },

    /** فعل بصيغة resource.action مثل product.update أو credit.adjust */
    action: { type: Sequelize.STRING(100), allowNull: false },

    resource_type: { type: Sequelize.STRING(60), allowNull: false },
    resource_id: { type: Sequelize.STRING(100), allowNull: true },

    before: { type: Sequelize.JSONB, allowNull: true },
    after: { type: Sequelize.JSONB, allowNull: true },

    /** إلزامي في العمليات المالية الحسّاسة — تفرضه الخدمة. */
    reason: { type: Sequelize.TEXT, allowNull: true },

    ip_address: { type: Sequelize.STRING(45), allowNull: true },
    user_agent: { type: Sequelize.TEXT, allowNull: true },

    severity: {
      type: Sequelize.ENUM('info', 'notice', 'critical'),
      allowNull: false,
      defaultValue: 'info',
    },
  },
  {
    updatedAt: false,
    indexes: [
      { fields: ['actor_id', 'createdAt'] },
      { fields: ['resource_type', 'resource_id'] },
      { fields: ['action', 'createdAt'] },
      { fields: ['severity', 'createdAt'] },
      { fields: ['createdAt'] },
    ],
  }
);

module.exports = GrowthAuditLog;
