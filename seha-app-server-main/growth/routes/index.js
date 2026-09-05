// ───────────────────────────────────────────────────────────────────────────
// مسارات وحدة النمو — راوتر واحد يُركَّب على /growth بسطر واحد.
//
// كل مسار محمي يعلن صلاحيته صراحةً في سطره. قراءة هذا الملف وحده تكفي
// للإجابة عن «من يستطيع فعل ماذا؟» — وهو ما يجعل مراجعة الأمان ممكنة.
//
// المسارات العامة (بلا مصادقة) ثلاثة فقط، وكلٌّ منها له سبب:
//   /public/settings   واجهة العميل تحتاج رقم الدعم وتعليمات الدفع قبل الدخول
//   /public/products   صفحة الباقات تُعرض للزائر
//   /r/:code           النقرة تسبق وجود الحساب
// ───────────────────────────────────────────────────────────────────────────

const express = require('express');

const { guard, authenticated } = require('../middlewares/growthAuth');
const products = require('../controllers/products.controller');
const orders = require('../controllers/orders.controller');
const credits = require('../controllers/credits.controller');
const coupons = require('../controllers/coupons.controller');
const referrals = require('../controllers/referrals.controller');
const campaigns = require('../controllers/campaigns.controller');
const rewards = require('../controllers/rewards.controller');
const roles = require('../controllers/roles.controller');
const analytics = require('../controllers/analytics.controller');
const settings = require('../controllers/settings.controller');
const members = require('../controllers/members.controller');

const router = express.Router();

// ── عام: بلا مصادقة ────────────────────────────────────────────────────────
router.get('/public/settings', settings.publicSettings);
router.get('/public/products', products.storefront);
router.get('/r/:code', referrals.track);
router.post('/public/coupons/validate', coupons.validate);

// ── المستخدم الحالي ────────────────────────────────────────────────────────
router.get('/me', authenticated, members.me);
router.get('/me/permissions', authenticated, roles.me);
router.get('/me/credits', authenticated, credits.myBalance);
router.get('/me/orders', authenticated, orders.mine);
router.get('/me/referral', authenticated, referrals.myLink);
router.post('/me/orders', authenticated, orders.create);
router.post('/me/orders/:id/payment', authenticated, orders.submitPayment);

// ── التحليلات ──────────────────────────────────────────────────────────────
router.get('/analytics/overview', guard('analytics:read'), analytics.overview);
router.get('/analytics/alerts', guard('analytics:read'), analytics.alerts);
router.get('/analytics/revenue', guard('analytics:read'), analytics.revenue);
router.get('/analytics/growth', guard('analytics:read'), analytics.growth);
router.get('/analytics/economics', guard('analytics:read'), analytics.economics);

// ── المنتجات ───────────────────────────────────────────────────────────────
router.get('/products', guard('products:read'), products.list);
router.post('/products', guard('products:write'), products.create);
router.put('/products/reorder', guard('products:write'), products.reorder);
router.get('/products/:id', guard('products:read'), products.get);
router.put('/products/:id', guard('products:write'), products.update);
router.delete('/products/:id', guard('products:delete'), products.remove);

// ── الطلبات ────────────────────────────────────────────────────────────────
router.get('/orders', guard('orders:read'), orders.list);
router.post('/orders', guard('orders:approve'), orders.create);
router.get('/orders/:id', guard('orders:read'), orders.get);
router.post('/orders/:id/approve', guard('orders:approve'), orders.approve);
router.post('/orders/:id/refund', guard('orders:refund'), orders.refund);
router.post('/orders/:id/cancel', guard('orders:approve'), orders.cancel);

// ── الأرصدة ────────────────────────────────────────────────────────────────
router.get('/credits/ledger', guard('credits:read'), credits.ledger);
router.get('/credits/summary', guard('credits:read'), credits.summary);
router.get('/credits/lookup', guard('credits:read'), credits.lookup);
router.get('/credits/reconcile', guard('credits:read'), credits.reconcile);
router.get('/credits/:userId/balance', guard('credits:read'), credits.balance);
router.get('/credits/:userId/history', guard('credits:read'), credits.history);
router.post('/credits/adjust', guard('credits:adjust'), credits.adjust);
router.post('/credits/expire-sweep', guard('credits:adjust'), credits.expireSweep);

// ── الكوبونات ──────────────────────────────────────────────────────────────
router.get('/coupons', guard('coupons:read'), coupons.list);
router.post('/coupons', guard('coupons:write'), coupons.create);
router.get('/coupons/:id', guard('coupons:read'), coupons.get);
router.put('/coupons/:id', guard('coupons:write'), coupons.update);
router.delete('/coupons/:id', guard('coupons:delete'), coupons.remove);
router.get('/coupons/:id/redemptions', guard('coupons:read'), coupons.redemptions);

// ── الإحالات ───────────────────────────────────────────────────────────────
router.get('/referrals/links', guard('referrals:read'), referrals.listLinks);
router.post('/referrals/links', guard('referrals:write'), referrals.createLink);
router.put('/referrals/links/:id', guard('referrals:write'), referrals.updateLink);
router.get('/referrals/funnel', guard('referrals:read'), referrals.funnel);
router.get('/referrals/events', guard('referrals:read'), referrals.events);
router.post('/referrals/release-expired', guard('referrals:moderate'), referrals.releaseExpired);
router.post('/referrals/grants/:grantId/release', guard('referrals:moderate'), referrals.releaseGrant);
router.post('/referrals/grants/:grantId/revoke', guard('referrals:moderate'), referrals.revokeGrant);

// ── الحملات ────────────────────────────────────────────────────────────────
router.get('/campaigns', guard('campaigns:read'), campaigns.list);
router.post('/campaigns', guard('campaigns:write'), campaigns.create);
router.get('/campaigns/performance', guard('campaigns:read'), campaigns.performance);
router.get('/campaigns/:id', guard('campaigns:read'), campaigns.get);
router.put('/campaigns/:id', guard('campaigns:write'), campaigns.update);
router.delete('/campaigns/:id', guard('campaigns:delete'), campaigns.remove);

// ── المكافآت ───────────────────────────────────────────────────────────────
router.get('/rewards/event-types', guard('rewards:read'), rewards.eventTypes);
router.get('/rewards/rules', guard('rewards:read'), rewards.list);
router.post('/rewards/rules', guard('rewards:write'), rewards.create);
router.put('/rewards/rules/:id', guard('rewards:write'), rewards.update);
router.delete('/rewards/rules/:id', guard('rewards:write'), rewards.remove);
router.get('/rewards/grants', guard('rewards:read'), rewards.grants);
router.get('/rewards/effectiveness', guard('rewards:read'), rewards.effectiveness);
router.post('/rewards/grants/:grantId/revoke', guard('rewards:revoke'), rewards.revokeGrant);

// ── الأدوار والفريق ────────────────────────────────────────────────────────
router.get('/roles/vocabulary', guard('roles:read'), roles.vocabulary);
router.get('/roles/members', guard('roles:read'), roles.members);
router.get('/roles', guard('roles:read'), roles.list);
router.post('/roles', guard('roles:write'), roles.create);
router.put('/roles/:id', guard('roles:write'), roles.update);
router.delete('/roles/:id', guard('roles:write'), roles.remove);
router.post('/roles/assign', guard('roles:write'), roles.assign);
router.post('/roles/revoke', guard('roles:write'), roles.revoke);

// ── الإعدادات ──────────────────────────────────────────────────────────────
router.get('/settings', guard('settings:read'), settings.list);
router.put('/settings', guard('settings:write'), settings.update);

// ── المستخدمون: بحث وتعمّق ─────────────────────────────────────────────────
router.get('/members/search', guard('members:read'), members.search);
router.get('/members/:userId', guard('members:read'), members.profile);

// ── التدقيق ────────────────────────────────────────────────────────────────
router.get('/audit', guard('audit:read'), analytics.auditLog);
router.get('/audit/export', guard('audit:read'), analytics.auditExport);

module.exports = router;
