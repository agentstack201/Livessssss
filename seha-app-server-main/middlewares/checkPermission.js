const User = require('../models/user.model');
const Permission = require('../models/permission.model');

// Check if user has specific permission
const checkPermission = (permissionName) => {
  return async (req, res, next) => {
    try {
      const userId = req.id; // من authMW

      if (!userId) {
        return res.status(401).json({
          status_code: 401,
          success: false,
          message: 'غير مصرح لك بالوصول'
        });
      }

      // Get user with permissions
      const user = await User.findByPk(userId, {
        include: [{
          model: Permission,
          as: 'permissions'
        }]
      });

      if (!user) {
        return res.status(404).json({
          status_code: 404,
          success: false,
          message: 'المستخدم غير موجود'
        });
      }

      // Check if user has the required permission
      if (!user.permissions || !user.permissions[permissionName]) {
        return res.status(403).json({
          status_code: 403,
          success: false,
          message: 'ليس لديك صلاحية للقيام بهذا الإجراء'
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        status_code: 500,
        success: false,
        message: error.message
      });
    }
  };
};

module.exports = { checkPermission };
