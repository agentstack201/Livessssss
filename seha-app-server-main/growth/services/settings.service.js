// ───────────────────────────────────────────────────────────────────────────
// خدمة الإعدادات — الجسر بين سجل المفاتيح في الكود والقيم في PostgreSQL.
//
// قرار الأداء المهم: لا توجد ذاكرة تخزين مؤقّت عابرة للطلبات.
//
// لماذا؟ المتطلب يقول إن تغيير الإعداد يجب أن يسري «فوراً» على العمليات
// اللاحقة. أي cache بمدّة صلاحية — ولو 30 ثانية — يجعل هذا الوعد كاذباً،
// والنشر هنا عديم الحالة (عدّة نسخ من الخادم) فذاكرة نسخة واحدة تبقى قديمة
// في النسخ الأخرى بلا أي وسيلة إبطال. جدول الإعدادات أقل من مئة صفّ وقراءته
// من Postgres تكلّف ~1ms، فالثمن الحقيقي معدوم.
//
// ما يوجد بدلاً منه: ذاكرة بعمر الطلب الواحد (req._growthSettings). داخل
// الطلب الواحد لا يمكن أن تتغيّر القيمة تغيّراً ذا معنى، وهذا يمنع عشرات
// الاستعلامات المكرّرة في العملية الواحدة دون أي خطر قِدَم.
// ───────────────────────────────────────────────────────────────────────────

const { GrowthSetting } = require('../models');
const registry = require('../config/settingsRegistry');
const { err } = require('../errors');

/** يقرأ كل الإعدادات من القاعدة ويدمجها فوق القيم الافتراضية المُعلنة. */
async function loadAll(transaction = null) {
  const rows = await GrowthSetting.findAll({ transaction });
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  const out = {};
  for (const key of registry.ALL_KEYS) {
    out[key] = registry.castOut(key, Object.hasOwn(stored, key) ? stored[key] : undefined);
  }
  return out;
}

/**
 * يقرأ الإعدادات مرة واحدة لكل طلب.
 * مرّر `req` للاستفادة من ذاكرة الطلب؛ بدونه يقرأ من القاعدة في كل نداء.
 */
async function forRequest(req) {
  if (req && req._growthSettings) return req._growthSettings;
  const all = await loadAll();
  if (req) req._growthSettings = all;
  return all;
}

/** يقرأ مفتاحاً واحداً. يفضَّل forRequest حين تُقرأ عدّة مفاتيح. */
async function get(key, req = null) {
  if (!registry.REGISTRY[key]) throw err.validation(`مفتاح إعداد غير معروف: ${key}`);
  const all = await forRequest(req);
  return all[key];
}

/** الإعدادات العامة فقط — تخرج بلا مصادقة لواجهة العميل. */
async function publicSettings() {
  const all = await loadAll();
  return Object.fromEntries(registry.PUBLIC_KEYS.map((k) => [k, all[k]]));
}

/**
 * يكتب مجموعة مفاتيح داخل معاملة واحدة.
 * يعيد لقطتَي before/after للحقول المتغيّرة فقط — يستهلكهما سجل التدقيق.
 * القيم الرقمية تُقصّ عند نطاقها المُعلن بدل أن تُرفض، فلا يستطيع مُدخَل
 * خاطئ تجاوز الحدّ المسموح مهما كان دور كاتبه.
 */
async function setMany(updates, { actorId, transaction }) {
  if (!updates || typeof updates !== 'object' || !Object.keys(updates).length) {
    throw err.validation('لا توجد إعدادات لتحديثها');
  }

  const unknown = Object.keys(updates).filter((k) => !registry.REGISTRY[k]);
  if (unknown.length) throw err.validation(`مفاتيح غير معروفة: ${unknown.join(', ')}`);

  const current = await loadAll(transaction);
  const before = {};
  const after = {};
  const clamped = [];

  for (const [key, raw] of Object.entries(updates)) {
    const check = registry.validateIn(key, raw);
    if (!check.ok) throw err.validation(check.message);
    if (check.clamped) clamped.push({ key, requested: raw, applied: check.value });

    // لا نسجّل تغييراً لقيمة لم تتغيّر — يُبقي سجل التدقيق نظيفاً.
    if (current[key] === check.value) continue;

    before[key] = current[key];
    after[key] = check.value;

    const [row, created] = await GrowthSetting.findOrCreate({
      where: { key },
      defaults: { key, value: check.stored, updated_by: actorId || null },
      transaction,
    });
    if (!created) {
      await row.update({ value: check.stored, updated_by: actorId || null }, { transaction });
    }
  }

  return { before, after, clamped, changedCount: Object.keys(after).length };
}

/** وصف المفاتيح مع قيمها الحالية — لصفحة الإعدادات في اللوحة. */
async function describeWithValues() {
  const [values, schema] = await Promise.all([loadAll(), Promise.resolve(registry.describe(true))]);
  const grouped = {};
  for (const meta of Object.values(schema)) {
    (grouped[meta.group] ||= []).push({ ...meta, value: values[meta.key] });
  }
  return grouped;
}

module.exports = { loadAll, forRequest, get, publicSettings, setMany, describeWithValues };
