const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// التحقق من البيئة
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;

// إعداد مجلد التحميل (للبيئة المحلية فقط)
const uploadDir = path.join(__dirname, "../public/uploads");
if (!isVercel && !fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// إعداد Multer للتخزين
let storage;
if (isVercel) {
  // في Vercel: استخدام التخزين في الذاكرة
  storage = multer.memoryStorage();
} else {
  // محلياً: استخدام التخزين على القرص
  storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);
      cb(null, uniqueSuffix + ext);
    },
  });
}

// فلتر أنواع الملفات المسموحة
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    "application/pdf",
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("نوع الملف غير مدعوم. الأنواع المسموحة: JPG, PNG, GIF, WebP, SVG, PDF"), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB حد أقصى
  },
});

// استيراد الكونترولر
let mediaController;
try {
  mediaController = require("../controller/media.controller");
} catch (error) {
  console.error("Failed to load media controller:", error.message);
  // Create dummy controller
  mediaController = {
    uploadMedia: (req, res) => res.status(503).json({ success: false, message: "Media service initializing..." }),
    uploadMultipleMedia: (req, res) => res.status(503).json({ success: false, message: "Media service initializing..." }),
    getAllMedia: (req, res) => res.status(200).json({ success: true, data: [], pagination: { total: 0, page: 1, limit: 20, totalPages: 0 } }),
    getMediaStats: (req, res) => res.status(200).json({ success: true, data: { totalCount: 0, totalSize: 0, totalSizeFormatted: "0 Bytes" } }),
    getMediaById: (req, res) => res.status(404).json({ success: false, message: "Not found" }),
    updateMedia: (req, res) => res.status(404).json({ success: false, message: "Not found" }),
    deleteMedia: (req, res) => res.status(404).json({ success: false, message: "Not found" }),
    deleteMultipleMedia: (req, res) => res.status(200).json({ success: true, message: "No files deleted" }),
  };
}

// Routes
// رفع ملف واحد
router.post("/upload", upload.single("file"), mediaController.uploadMedia);

// رفع ملفات متعددة
router.post("/upload-multiple", upload.array("files", 20), mediaController.uploadMultipleMedia);

// جلب جميع الوسائط
router.get("/", mediaController.getAllMedia);

// جلب إحصائيات الوسائط
router.get("/stats", mediaController.getMediaStats);

// جلب ملف واحد
router.get("/:id", mediaController.getMediaById);

// تحديث معلومات ملف
router.put("/:id", mediaController.updateMedia);

// حذف ملف واحد
router.delete("/:id", mediaController.deleteMedia);

// حذف ملفات متعددة
router.post("/delete-multiple", mediaController.deleteMultipleMedia);

module.exports = router;
