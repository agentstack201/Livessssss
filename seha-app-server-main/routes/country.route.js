const express = require("express");
const router = express.Router();

// Lazy load controller
let countyController;
try {
  countyController = require("../controller/country.controller");
} catch (error) {
  console.error("⚠️ Country controller not loaded:", error.message);
}

const { addCountriesValidation } = require("../validations/country.validation");
const config = require("../config/middlewares");

const checkController = (req, res, next) => {
  if (!countyController) {
    return res.status(503).json({ message: "Service temporarily unavailable" });
  }
  next();
};

// إضافة دول متعددة (للتهيئة)
router
  .route("/new-countries")
  .post(
    config.auth,
    addCountriesValidation,
    config.mwError,
    checkController,
    (req, res, next) => countyController.addNewCountries(req, res, next)
  );

// جلب جميع الدول
router
  .route("/all-countries")
  .get(config.auth, checkController, (req, res, next) => countyController.getAllCountries(req, res, next));

// إضافة دولة جديدة
router
  .route("/countries")
  .post(
    config.auth,
    checkController,
    (req, res, next) => countyController.addCountry(req, res, next)
  );

// تعديل دولة
router
  .route("/countries/:id")
  .put(
    config.auth,
    checkController,
    (req, res, next) => countyController.updateCountry(req, res, next)
  );

// حذف دولة
router
  .route("/countries/:id")
  .delete(
    config.auth,
    checkController,
    (req, res, next) => countyController.deleteCountry(req, res, next)
  );

module.exports = router;
