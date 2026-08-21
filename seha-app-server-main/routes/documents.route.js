const express = require('express');
const router = express.Router();

let documentsController;
try {
  documentsController = require('../controller/documents.controller');
} catch (error) {
  console.error('⚠️ Documents controller not loaded:', error.message);
}

const checkController = (req, res, next) => {
  if (!documentsController) {
    return res.status(503).json({ message: 'Service temporarily unavailable' });
  }
  next();
};

// وصف القوالب الورقية وحقولها وخيارات الخطوط — تقرأه الواجهة.
router.get('/documents/templates', checkController, (req, res) =>
  documentsController.listTemplates(req, res));

// HTML المستند للمعاينة الحيّة (نفس مخرَج مولّد الـ PDF).
router.post('/documents/preview-html', checkController, (req, res) =>
  documentsController.previewHtml(req, res));

// استخراج البيانات من ملف مرفوع وتحديد القالب المطابق.
router.post('/documents/ai-extract', checkController, (req, res) =>
  documentsController.aiExtractDocument(req, res));

module.exports = router;
