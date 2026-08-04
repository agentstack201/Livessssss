const express = require("express");
const router = express.Router();

let setupController;
try {
  setupController = require("../controller/setup.controller");
} catch (error) {
  console.error("⚠️ Setup controller not loaded:", error.message);
}

// نقطة عامة (بلا مصادقة) لإنشاء أول حساب مدير + ثلاثة موظفين عبر المتصفح
// مباشرة — لمن لا يملك وصول Shell إلى الخادم. آمنة لأنها تعمل فقط عندما
// لا يوجد أي مستخدم مسبقاً في النظام؛ بعد أول استخدام تُغلق للأبد تلقائياً.
router
  .route("/setup/bootstrap-team")
  .get((req, res, next) => {
    if (!setupController) {
      return res.status(503).send("Service temporarily unavailable");
    }
    return setupController.bootstrapTeam(req, res, next);
  });

module.exports = router;
