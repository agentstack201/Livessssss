// ───────────────────────────────────────────────────────────────────────────
// خدمة التدقيق — تكتب سطر التوثيق داخل معاملة العملية نفسها.
//
// لماذا داخل المعاملة وليس بعدها؟ لو كُتب خارجها لأمكن أن تنجح عملية حسّاسة
// (تعديل رصيد، اعتماد دفع) ويفشل توثيقها، فتقع تغييرات غير مرئية. سجل ناقص
// أسوأ من غيابه: يمنح ثقة كاذبة. لذلك كل دالة هنا تستقبل transaction وتلزم
// المستدعي بتمريرها.
//
// diff() يحصر اللقطة في الحقول المتغيّرة فقط — سطر التدقيق يبقى صغيراً
// ومقروءاً بدل أن يكرّر الصفّ كاملاً مرتين.
// ───────────────────────────────────────────────────────────────────────────

const { GrowthAuditLog } = require('../models');

/** يستخرج قيم `fields` من كائن نموذج أو كائن عادي. */
function snapshot(obj, fields) {
  if (!obj) return null;
  const src = typeof obj.get === 'function' ? obj.get({ plain: true }) : obj;
  const out = {};
  for (const f of fields) if (Object.hasOwn(src, f)) out[f] = src[f];
  return out;
}

/**
 * يقارن لقطتين ويعيد الحقول المتغيّرة فقط.
 * يُستعمل قبل الحفظ: خُذ لقطة، عدّل، ثم قارن.
 */
function diff(beforeObj, afterObj, fields) {
  const b = snapshot(beforeObj, fields) || {};
  const a = snapshot(afterObj, fields) || {};
  const before = {};
  const after = {};
  for (const f of fields) {
    const bv = b[f];
    const av = a[f];
    // مقارنة عبر JSON لتغطية JSONB والتواريخ بلا مفاجآت مرجعية.
    if (JSON.stringify(bv) !== JSON.stringify(av)) {
      before[f] = bv;
      after[f] = av;
    }
  }
  return { before, after, changed: Object.keys(after).length > 0 };
}

/**
 * يكتب سطر تدقيق.
 * @param {object}  p.actor         كائن req.user
 * @param {string}  p.action        بصيغة resource.action مثل product.update
 * @param {string}  p.resourceType  نوع المورد
 * @param {*}       p.resourceId    معرّفه
 * @param {object}  p.before        لقطة قبل (اختيارية)
 * @param {object}  p.after         لقطة بعد (اختيارية)
 * @param {string}  p.reason        سبب — إلزامي في العمليات المالية
 * @param {object}  p.req           للحصول على IP و user-agent
 * @param {string}  p.severity      info | notice | critical
 * @param {object}  p.transaction   معاملة العملية — تُمرَّر دائماً
 */
async function log({
  actor, action, resourceType, resourceId,
  before = null, after = null, reason = null,
  req = null, severity = 'info', transaction = null,
}) {
  return GrowthAuditLog.create(
    {
      actor_id: actor?.id || null,
      actor_name: actor?.name || null,
      actor_role: actor?.role || null,
      action,
      resource_type: resourceType,
      resource_id: resourceId === null || resourceId === undefined ? null : String(resourceId),
      before,
      after,
      reason,
      ip_address: clientIp(req),
      user_agent: req?.get ? (req.get('user-agent') || null) : null,
      severity,
    },
    { transaction }
  );
}

/** عنوان العميل خلف وسيط أو موازن حمل. */
function clientIp(req) {
  if (!req) return null;
  const fwd = req.headers?.['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim().slice(0, 45);
  return (req.ip || req.connection?.remoteAddress || '').slice(0, 45) || null;
}

module.exports = { log, diff, snapshot, clientIp };
