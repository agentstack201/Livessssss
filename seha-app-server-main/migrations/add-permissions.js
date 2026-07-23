require("dotenv").config();
const sequelize = require("../config/database");
const User = require("../models/user.model");
const Permission = require("../models/permission.model");

async function addPermissionsTable() {
  try {
    console.log("🔄 بدء إضافة جدول الصلاحيات...");

    // 1. Add role column to users table if not exists
    await sequelize.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user'
    `);
    console.log("✅ تم إضافة عمود role للمستخدمين");

    // 2. Create permissions table
    await Permission.sync({ force: false });
    console.log("✅ تم إنشاء جدول الصلاحيات");

    // 3. Get all existing users
    const users = await User.findAll();
    console.log(`📊 عدد المستخدمين الحاليين: ${users.length}`);

    // 4. Create full permissions for all existing users
    for (const user of users) {
      const existingPermission = await Permission.findOne({
        where: { user_id: user.id }
      });

      if (!existingPermission) {
        await Permission.create({
          user_id: user.id,
          can_view_leaves: true,
          can_create_leaves: true,
          can_edit_leaves: true,
          can_delete_leaves: true,
          can_view_users: true,
          can_create_users: true,
          can_edit_users: true,
          can_delete_users: true
        });
        console.log(`✅ تم إضافة صلاحيات كاملة للمستخدم: ${user.name} (${user.email})`);
      } else {
        // Update existing permissions to full access
        await existingPermission.update({
          can_view_leaves: true,
          can_create_leaves: true,
          can_edit_leaves: true,
          can_delete_leaves: true,
          can_view_users: true,
          can_create_users: true,
          can_edit_users: true,
          can_delete_users: true
        });
        console.log(`✅ تم تحديث صلاحيات المستخدم: ${user.name} (${user.email})`);
      }
    }

    console.log("\n🎉 تم إضافة جدول الصلاحيات بنجاح!");
    console.log("✅ جميع المستخدمين الحاليين لديهم كامل الصلاحيات");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ خطأ:", error);
    process.exit(1);
  }
}

// Run migration
addPermissionsTable();
