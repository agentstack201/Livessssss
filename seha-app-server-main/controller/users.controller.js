const User = require('../models/user.model');
const Permission = require('../models/permission.model');
const bcrypt = require('bcrypt');

// Get all users
module.exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'name', 'email', 'role', 'createdAt', 'updatedAt'],
      include: [{
        model: Permission,
        as: 'permissions'
      }],
      order: [['id', 'ASC']]
    });

    console.log(`📊 جلب ${users.length} مستخدمين من قاعدة البيانات`);

    return res.status(200).json({
      status_code: 200,
      success: true,
      data: users,
      message: 'تم جلب المستخدمين بنجاح'
    });
  } catch (error) {
    console.error('❌ خطأ في جلب المستخدمين:', error);
    return res.status(500).json({
      status_code: 500,
      success: false,
      data: null,
      message: error.message
    });
  }
};

// Create new user
module.exports.createUser = async (req, res) => {
  try {
    const { name, email, password, role, permissions } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({
        status_code: 400,
        success: false,
        message: 'البريد الإلكتروني مستخدم بالفعل'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: role || 'user'
    });

    // Create default permissions based on role
    let defaultPermissions = {
      user_id: user.id,
      can_view_leaves: true,
      can_create_leaves: false,
      can_edit_leaves: false,
      can_delete_leaves: false,
      can_view_users: false,
      can_create_users: false,
      can_edit_users: false,
      can_delete_users: false,
      can_manage_media: false,
      can_manage_countries: false,
      can_manage_settings: false,
      can_manage_doctors: false,
      can_manage_hospitals: false
    };

    // If admin, grant all permissions
    if (role === 'admin') {
      defaultPermissions = {
        user_id: user.id,
        can_view_leaves: true,
        can_create_leaves: true,
        can_edit_leaves: true,
        can_delete_leaves: true,
        can_view_users: true,
        can_create_users: true,
        can_edit_users: true,
        can_delete_users: true,
        can_manage_media: true,
        can_manage_countries: true,
        can_manage_settings: true,
        can_manage_doctors: true,
        can_manage_hospitals: true
      };
    }

    // Override with custom permissions if provided
    if (permissions) {
      defaultPermissions = { ...defaultPermissions, ...permissions };
    }

    await Permission.create(defaultPermissions);

    // وحدة النمو: إنشاء الملف التجاري ومنح الرصيد الترحيبي وإسناد الإحالة إن
    // حمل الطلب رمزاً. تفشل بصمت — إنشاء المستخدم لا يجوز أن يتوقّف على النمو.
    try {
      await require('../growth/hooks').onUserRegistered({
        userId: user.id,
        referralCode: req.body?.referral_code || null,
        req,
      });
    } catch (hookError) {
      console.warn('[growth] تعذّر تهيئة الملف التجاري:', hookError.message);
    }

    // Fetch user with permissions
    const userWithPermissions = await User.findByPk(user.id, {
      include: [{
        model: Permission,
        as: 'permissions'
      }]
    });

    return res.status(201).json({
      status_code: 201,
      success: true,
      data: userWithPermissions,
      message: 'تم إنشاء المستخدم بنجاح'
    });
  } catch (error) {
    return res.status(500).json({
      status_code: 500,
      success: false,
      message: error.message
    });
  }
};

// Update user
module.exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password, role, permissions } = req.body;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        status_code: 404,
        success: false,
        message: 'المستخدم غير موجود'
      });
    }

    // Prevent updating simo@seha.sa
    if (user.email === 'simo@seha.sa') {
      return res.status(403).json({
        status_code: 403,
        success: false,
        message: 'لا يمكن تعديل هذا المستخدم'
      });
    }

    // Update fields
    const updateData = { name, email, role };

    // Only update password if provided
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    await user.update(updateData);

    // Update permissions if provided
    if (permissions) {
      const userPermission = await Permission.findOne({ where: { user_id: id } });
      if (userPermission) {
        await userPermission.update(permissions);
      } else {
        await Permission.create({ user_id: id, ...permissions });
      }
    }

    // Fetch updated user with permissions
    const updatedUser = await User.findByPk(id, {
      include: [{
        model: Permission,
        as: 'permissions'
      }]
    });

    return res.status(200).json({
      status_code: 200,
      success: true,
      data: updatedUser,
      message: 'تم تحديث المستخدم بنجاح'
    });
  } catch (error) {
    return res.status(500).json({
      status_code: 500,
      success: false,
      message: error.message
    });
  }
};

// Update user permissions only
module.exports.updateUserPermissions = async (req, res) => {
  try {
    const { id } = req.params;
    const permissions = req.body;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        status_code: 404,
        success: false,
        message: 'المستخدم غير موجود'
      });
    }

    // Prevent updating simo@seha.sa permissions
    if (user.email === 'simo@seha.sa') {
      return res.status(403).json({
        status_code: 403,
        success: false,
        message: 'لا يمكن تعديل صلاحيات هذا المستخدم'
      });
    }

    const userPermission = await Permission.findOne({ where: { user_id: id } });
    if (userPermission) {
      await userPermission.update(permissions);
    } else {
      await Permission.create({ user_id: id, ...permissions });
    }

    // Fetch updated user with permissions
    const updatedUser = await User.findByPk(id, {
      include: [{
        model: Permission,
        as: 'permissions'
      }]
    });

    return res.status(200).json({
      status_code: 200,
      success: true,
      data: updatedUser,
      message: 'تم تحديث الصلاحيات بنجاح'
    });
  } catch (error) {
    return res.status(500).json({
      status_code: 500,
      success: false,
      message: error.message
    });
  }
};

// Delete user
module.exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        status_code: 404,
        success: false,
        message: 'المستخدم غير موجود'
      });
    }

    // Prevent deleting simo@seha.sa
    if (user.email === 'simo@seha.sa') {
      return res.status(403).json({
        status_code: 403,
        success: false,
        message: 'لا يمكن حذف هذا المستخدم'
      });
    }

    await user.destroy();

    return res.status(200).json({
      status_code: 200,
      success: true,
      message: 'تم حذف المستخدم بنجاح'
    });
  } catch (error) {
    return res.status(500).json({
      status_code: 500,
      success: false,
      message: error.message
    });
  }
};
