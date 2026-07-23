const express = require("express");
const router = express.Router();

// Lazy load controller
let leaveController;
try {
  leaveController = require("../controller/leaves.controller");
} catch (error) {
  console.error("⚠️ Leave controller not loaded:", error.message);
}

const {
  addNewLeavesValidation,
  validateGetLeaveById,
} = require("../validations/leaves.validations");
const config = require("../config/middlewares");

const checkController = (req, res, next) => {
  if (!leaveController) {
    return res.status(503).json({ message: "Service temporarily unavailable" });
  }
  next();
};

// Download PDF - MUST be before other routes to avoid conflicts
router
  .route("/sick-leaves/:service_num/:national_id/pdf")
  .get(
    checkController,
    (req, res, next) => leaveController.downloadPDF(req, res, next)
  );

// AI Extract - specific route before general routes
router
  .route("/sick-leaves/ai-extract")
  .post(
    config.auth,
    checkController,
    (req, res, next) => leaveController.aiExtract(req, res, next)
  );

// Get leaves count for dashboard stats
router
  .route("/sick-leaves/count")
  .get(
    config.auth,
    checkController,
    (req, res, next) => leaveController.getLeavesCount(req, res, next)
  );

// Get all leaves (Dashboard) - specific route before general routes
router
  .route("/sick-leaves/all")
  .get(
    config.auth,
    checkController,
    (req, res, next) => leaveController.getAllLeaves(req, res, next)
  );

// Create new leave
router
  .route("/sick-leaves")
  .post(
    config.auth,
    addNewLeavesValidation,
    config.mwError,
    checkController,
    (req, res, next) => leaveController.addNewLeaves(req, res, next)
  );

const optionalAuth = require("../middlewares/optionalAuthMW");

// Get leave details (Search/Inquiry)
router
  .route("/sick-leaves")
  .get(
    optionalAuth,
    checkController,
    (req, res, next) => leaveController.getOneLeaveDetails(req, res, next)
  );

// Update leave
router
  .route("/sick-leaves")
  .put(
    config.auth,
    addNewLeavesValidation,
    config.mwError,
    checkController,
    (req, res, next) => leaveController.updateLeave(req, res, next)
  );

// Delete leave
router
  .route("/sick-leaves")
  .delete(
    config.auth,
    checkController,
    (req, res, next) => leaveController.deleteLeave(req, res, next)
  );

module.exports = router;
