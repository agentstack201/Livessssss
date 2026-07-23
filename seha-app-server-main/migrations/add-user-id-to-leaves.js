require("dotenv").config();
const sequelize = require("../config/database");

async function addUserIdToLeaves() {
  try {
    console.log("🔄 بدء إضافة حقل user_id إلى جدول leaves...");

    // إضافة حقل user_id لربط الإجازات بالمستخدمين
    await sequelize.query(`
      ALTER TABLE leaves 
      ADD COLUMN IF NOT EXISTS user_id INTEGER;
    `);
    
    // إضافة مفتاح أجنبي (اختياري ولكن يفضل للأمان التقني)
    try {
      await sequelize.query(`
        ALTER TABLE leaves 
        ADD CONSTRAINT fk_leaves_user 
        FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE SET NULL;
      `);
      console.log("✅ تم إضافة المفتاح الأجنبي (Foreign Key) بنجاح");
    } catch (e) {
      console.log("⚠️ تم إضافة الحقل ولكن تعذر إضافة القيد (قد يكون موجوداً مسبقاً):", e.message);
    }

    console.log("✅ تم إضافة حقل user_id بنجاح");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ خطأ أثناء الميجريشن:", error);
    process.exit(1);
  }
}

// Run migration
addUserIdToLeaves();
