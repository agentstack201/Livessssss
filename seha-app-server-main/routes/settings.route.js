const express = require("express");
const router = express.Router();
const settingsController = require("../controller/settings.controller");
const config = require("../config/middlewares");

// Get all settings (Admin only)
router.get("/", config.auth, settingsController.getAllSettings);

// Live health check of every configured Gemini key. Declared before "/:key" so
// the parameterised route cannot shadow it.
router.get("/ai/diagnose", config.auth, async (req, res) => {
  try {
    const { diagnose } = require("../utils/gemini");
    const report = await diagnose();
    return res.status(200).json({ success: true, data: report });
  } catch (error) {
    console.error("AI diagnose failed:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ── التكريم الملكي في صفحة الدخول ──
// مُعلنة قبل "/:key" حتى لا يبتلعها المسار العام.
// قراءة عامة بلا مصادقة (صفحة الدخول) — الإعداد ثم الصورة/الصوت المحفوظان فيه.
router.get("/public/login-tribute", settingsController.getLoginTribute);
router.get("/public/login-tribute/:kind", settingsController.getLoginTributeMedia);
// الحفظ لمن يملك صلاحية إدارة الإعدادات (المشرف يتجاوز الفحص).
router.put(
  "/login-tribute",
  config.auth,
  config.permission("can_manage_settings"),
  settingsController.saveLoginTribute
);

// Get specific setting
router.get("/:key", config.auth, settingsController.getSettingByKey);

// Update/Create setting (Admin only)
router.post("/", config.auth, settingsController.updateSetting);

module.exports = router;
