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

// Get specific setting
router.get("/:key", config.auth, settingsController.getSettingByKey);

// Update/Create setting (Admin only)
router.post("/", config.auth, settingsController.updateSetting);

module.exports = router;
