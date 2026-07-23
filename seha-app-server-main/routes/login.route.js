const express = require("express");
const router = express.Router();

// Lazy load controller to avoid database initialization errors
let loginController;
try {
  loginController = require("../controller/login.controller");
} catch (error) {
  console.error("⚠️ Login controller not loaded:", error.message);
}

const { loginValidation } = require("../validations/login.validation");
const config = require("../config/middlewares");

router
  .route("/login")
  .get((req, res) => {
    res.json({
      message: "Login endpoint is working. Use POST method to login.",
      method: "POST",
      body: {
        email: "string",
        password: "string"
      },
      controller_loaded: !!loginController
    });
  })
  .post(loginValidation, config.mwError, (req, res, next) => {
    if (!loginController) {
      return res.status(503).json({
        message: "Service temporarily unavailable - database connection error"
      });
    }
    return loginController.login(req, res, next);
  });

module.exports = router;
