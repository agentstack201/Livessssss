const express = require("express");
const router = express.Router();
const config = require("../config/middlewares");

// Lazy load controller
let hospitalController;
try {
  hospitalController = require("../controller/hospital.controller");
} catch (error) {
  console.error("⚠️ Hospital controller failed to load:", error.message);
  hospitalController = {
    getAllHospitals: (req, res) => res.status(503).json({ success: false, message: "Hospital service initializing..." }),
    addHospital: (req, res) => res.status(503).json({ success: false, message: "Hospital service initializing..." }),
    updateHospital: (req, res) => res.status(503).json({ success: false, message: "Hospital service initializing..." }),
    deleteHospital: (req, res) => res.status(503).json({ success: false, message: "Hospital service initializing..." })
  };
}

// GET all hospitals (accessible to all authenticated users for autocompletion)
router.get("/all-hospitals", config.auth, (req, res, next) => hospitalController.getAllHospitals(req, res, next));

// POST a new hospital (requires can_manage_hospitals permission)
router.post("/hospitals", config.auth, config.permission("can_manage_hospitals"), (req, res, next) => hospitalController.addHospital(req, res, next));

// PUT update hospital (requires can_manage_hospitals permission)
router.put("/hospitals/:id", config.auth, config.permission("can_manage_hospitals"), (req, res, next) => hospitalController.updateHospital(req, res, next));

// DELETE hospital (requires can_manage_hospitals permission)
router.delete("/hospitals/:id", config.auth, config.permission("can_manage_hospitals"), (req, res, next) => hospitalController.deleteHospital(req, res, next));

module.exports = router;
