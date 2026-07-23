require("dotenv").config();
const sequelize = require("../config/database");

// Register associations first
require("../config/models_associations.js");

const Doctor = require("../models/doctor.model");
const Hospital = require("../models/hospital.model");

async function migrateDoctorsHospitals() {
  try {
    console.log("🔄 بدء إنشاء جداول الأطباء والمستشفيات...");

    // Sync doctor model
    await Doctor.sync({ alter: true });
    console.log("✅ تم إنشاء/تعديل جدول doctors بنجاح");

    // Sync hospital model
    await Hospital.sync({ alter: true });
    console.log("✅ تم إنشاء/تعديل جدول hospitals بنجاح");

    // Add permissions to permissions table
    console.log("🔄 إضافة حقول الصلاحيات الجديدة...");
    await Promise.all([
      sequelize.query("ALTER TABLE permissions ADD COLUMN IF NOT EXISTS can_manage_doctors BOOLEAN DEFAULT false;"),
      sequelize.query("ALTER TABLE permissions ADD COLUMN IF NOT EXISTS can_manage_hospitals BOOLEAN DEFAULT false;"),
      sequelize.query("ALTER TABLE permissions ADD COLUMN IF NOT EXISTS can_manage_settings BOOLEAN DEFAULT false;")
    ]);
    console.log("✅ تم تحديث جدول الصلاحيات بنجاح");

    console.log("\n🎉 تم الانتهاء بنجاح!");
    process.exit(0);
  } catch (error) {
    console.error("❌ خطأ أثناء الميجريشن:", error);
    process.exit(1);
  }
}

migrateDoctorsHospitals();
