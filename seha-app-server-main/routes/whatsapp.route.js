// إدارة جلسة إرسال واتساب: الحالة، بدء الإقران (QR)، وتسجيل الخروج.
// كلّها محميّة بتسجيل الدخول — الجلسة تخصّ رقم المنشأة لا المستخدم.
const express = require("express");
const router = express.Router();
const config = require("../config/middlewares");

const load = () => require("../utils/whatsappSender");

// حالة الخدمة: مفعّلة؟ متصلة؟ ورمز QR إن كان الإقران مطلوباً.
router.get("/whatsapp/status", config.auth, (req, res) => {
  try {
    return res.status(200).json({ success: true, data: load().status() });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// بدء الاتصال. أول مرة يُرجع رمز QR يُمسح من تطبيق واتساب على الهاتف
// (الأجهزة المرتبطة). بعد الإقران تُحفظ الجلسة في قاعدة البيانات فلا يتكرّر.
router.post("/whatsapp/connect", config.auth, async (req, res) => {
  const whatsapp = load();
  try {
    // لا ننتظر اكتمال الاتصال: رمز QR يصل عبر حدث لاحق، والواجهة تستعلم
    // عن الحالة دورياً حتى يظهر.
    whatsapp.connect().catch((err) => console.warn('WhatsApp connect:', err.message));
    await new Promise((r) => setTimeout(r, 1500));
    return res.status(200).json({ success: true, data: whatsapp.status() });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// فصل الجلسة ومسح حالتها (يلزم إقران جديد بعدها).
router.post("/whatsapp/logout", config.auth, async (req, res) => {
  try {
    await load().logout();
    return res.status(200).json({ success: true, message: "تم فصل جلسة واتساب" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
