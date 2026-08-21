// Lazy load routes with error handling
let loginRoute, countryRoute, leaveRoute, usersRoute, documentsRoute;

try {
  loginRoute = require("../routes/login.route");
  console.log("✅ Login route loaded");
} catch (error) {
  console.error("❌ Login route failed:", error.message);
  // Create dummy route
  const express = require("express");
  loginRoute = express.Router();
  loginRoute.all("*", (req, res) => res.status(503).json({ message: "Login service unavailable" }));
}

try {
  countryRoute = require("../routes/country.route");
  console.log("✅ Country route loaded");
} catch (error) {
  console.error("❌ Country route failed:", error.message);
  const express = require("express");
  countryRoute = express.Router();
  countryRoute.all("*", (req, res) => res.status(503).json({ message: "Country service unavailable" }));
}

try {
  leaveRoute = require("../routes/leaves.route");
  console.log("✅ Leave route loaded");
} catch (error) {
  console.error("❌ Leave route failed:", error.message);
  const express = require("express");
  leaveRoute = express.Router();
  leaveRoute.all("*", (req, res) => res.status(503).json({ message: "Leave service unavailable" }));
}

try {
  usersRoute = require("../routes/users.route");
  console.log("✅ Users route loaded");
} catch (error) {
  console.error("❌ Users route failed:", error.message);
  const express = require("express");
  usersRoute = express.Router();
  usersRoute.all("*", (req, res) => res.status(503).json({
    status_code: 503,
    success: false,
    message: "خدمة المستخدمين غير متاحة حالياً"
  }));
}

let mediaRoute;
try {
  mediaRoute = require("../routes/media.routes");
  console.log("✅ Media route loaded");
} catch (error) {
  console.error("❌ Media route failed:", error.message);
  const express = require("express");
  mediaRoute = express.Router();
  mediaRoute.all("*", (req, res) => res.status(503).json({
    status_code: 503,
    success: false,
    message: "خدمة الوسائط غير متاحة حالياً"
  }));
}

let settingsRoute;
try {
  settingsRoute = require("../routes/settings.route");
  console.log("✅ Settings route loaded");
} catch (error) {
  console.error("❌ Settings route failed:", error.message);
  const express = require("express");
  settingsRoute = express.Router();
  settingsRoute.all("*", (req, res) => res.status(503).json({
    status_code: 503,
    success: false,
    message: "خدمة الإعدادات غير متاحة حالياً"
  }));
}

let doctorRoute;
try {
  doctorRoute = require("../routes/doctor.route");
  console.log("✅ Doctor route loaded");
} catch (error) {
  console.error("❌ Doctor route failed:", error.message);
  const express = require("express");
  doctorRoute = express.Router();
  doctorRoute.all("*", (req, res) => res.status(503).json({
    status_code: 503,
    success: false,
    message: "خدمة الأطباء غير متاحة حالياً"
  }));
}

let hospitalRoute;
try {
  hospitalRoute = require("../routes/hospital.route");
  console.log("✅ Hospital route loaded");
} catch (error) {
  console.error("❌ Hospital route failed:", error.message);
  const express = require("express");
  hospitalRoute = express.Router();
  hospitalRoute.all("*", (req, res) => res.status(503).json({
    status_code: 503,
    success: false,
    message: "خدمة المستشفيات غير متاحة حالياً"
  }));
}

let keysRoute;
try {
  keysRoute = require("../routes/apiKeys.route");
  console.log("✅ API keys route loaded");
} catch (error) {
  console.error("❌ API keys route failed:", error.message);
  const express = require("express");
  keysRoute = express.Router();
  keysRoute.all("*", (req, res) => res.status(503).json({
    success: false,
    message: "خدمة إدارة المفاتيح غير متاحة حالياً",
  }));
}

let setupRoute;
try {
  setupRoute = require("../routes/setup.route");
  console.log("✅ Setup route loaded");
} catch (error) {
  console.error("❌ Setup route failed:", error.message);
  const express = require("express");
  setupRoute = express.Router();
  setupRoute.all("*", (req, res) => res.status(503).send("Setup service unavailable"));
}

try {
  documentsRoute = require("../routes/documents.route");
  console.log("✅ Documents route loaded");
} catch (error) {
  console.error("❌ Documents route failed:", error.message);
  const express = require("express");
  documentsRoute = express.Router();
  documentsRoute.all("*", (req, res) => res.status(503).json({ message: "Documents service unavailable" }));
}

let whatsappRoute;
try {
  whatsappRoute = require("../routes/whatsapp.route");
  console.log("✅ WhatsApp route loaded");
} catch (error) {
  console.error("❌ WhatsApp route failed:", error.message);
  const express = require("express");
  whatsappRoute = express.Router();
  whatsappRoute.all("*", (req, res) => res.status(503).json({
    success: false,
    message: "خدمة واتساب غير متاحة حالياً",
  }));
}

module.exports = {
  loginRoute,
  documentsRoute,
  countryRoute,
  leaveRoute,
  usersRoute,
  mediaRoute,
  settingsRoute,
  doctorRoute,
  hospitalRoute,
  keysRoute,
  setupRoute,
  whatsappRoute,
};
