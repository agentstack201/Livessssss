// ───────────────────────────────────────────────────────────────────────────
// حارس صلاحيات وحدة النمو — الفحص كلّه على الخادم، دائماً.
//
// الواجهة تُخفي الأزرار التي لا يملكها المستخدم، لكن الإخفاء زينة لا حماية:
// أي عميل يستطيع استدعاء المسار مباشرة. هذا الملف هو الحاجز الحقيقي الوحيد.
//
// جسر التوافق مع النظام القائم: role === 'admin' يتخطّى الفحص. مالك النظام
// يجب ألّا يُقفَل خارج وحدة أُضيفت بعد إنشاء حسابه.
//
// الصلاحيات تُقرأ من قاعدة البيانات في كل طلب لا من الـ JWT: تجريد صلاحية
// من اللوحة يجب أن يسري فوراً، بينما رمز الدخول القديم يظلّ صالحاً ساعات.
// ───────────────────────────────────────────────────────────────────────────

const verifyToken = require('../../middlewares/authMW');
const roles = require('../services/role.service');
const { GrowthError } = require('../errors');

/** يحمّل صلاحيات المستخدم مرة واحدة لكل طلب. */
async function loadPermissions(req) {
  if (req._growthPermissions) return req._growthPermissions;
  const perms = req.user?.role === 'admin'
    ? ['*']
    : await roles.permissionsFor(req.user.id);
  req._growthPermissions = perms;
  return perms;
}

/**
 * يتطلّب صلاحية بعينها. يُركَّب بعد verifyToken.
 * @param {string} permission مفتاح من config/permissions.js
 */
function requirePermission(permission) {
  return async (req, res, next) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false, code: 'UNAUTHENTICATED',
          message: 'الرجاء تسجيل الدخول أولاً',
        });
      }

      const perms = await loadPermissions(req);
      if (perms.includes('*') || perms.includes(permission)) return next();

      return res.status(403).json({
        success: false, code: 'FORBIDDEN',
        message: 'ليس لديك صلاحية لهذه العملية',
        required: permission,
      });
    } catch (error) {
      return next(error);
    }
  };
}

/** مصادقة بلا صلاحية محدّدة — للمسارات الخاصة بالمستخدم نفسه. */
const authenticated = [verifyToken];

/** مصادقة + صلاحية. */
const guard = (permission) => [verifyToken, requirePermission(permission)];

/**
 * مغلّف يحوّل أخطاء الوحدة إلى ردود موحّدة الشكل.
 * كل متحكّم يُلفّ به فلا يتكرّر try/catch في كل دالة، ولا يتسرّب خطأ غير
 * متوقّع إلى العميل بتفاصيله الداخلية.
 */
function handle(fn) {
  return async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      if (error instanceof GrowthError) {
        return res.status(error.status).json({
          success: false, code: error.code,
          message: error.message, details: error.details,
        });
      }
      // خطأ غير متوقّع: يُسجَّل كاملاً ويخرج مختصراً.
      console.error('[growth] خطأ غير متوقّع:', error);
      return res.status(500).json({
        success: false, code: 'INTERNAL',
        message: 'حدث خطأ أثناء تنفيذ العملية',
      });
    }
  };
}

/** رد نجاح موحّد. */
const ok = (res, data, message = null, status = 200) =>
  res.status(status).json({ success: true, status_code: status, data, message });

module.exports = { requirePermission, loadPermissions, authenticated, guard, handle, ok };
