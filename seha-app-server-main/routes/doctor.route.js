const express = require("express");
const router = express.Router();
const config = require("../config/middlewares");

// Lazy load controller
let doctorController;
try {
  doctorController = require("../controller/doctor.controller");
} catch (error) {
  console.error("⚠️ Doctor controller failed to load:", error.message);
  doctorController = {
    getAllDoctors: (req, res) => res.status(503).json({ success: false, message: "Doctor service initializing..." }),
    addDoctor: (req, res) => res.status(503).json({ success: false, message: "Doctor service initializing..." }),
    updateDoctor: (req, res) => res.status(503).json({ success: false, message: "Doctor service initializing..." }),
    deleteDoctor: (req, res) => res.status(503).json({ success: false, message: "Doctor service initializing..." })
  };
}

// GET all doctors (accessible to all authenticated users for autocompletion)
router.get("/all-doctors", config.auth, (req, res, next) => doctorController.getAllDoctors(req, res, next));

// POST a new doctor (requires can_manage_doctors permission)
router.post("/doctors", config.auth, config.permission("can_manage_doctors"), (req, res, next) => doctorController.addDoctor(req, res, next));

// PUT update doctor (requires can_manage_doctors permission)
router.put("/doctors/:id", config.auth, config.permission("can_manage_doctors"), (req, res, next) => doctorController.updateDoctor(req, res, next));

// DELETE doctor (requires can_manage_doctors permission)
router.delete("/doctors/:id", config.auth, config.permission("can_manage_doctors"), (req, res, next) => doctorController.deleteDoctor(req, res, next));

module.exports = router;
