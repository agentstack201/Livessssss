const User = require("../models/user.model");
const { createTeamAccounts } = require("../utils/teamAccounts");

// ───────────────────────────────────────────────────────────────────────────
// إعداد أولي عبر المتصفح لمن لا يملك وصول Shell إلى الخادم (مثل خطط
// الاستضافة المجانية). يُنشئ حساب المالك (admin) وثلاثة حسابات موظفين
// بكلمات مرور عشوائية، ويعرضها في صفحة واحدة تُفتح بمجرد زيارة الرابط.
//
// أمان: يعمل مرة واحدة فقط طوال عمر النظام — بشرط عدم وجود أي مستخدم مسبقاً.
// بعد إنشاء أول حساب تُغلق هذه النقطة تلقائياً وتُرجع 403 للأبد، فلا حاجة
// لحذفها أو تعطيلها يدوياً لاحقاً.
// ───────────────────────────────────────────────────────────────────────────

const PAGE_STYLE = `
  body { font-family: 'Tahoma', Arial, sans-serif; background: #0f172a; color: #e2e8f0;
    margin: 0; padding: 40px 16px; direction: rtl; }
  .card { max-width: 720px; margin: 0 auto; background: #1e293b; border-radius: 16px;
    padding: 32px; box-shadow: 0 10px 40px rgba(0,0,0,0.3); }
  h1 { font-size: 1.5rem; margin: 0 0 8px; }
  p.subtitle { color: #94a3b8; margin: 0 0 24px; }
  .account { background: #0f172a; border-radius: 10px; padding: 16px 20px; margin-bottom: 14px;
    border-inline-start: 4px solid #7c3aed; }
  .account.owner { border-inline-start-color: #10b981; }
  .account .label { font-weight: 700; color: #a78bfa; margin-bottom: 6px; }
  .account.owner .label { color: #34d399; }
  .row { display: flex; gap: 10px; margin: 4px 0; font-size: 0.95rem; }
  .row .k { color: #94a3b8; min-width: 90px; }
  .row .v { font-family: monospace; direction: ltr; text-align: left; color: #f1f5f9; }
  .warn { margin-top: 20px; background: #422006; border: 1px solid #92400e; color: #fbbf24;
    padding: 14px 18px; border-radius: 10px; font-size: 0.95rem; }
  .done { text-align: center; padding: 60px 20px; }
`;

function renderAccountsPage(results) {
  const rows = results.map((r) => `
    <div class="account ${r.role === 'admin' ? 'owner' : ''}">
      <div class="label">${r.label}</div>
      <div class="row"><span class="k">البريد</span><span class="v">${r.email}</span></div>
      <div class="row"><span class="k">كلمة المرور</span><span class="v">${r.passwordShown}</span></div>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head><meta charset="UTF-8"><title>إعداد الحسابات</title><style>${PAGE_STYLE}</style></head>
<body>
  <div class="card">
    <h1>✅ تم إنشاء الحسابات بنجاح</h1>
    <p class="subtitle">انسخ البريد وكلمة المرور لكل حساب الآن، ثم افتح صفحة تسجيل الدخول.</p>
    ${rows}
    <div class="warn">⚠️ هذه الصفحة لن تظهر مرة أخرى وكلمات المرور لا تُخزَّن — انسخها الآن قبل إغلاق الصفحة.
      يمكن تغييرها لاحقاً من صفحة «إدارة المستخدمين» بعد تسجيل الدخول.</div>
  </div>
</body>
</html>`;
}

function renderAlreadyDonePage() {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head><meta charset="UTF-8"><title>تم الإعداد مسبقاً</title><style>${PAGE_STYLE}</style></head>
<body>
  <div class="card done">
    <h1>🔒 تم إعداد الحسابات مسبقاً</h1>
    <p class="subtitle">يوجد حساب واحد على الأقل في النظام، فهذه الصفحة أُغلقت تلقائياً.<br>
      إن نسيت بيانات الدخول تواصل مع من يملك حساب "admin" لإنشاء حساب لك من صفحة إدارة المستخدمين.</p>
  </div>
</body>
</html>`;
}

module.exports.bootstrapTeam = async (req, res, next) => {
  try {
    const existingCount = await User.count();
    if (existingCount > 0) {
      return res.status(403).send(renderAlreadyDonePage());
    }

    const results = await createTeamAccounts();
    return res.status(200).send(renderAccountsPage(results));
  } catch (error) {
    console.error('❌ Bootstrap team error:', error);
    return res.status(500).json({
      status_code: 500,
      success: false,
      message: 'حدث خطأ أثناء إنشاء الحسابات: ' + error.message,
    });
  }
};
