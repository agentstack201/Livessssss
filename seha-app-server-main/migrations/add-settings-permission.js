require("dotenv").config();
const sequelize = require("../config/database");
const Permission = require("../models/permission.model");

async function addSettingsPermission() {
    try {
        console.log("🔄 بدء إضافة صلاحية إعدادات النظام...");

        // 1. Add column via raw SQL
        await sequelize.query(`
      ALTER TABLE permissions 
      ADD COLUMN IF NOT EXISTS can_manage_settings BOOLEAN DEFAULT false
    `);
        console.log("✅ تم إضافة عمود can_manage_settings");

        // 2. Grant permission to all existing users/permissions for ease of use in dev
        await sequelize.query(`
      UPDATE permissions 
      SET can_manage_settings = true
    `);
        console.log("✅ تم تفعيل الصلاحية لجميع المستخدمين الحاليين");

        console.log("\n🎉 تم الانتهاء بنجاح!");
        process.exit(0);
    } catch (error) {
        console.error("❌ خطأ:", error);
        process.exit(1);
    }
}

addSettingsPermission();
