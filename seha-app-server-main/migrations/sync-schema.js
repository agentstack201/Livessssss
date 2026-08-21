// تشغيل يدوي لمزامنة المخطّط، لمن يملك وصول Shell:
//   node migrations/sync-schema.js
//
// نفس الشيفرة التي يشغّلها الخادم عند كل إقلاع (config/schemaSync.js)، فلا
// يمكن أن تفترق نسختان. الخادم يفعل هذا تلقائياً؛ هذا الملف للتشخيص فقط.
require("dotenv").config();
const sequelize = require("../config/database");
require("../config/models_associations.js");
const { syncSchema } = require("../config/schemaSync.js");

syncSchema(sequelize)
  .then(({ failures, missing }) => process.exit(failures.length || missing.length ? 1 : 0))
  .catch((error) => {
    console.error("❌ فشلت مزامنة المخطّط:", error.message);
    process.exit(1);
  });
