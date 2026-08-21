// إدارة جلسة إرسال واتساب: الحالة، بدء الإقران (QR)، وتسجيل الخروج.
// كلّها محميّة بتسجيل الدخول — الجلسة تخصّ رقم المنشأة لا المستخدم.
const express = require("express");
const router = express.Router();
const config = require("../config/middlewares");

const load = () => require("../utils/whatsappSender");

// حالة الخدمة: مفعّلة؟ متصلة؟ ورمز QR إن كان الإقران مطلوباً.
router.get("/whatsapp/status", config.auth, (req, res) => {
  try {
    const whatsapp = load();
    // شفاء ذاتي: إن كان هناك إقران محفوظ والجلسة غير مفتوحة (بعد نشر أو
    // استيقاظ من السكون) نفتحها في الخلفية. بدون هذا تبقى connected=false
    // فيختفي زر «إرسال عبر واتساب» ولا يبقى ما يفتح الاتصال — قفل مزدوج.
    whatsapp.ensureConnected().catch(() => {});
    return res.status(200).json({ success: true, data: whatsapp.status() });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// بدء الإقران. مع تمرير `number` (رقم الحساب بصيغة دولية) يصدر واتساب رمزاً من
// ٨ خانات يُكتب في الهاتف: واتساب ← الأجهزة المرتبطة ← ربط برقم الهاتف. وبدونه
// يُكتفى برمز QR. الطريقتان إقران حقيقي من خادم واتساب — لا يُعلن الاتصال إلا
// بعد إتمامه فعلياً على الهاتف. بعدها تُحفظ الجلسة في قاعدة البيانات فلا يتكرّر.
router.post("/whatsapp/connect", config.auth, async (req, res) => {
  const whatsapp = load();
  try {
    const { number } = req.body || {};
    // الرقم يُتحقّق منه هنا كي يصل الخطأ للمستخدم فوراً بدل أن يُبتلع في الخلفية.
    if (number) {
      console.log(`[WA] REQUEST_NUMBER raw=${JSON.stringify(String(number))}`);
      whatsapp.normalizePairingMsisdn(number);
    }
    // لا ننتظر اكتمال الاتصال: رمز QR/الإقران يصل عبر حدث لاحق، والواجهة تستعلم
    // عن الحالة دورياً حتى يظهر.
    // «بدء الربط» يعني محاولة جديدة: نبدأ من هوية جهاز نظيفة حتى لا تتراكم
    // تسجيلات المحاولات السابقة (وبعضها كان برقم خاطئ) فيرفضها واتساب.
    if (number) await whatsapp.resetForNewPairing();
    whatsapp.connect({ pairingNumber: number })
      .catch((err) => console.warn('WhatsApp connect:', err.message));
    await new Promise((r) => setTimeout(r, 2500));
    return res.status(200).json({ success: true, data: whatsapp.status() });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
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
