const Permission = require("../models/permission.model");

module.exports = (permissionName) => {
  return async (req, res, next) => {
    try {
      // Admins bypass all permission checks
      if (req.user && req.user.role === 'admin') {
        return next();
      }

      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          message: "غير مصرح - الرجاء تسجيل الدخول أولاً"
        });
      }

      const permissions = await Permission.findOne({ where: { user_id: req.user.id } });
      
      if (!permissions || !permissions[permissionName]) {
        return res.status(403).json({
          success: false,
          message: "غير مصرح - ليس لديك الصلاحية الكافية لإجراء هذه العملية"
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "حدث خطأ أثناء التحقق من الصلاحيات: " + error.message
      });
    }
  };
};
