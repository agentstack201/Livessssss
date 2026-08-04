// Load environment variables FIRST before anything else
require("dotenv").config();

const express = require("express");
const app = express();
const cors = require("cors");
const path = require("path");

// Lazy load routes ONLY (skip database for now to avoid pg error)
let sequelize, routes, loadError = null;
try {
  console.log("Loading routes...");
  routes = require("./config/routes.js");
  console.log("✅ Routes loaded:", Object.keys(routes));
} catch (error) {
  loadError = {
    message: error.message,
    stack: error.stack,
    name: error.name
  };
  console.error("❌ Error loading routes:", error.message);
  console.error("Stack:", error.stack);
}

// Try to load database separately (won't block routes if it fails)
try {
  console.log("Loading database...");
  sequelize = require("./config/database");
  console.log("✅ Database loaded");

  console.log("Loading models associations...");
  require("./config/models_associations.js");
  console.log("✅ Models associations loaded");
} catch (error) {
  console.error("⚠️ Database not available:", error.message);
  console.log("API will work without database connection");
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

// API Health check endpoint
app.get("/api/health", (req, res) => {
  const fs = require('fs');
  const path = require('path');

  // Check if files exist
  const configExists = fs.existsSync(path.join(__dirname, 'config', 'routes.js'));
  const routesDir = fs.existsSync(path.join(__dirname, 'routes'));

  res.json({
    status: "OK",
    message: "API is running",
    routes_loaded: !!routes,
    config_exists: configExists,
    routes_dir_exists: routesDir,
    load_error: loadError,
    __dirname: __dirname,
    timestamp: new Date().toISOString()
  });
});

// Health check - MUST be before other routes
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>منصة صحة - الجبل</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: 'Cairo', sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .container {
          background: white;
          padding: 40px;
          border-radius: 20px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          max-width: 500px;
          width: 100%;
          text-align: center;
        }
        .logo {
          width: 80px;
          height: 80px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
          font-size: 40px;
        }
        h1 {
          color: #333;
          margin-bottom: 10px;
          font-size: 28px;
        }
        p {
          color: #666;
          margin-bottom: 30px;
          line-height: 1.6;
        }
        .status {
          display: inline-block;
          background: #10b981;
          color: white;
          padding: 8px 20px;
          border-radius: 20px;
          font-size: 14px;
          margin-bottom: 20px;
        }
        .links {
          display: flex;
          gap: 10px;
          justify-content: center;
          flex-wrap: wrap;
        }
        .btn {
          padding: 12px 24px;
          border-radius: 8px;
          text-decoration: none;
          font-weight: 600;
          transition: all 0.3s;
        }
        .btn-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }
        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(102, 126, 234, 0.4);
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #eee;
          color: #999;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">🏥</div>
        <h1>منصة صحة - الجبل</h1>
        <p>نظام إدارة الإجازات المرضية الإلكتروني</p>
        <div class="status">✓ النظام يعمل بشكل طبيعي</div>
        <div class="links">
          <a href="${process.env.FRONTEND_URL || '#'}" class="btn btn-primary">الذهاب للموقع</a>
        </div>
        <div class="footer">
          <p>© 2025 منصة صحة - جميع الحقوق محفوظة</p>
        </div>
      </div>
    </body>
    </html>
  `);
});

// API Routes - only if routes loaded successfully
if (routes) {
  app.use([routes.loginRoute, routes.countryRoute, routes.leaveRoute, routes.doctorRoute, routes.hospitalRoute]);
  if (routes.keysRoute) app.use(routes.keysRoute);
  app.use('/users', routes.usersRoute);
  app.use('/media', routes.mediaRoute);
  app.use('/settings', routes.settingsRoute);
} else {
  console.warn("Routes not loaded - API endpoints unavailable");
}

// Static files
app.use("/public", express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));

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
        sequelize.query(`ALTER TABLE permissions ADD COLUMN IF NOT EXISTS can_manage_settings BOOLEAN DEFAULT false;`),
        // رقم جوال الزبون لإرسال التقرير عبر واتساب
        sequelize.query(`ALTER TABLE leaves ADD COLUMN IF NOT EXISTS phone VARCHAR(30) DEFAULT '';`),
        // قالب «مشهد مراجعة لمرافق» — أعمدة اختيارية لا تمسّ الإجازة المرضية
        sequelize.query(`ALTER TABLE leaves ADD COLUMN IF NOT EXISTS document_type VARCHAR(32) DEFAULT 'sick_leave';`),
        sequelize.query(`ALTER TABLE leaves ADD COLUMN IF NOT EXISTS admission_time VARCHAR(32) DEFAULT '';`),
        sequelize.query(`ALTER TABLE leaves ADD COLUMN IF NOT EXISTS discharge_time VARCHAR(32) DEFAULT '';`),
        sequelize.query(`ALTER TABLE leaves ADD COLUMN IF NOT EXISTS relation_en VARCHAR(191) DEFAULT '';`),
        sequelize.query(`ALTER TABLE leaves ADD COLUMN IF NOT EXISTS relation_ar VARCHAR(191) DEFAULT '';`),
        sequelize.query(`ALTER TABLE leaves ADD COLUMN IF NOT EXISTS visit_type_en VARCHAR(191) DEFAULT '';`),
        sequelize.query(`ALTER TABLE leaves ADD COLUMN IF NOT EXISTS visit_type_ar VARCHAR(191) DEFAULT '';`),
        // توسيع عمود رابط الوسائط ليتّسع لروابط data:base64 عند الرفع المحلي
        sequelize.query(`ALTER TABLE media ALTER COLUMN url TYPE TEXT;`)
      ]).then(() => {
        console.log('✅ Database permissions table successfully updated with new columns!');
      }).catch((err) => {
        console.warn('⚠️ Auto-migration warnings (checking columns):', err.message);
      });
    })
    .then(() => {
      // Seed the nationality list so a freshly-created database still renders a
      // populated dropdown. Idempotent: only inserts entries that are missing.
      const { seedCountries } = require("./config/seed.js");
      return seedCountries();
    })
    .then(() => {
      // Move any legacy single-setting Gemini key(s) into the rotation pool.
      const { importLegacyGeminiKeys } = require("./utils/llm/bootstrap.js");
      return importLegacyGeminiKeys();
    })
    .catch((error) => {
      console.error("❌ Database error:", error.message);
    });
} else {
  console.warn("Sequelize not loaded - database unavailable");
}

// Local server start
const PORT = process.env.PORT || process.env.Port || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running locally on http://localhost:${PORT}`);
});

// Export for Vercel
module.exports = app;
