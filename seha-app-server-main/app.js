// Load environment variables FIRST before anything else
require("dotenv").config();

const express = require("express");
const app = express();
const cors = require("cors");
const path = require("path");

// Lazy load database and routes to avoid initialization errors
let sequelize, routes;
try {
  sequelize = require("./config/database");
  routes = require("./config/routes.js");
  require("./config/models_associations.js");
} catch (error) {
  console.error("Error loading modules:", error.message);
}

// CORS Configuration - Allow all origins for now
app.use(cors({
  origin: true,
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Length', 'Content-Type']
}));

// Handle preflight requests explicitly
app.options('/*splat', cors());

// app.get("/", (req, res) => {
//   res.send(`hello from leaves app`);
// });

// Body parsers
app.use([
  express.json({ limit: "50mb" }),
  express.urlencoded({ extended: false, limit: "50mb" }),
]);

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`, req.body);
  next();
});

// Health check - MUST be before other routes
app.get("/", (req, res) => {
  res.json({ status: "OK", message: "Seha API is running", timestamp: new Date().toISOString() });
});

// API Routes - only if routes loaded successfully
if (routes) {
  app.use([routes.loginRoute, routes.countryRoute, routes.leaveRoute, routes.doctorRoute, routes.hospitalRoute]);
  if (routes.whatsappRoute) app.use(routes.whatsappRoute);
  app.use('/users', routes.usersRoute);
} else {
  console.warn("Routes not loaded - API endpoints unavailable");
}

// Static files
app.use("/public", express.static(path.join(__dirname, "public")));

// not found middleWare
app.use((req, res) => {
  res.status(404).json({ message: "end point Not Found !" });
});

//error middleWare
app.use((error, req, res, next) => {
  let status = error.status || 500;
  console.error("Error:", error);
  res.status(status).json({ message: "internal error " + error });
});

// Database connection for Vercel - only if sequelize loaded
if (sequelize) {
  sequelize
    .authenticate()
    .then(() => {
      console.log('✅ Database connection established successfully!');
      return sequelize.sync({ alter: false });
    })
    .then(() => {
      console.log('✅ All models synchronized successfully!');
      // Run auto-migrations for permission table
      return Promise.all([
        sequelize.query(`ALTER TABLE permissions ADD COLUMN IF NOT EXISTS can_manage_doctors BOOLEAN DEFAULT false;`),
        sequelize.query(`ALTER TABLE permissions ADD COLUMN IF NOT EXISTS can_manage_hospitals BOOLEAN DEFAULT false;`),
        sequelize.query(`ALTER TABLE permissions ADD COLUMN IF NOT EXISTS can_manage_settings BOOLEAN DEFAULT false;`)
      ]).then(() => {
        console.log('✅ Database permissions table successfully updated with new columns!');
      }).catch((err) => {
        console.warn('⚠️ Auto-migration warnings (checking columns):', err.message);
      });
    })
    .catch((error) => {
      console.error("❌ Database error:", error.message);
    });
} else {
  console.warn("Sequelize not loaded - database unavailable");
}

// Export for Vercel
module.exports = app;

// For local development
if (require.main === module) {
  const PORT = process.env.Port || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Server is running at http://localhost:${PORT}`);
  });
}
