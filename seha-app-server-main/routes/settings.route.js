const express = require("express");
const router = express.Router();
const settingsController = require("../controller/settings.controller");
const config = require("../config/middlewares");

// Get all settings (Admin only)
router.get("/", config.auth, settingsController.getAllSettings);

// Get specific setting
router.get("/:key", config.auth, settingsController.getSettingByKey);

// Update/Create setting (Admin only)
router.post("/", config.auth, settingsController.updateSetting);

module.exports = router;
