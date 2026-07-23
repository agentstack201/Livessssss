require("dotenv").config();
const sequelize = require("../config/database");
const Setting = require("../models/settings.model");

async function createSettingsTable() {
    try {
        console.log("🔄 بدء إنشاء جدول الإعدادات...");

        await Setting.sync({ force: true });
        console.log("✅ تم إنشاء جدول Settings بنجاح");

        // إضافة إعداد افتراضي للـ Gemini Key (فارغ)
        await Setting.create({
            key: 'gemini_api_key',
            value: '',
            description: 'Google Gemini API Key for AI Extraction'
        });
        console.log("✅ تم إضافة سجل الإعداد الافتراضي");

        console.log("\n🎉 تم الانتهاء بنجاح!");
        process.exit(0);
    } catch (error) {
        console.error("❌ خطأ:", error);
        process.exit(1);
    }
}

createSettingsTable();
