// ───────────────────────────────────────────────────────────────────────────
// تركيب المسارات — المصدر الوحيد للحقيقة لما يُركَّب على الخادم.
//
// كان التركيب مكتوباً داخل index.js، ونسخة ثانية منه داخل app.js. المسار
// الذي يُضاف إلى إحداهما فقط يُحمَّل ويطبع «✅ route loaded» في سجلّ الإقلاع
// ثم لا يستجيب أبداً — لأن التحميل شيء والتركيب شيء آخر. هكذا صار
// /documents/preview-html يردّ 404 في الإنتاج رغم ظهوره محمَّلاً في السجلّ.
//
// الآن جدول واحد يصف كل مسار وأين يُركَّب، وأي مسار موجود في config/routes.js
// وغائب عن هذا الجدول يُطبع كتحذير صريح عند الإقلاع بدل أن يختفي بصمت.
// إضافة مسار جديد = سطر واحد في MOUNTS.
// ───────────────────────────────────────────────────────────────────────────

// at: null ⇐ الراوتر نفسه يحمل مساره الكامل (مثل /sick-leaves أو /documents/…)
const MOUNTS = [
  { name: 'loginRoute',     at: null },
  { name: 'countryRoute',   at: null },
  { name: 'leaveRoute',     at: null },
  { name: 'doctorRoute',    at: null },
  { name: 'hospitalRoute',  at: null },
  { name: 'keysRoute',      at: null },
  { name: 'setupRoute',     at: null },
  { name: 'whatsappRoute',  at: null },
  { name: 'documentsRoute', at: null },
  { name: 'usersRoute',     at: '/users' },
  { name: 'mediaRoute',     at: '/media' },
  { name: 'settingsRoute',  at: '/settings' },
  { name: 'growthRoute',    at: '/growth' },
];

/**
 * يركّب كل المسارات على تطبيق express.
 * @param {import('express').Application} app
 * @param {Record<string, import('express').Router>} routes مُصدَّرات config/routes.js
 */
function mountRoutes(app, routes) {
  if (!routes) {
    console.warn('⚠️  المسارات لم تُحمَّل — واجهة الـ API غير متاحة.');
    return [];
  }

  const mounted = [];
  for (const { name, at } of MOUNTS) {
    const router = routes[name];
    if (!router) {
      console.warn(`⚠️  ${name} غير موجود في config/routes.js — لم يُركَّب.`);
      continue;
    }
    if (at) app.use(at, router);
    else app.use(router);
    mounted.push(name);
  }

  // الحارسة: راوتر مُصدَّر ولم يُذكر في الجدول أعلاه = مسار ميت.
  const unmounted = Object.keys(routes).filter(
    (k) => routes[k] && !MOUNTS.some((m) => m.name === k)
  );
  if (unmounted.length) {
    console.warn(`⚠️  مسارات مُحمَّلة وغير مُركَّبة (ستردّ 404): ${unmounted.join(', ')}`);
    console.warn('   الحل: أضِفها إلى MOUNTS في config/mountRoutes.js');
  }

  console.log(`✅ رُكِّب ${mounted.length} مسار: ${mounted.join(', ')}`);
  return mounted;
}

module.exports = { mountRoutes, MOUNTS };
