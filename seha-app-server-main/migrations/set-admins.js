require("dotenv").config();
const sequelize = require("../config/database");
const User = require("../models/user.model");

async function setAdmins() {
  try {
    console.log("🔄 تحديث المستخدمين إلى admin...\n");

    const users = await User.findAll();

    for (const user of users) {
      await user.update({ role: 'admin' });
      console.log(`✅ تم تحديث ${user.name} (${user.email}) إلى admin`);
    }

    console.log("\n🎉 تم تحديث جميع المستخدمين إلى admin بنجاح!");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ خطأ:", error);
    process.exit(1);
  }
}

setAdmins();
