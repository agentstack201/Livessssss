const express = require("express");
const router = express.Router();
const config = require("../config/middlewares");

let ctrl;
try {
  ctrl = require("../controller/apiKeys.controller");
} catch (error) {
  console.error("⚠️ apiKeys controller not loaded:", error.message);
}

// Managing provider keys is admin-only. authMW sets req.user.role.
function requireAdmin(req, res, next) {
  if (req.user && req.user.role === "admin") return next();
  return res.status(403).json({ success: false, message: "هذه الصفحة للمدير فقط" });
}

const ready = (req, res, next) => {
  if (!ctrl) return res.status(503).json({ success: false, message: "الخدمة غير متاحة مؤقتاً" });
  next();
};

router.use("/api/keys", config.auth, requireAdmin, ready);

router.get("/api/keys", (req, res, next) => ctrl.list(req, res, next));
router.post("/api/keys", (req, res, next) => ctrl.create(req, res, next));
router.patch("/api/keys/:id", (req, res, next) => ctrl.update(req, res, next));
router.delete("/api/keys/:id", (req, res, next) => ctrl.remove(req, res, next));
router.post("/api/keys/:id/reset", (req, res, next) => ctrl.reset(req, res, next));
router.post("/api/keys/:id/test", (req, res, next) => ctrl.test(req, res, next));

module.exports = router;
