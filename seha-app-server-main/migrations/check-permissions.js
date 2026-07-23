require("dotenv").config();
const sequelize = require("../config/database");
const User = require("../models/user.model");
const Permission = require("../models/permission.model");

// Setup associations
User.hasOne(Permission, { foreignKey: 'user_id', as: 'permissions' });
Permission.belongsTo(User, { foreignKey: 'user_id' });

async function checkPermissions() {
  try {
    console.log("🔍 فحص الصلاحيات...\n");

    const users = await User.findAll({
      include: [{
        model: Permission,
        as: 'permissions'
      }]
    });

    console.log(`📊 عدد المستخدمين: ${users.length}\n`);

    users.forEach(user => {
      console.log(`👤 ${user.name} (${user.email})`);
      console.log(`   Role: ${user.role || 'user'}`);
      if (user.permissions) {
        console.log(`   الصلاحيات:`);
        console.log(`   - عرض الإجازات: ${user.permissions.can_view_leaves ? '✅' : '❌'}`);
        console.log(`   - إنشاء الإجازات: ${user.permissions.can_create_leaves ? '✅' : '❌'}`);
        console.log(`   - تعديل الإجازات: ${user.permissions.can_edit_leaves ? '✅' : '❌'}`);
        console.log(`   - حذف الإجازات: ${user.permissions.can_delete_leaves ? '✅' : '❌'}`);
        console.log(`   - عرض المستخدمين: ${user.permissions.can_view_users ? '✅' : '❌'}`);
        console.log(`   - إنشاء المستخدمين: ${user.permissions.can_create_users ? '✅' : '❌'}`);
        console.log(`   - تعديل المستخدمين: ${user.permissions.can_edit_users ? '✅' : '❌'}`);
        console.log(`   - حذف المستخدمين: ${user.permissions.can_delete_users ? '✅' : '❌'}`);
      } else {
        console.log(`   ⚠️ لا توجد صلاحيات`);
      }
      console.log('');
    });

    process.exit(0);
  } catch (error) {
    console.error("❌ خطأ:", error);
    process.exit(1);
  }
}

checkPermissions();
