// الإعدادات التشغيلية — الجسر الذي يجعل اللوحة مركز تحكّم حقيقياً.
//
// كل مفتاح هنا له سطر في settingsRegistry يسمّي الخدمة التي تقرأه فعلاً.
// المفتاح الذي لا يقرأه شيء لا يُعرَض أصلاً: «إعداد قابل للتعديل ويتجاهله
// الخادم» يخدع المشغّل ويجعله يظنّ أنه غيّر سلوكاً.

const sequelize = require('../../config/database');
const settings = require('../services/settings.service');
const audit = require('../services/audit.service');
const { handle, ok } = require('../middlewares/growthAuth');
const { err } = require('../errors');

/** كل الإعدادات مجمَّعة بقيمها وحدودها — لصفحة الإعدادات. */
exports.list = handle(async (req, res) => ok(res, await settings.describeWithValues()));

/** الإعدادات العامة — بلا مصادقة، لواجهة العميل. */
exports.publicSettings = handle(async (req, res) => {
  const values = await settings.publicSettings();
  res.set('Cache-Control', 'no-store'); // التغيير يجب أن يظهر فوراً
  return ok(res, values);
});

/**
 * حفظ مجموعة إعدادات في معاملة واحدة.
 * القيم الرقمية تُقصّ عند نطاقها بدل رفضها، ويُبلَّغ المشغّل بما قُصّ حتى
 * لا يظنّ أن قيمته حُفظت كما كتبها.
 */
exports.update = handle(async (req, res) => {
  const updates = req.body?.settings;
  if (!updates || typeof updates !== 'object') {
    throw err.validation('أرسل كائن settings يحوي المفاتيح المراد تعديلها');
  }

  const result = await sequelize.transaction(async (t) => {
    const changes = await settings.setMany(updates, { actorId: req.user.id, transaction: t });

    if (changes.changedCount > 0) {
      await audit.log({
        actor: req.user, action: 'settings.update', resourceType: 'growth_setting',
        resourceId: Object.keys(changes.after).join(','),
        before: changes.before, after: changes.after,
        reason: req.body?.reason || null,
        req, severity: 'critical', transaction: t,
      });
    }
    return changes;
  });

  const values = await settings.describeWithValues();

  return ok(res, {
    settings: values,
    changed: Object.keys(result.after),
    clamped: result.clamped,
  }, result.clamped.length
    ? `حُفظت الإعدادات. قُصّت ${result.clamped.length} قيمة عند الحد المسموح`
    : result.changedCount
      ? 'تم حفظ الإعدادات وسرت فوراً'
      : 'لا تغييرات لحفظها');
});
