// ───────────────────────────────────────────────────────────────────────────
// عميل واجهة وحدة النمو.
//
// قاعدة صارمة: لا قيمة تجارية مكتوبة في الواجهة. الأسعار والمكافآت والحدود
// وأرقام الدعم كلها تأتي من الخادم عبر هذا الملف. أي رقم يُكتب في مكوّن React
// سيفترق عن قاعدة البيانات في أول تعديل من اللوحة، فتعرض الواجهة رقماً
// والخادم يطبّق آخر.
// ───────────────────────────────────────────────────────────────────────────

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
const BASE = `${API_BASE_URL}/growth`

const token = () => localStorage.getItem('token')

/** خطأ يحمل رمز الخادم ليميّز الواجهة بين نقص رصيد ونقص صلاحية. */
export class ApiError extends Error {
  constructor(message, code, status, details) {
    super(message)
    this.code = code
    this.status = status
    this.details = details
  }
}

async function request(path, { method = 'GET', body, auth = true, raw = false } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (auth && token()) headers.Authorization = `Bearer ${token()}`

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (raw) return res

  let payload = null
  try {
    payload = await res.json()
  } catch {
    throw new ApiError('تعذّر قراءة رد الخادم', 'PARSE_ERROR', res.status)
  }

  if (!res.ok || payload?.success === false) {
    throw new ApiError(
      payload?.message || 'حدث خطأ أثناء تنفيذ العملية',
      payload?.code || 'UNKNOWN',
      res.status,
      payload?.details
    )
  }

  return payload.data
}

const qs = (params = {}) => {
  const clean = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  return clean.length ? `?${new URLSearchParams(clean)}` : ''
}

export const api = {
  // ── هويّة وصلاحيات ──────────────────────────────────────────────────────
  myPermissions: () => request('/me/permissions'),

  // ── تحليلات ─────────────────────────────────────────────────────────────
  overview: (days = 30) => request(`/analytics/overview${qs({ days })}`),
  alerts: () => request('/analytics/alerts'),
  revenueAnalytics: (days = 30) => request(`/analytics/revenue${qs({ days })}`),
  growthAnalytics: () => request('/analytics/growth'),
  economics: (days = 30) => request(`/analytics/economics${qs({ days })}`),

  // ── منتجات ──────────────────────────────────────────────────────────────
  products: (params) => request(`/products${qs(params)}`),
  createProduct: (body) => request('/products', { method: 'POST', body }),
  updateProduct: (id, body) => request(`/products/${id}`, { method: 'PUT', body }),
  deleteProduct: (id, reason) => request(`/products/${id}`, { method: 'DELETE', body: { reason } }),
  reorderProducts: (order) => request('/products/reorder', { method: 'PUT', body: { order } }),

  // ── طلبات ───────────────────────────────────────────────────────────────
  orders: (params) => request(`/orders${qs(params)}`),
  order: (id) => request(`/orders/${id}`),
  approveOrder: (id, paymentReference) =>
    request(`/orders/${id}/approve`, { method: 'POST', body: { payment_reference: paymentReference } }),
  refundOrder: (id, reason) => request(`/orders/${id}/refund`, { method: 'POST', body: { reason } }),
  cancelOrder: (id, reason) => request(`/orders/${id}/cancel`, { method: 'POST', body: { reason } }),
  createOrder: (body) => request('/orders', { method: 'POST', body }),

  // ── أرصدة ───────────────────────────────────────────────────────────────
  ledger: (params) => request(`/credits/ledger${qs(params)}`),
  creditSummary: (days = 30) => request(`/credits/summary${qs({ days })}`),
  lookupUser: (q) => request(`/credits/lookup${qs({ q })}`),
  reconcile: () => request('/credits/reconcile'),
  adjustCredits: (body) => request('/credits/adjust', { method: 'POST', body }),
  expireSweep: (dryRun) =>
    request(`/credits/expire-sweep${dryRun ? '?dry_run=1' : ''}`, { method: 'POST', body: {} }),
  userHistory: (userId) => request(`/credits/${userId}/history`),

  // ── كوبونات ─────────────────────────────────────────────────────────────
  coupons: (params) => request(`/coupons${qs(params)}`),
  coupon: (id) => request(`/coupons/${id}`),
  createCoupon: (body) => request('/coupons', { method: 'POST', body }),
  updateCoupon: (id, body) => request(`/coupons/${id}`, { method: 'PUT', body }),
  deleteCoupon: (id, reason) => request(`/coupons/${id}`, { method: 'DELETE', body: { reason } }),
  couponRedemptions: (id) => request(`/coupons/${id}/redemptions`),

  // ── إحالات ──────────────────────────────────────────────────────────────
  referralLinks: (params) => request(`/referrals/links${qs(params)}`),
  createReferralLink: (body) => request('/referrals/links', { method: 'POST', body }),
  updateReferralLink: (id, body) => request(`/referrals/links/${id}`, { method: 'PUT', body }),
  referralFunnel: (params) => request(`/referrals/funnel${qs(params)}`),
  referralEvents: (params) => request(`/referrals/events${qs(params)}`),
  releaseGrant: (grantId) => request(`/referrals/grants/${grantId}/release`, { method: 'POST' }),
  releaseExpiredHolds: () => request('/referrals/release-expired', { method: 'POST' }),
  revokeReferralGrant: (grantId, reason) =>
    request(`/referrals/grants/${grantId}/revoke`, { method: 'POST', body: { reason } }),

  // ── حملات ───────────────────────────────────────────────────────────────
  campaigns: (params) => request(`/campaigns${qs(params)}`),
  campaign: (id) => request(`/campaigns/${id}`),
  createCampaign: (body) => request('/campaigns', { method: 'POST', body }),
  updateCampaign: (id, body) => request(`/campaigns/${id}`, { method: 'PUT', body }),
  deleteCampaign: (id, reason) => request(`/campaigns/${id}`, { method: 'DELETE', body: { reason } }),

  // ── مكافآت ──────────────────────────────────────────────────────────────
  rewardEventTypes: () => request('/rewards/event-types'),
  rewardRules: (params) => request(`/rewards/rules${qs(params)}`),
  createRewardRule: (body) => request('/rewards/rules', { method: 'POST', body }),
  updateRewardRule: (id, body) => request(`/rewards/rules/${id}`, { method: 'PUT', body }),
  deleteRewardRule: (id, reason) => request(`/rewards/rules/${id}`, { method: 'DELETE', body: { reason } }),
  rewardGrants: (params) => request(`/rewards/grants${qs(params)}`),
  rewardEffectiveness: () => request('/rewards/effectiveness'),
  revokeRewardGrant: (grantId, reason) =>
    request(`/rewards/grants/${grantId}/revoke`, { method: 'POST', body: { reason } }),

  // ── أدوار ───────────────────────────────────────────────────────────────
  permissionVocabulary: () => request('/roles/vocabulary'),
  roles: () => request('/roles'),
  teamMembers: () => request('/roles/members'),
  createRole: (body) => request('/roles', { method: 'POST', body }),
  updateRole: (id, body) => request(`/roles/${id}`, { method: 'PUT', body }),
  deleteRole: (id) => request(`/roles/${id}`, { method: 'DELETE' }),
  assignRole: (userId, roleId) =>
    request('/roles/assign', { method: 'POST', body: { user_id: userId, role_id: roleId } }),
  revokeRole: (userId, roleId) =>
    request('/roles/revoke', { method: 'POST', body: { user_id: userId, role_id: roleId } }),

  // ── إعدادات ─────────────────────────────────────────────────────────────
  settings: () => request('/settings'),
  updateSettings: (settings, reason) =>
    request('/settings', { method: 'PUT', body: { settings, reason } }),
  publicSettings: () => request('/public/settings', { auth: false }),

  // ── مستخدمون ────────────────────────────────────────────────────────────
  searchMembers: (q) => request(`/members/search${qs({ q })}`),
  memberProfile: (userId) => request(`/members/${userId}`),

  // ── تدقيق ───────────────────────────────────────────────────────────────
  auditLog: (params) => request(`/audit${qs(params)}`),
  auditExportUrl: (params) => `${BASE}/audit/export${qs(params)}`,

  // ── واجهة العميل ────────────────────────────────────────────────────────
  storefront: () => request('/public/products', { auth: false }),
  validateCoupon: (body) => request('/public/coupons/validate', { method: 'POST', body, auth: false }),
  myProfile: () => request('/me'),
  myCredits: () => request('/me/credits'),
  myOrders: () => request('/me/orders'),
  myReferral: () => request('/me/referral'),
  placeOrder: (body) => request('/me/orders', { method: 'POST', body }),
  submitPaymentProof: (orderId, body) =>
    request(`/me/orders/${orderId}/payment`, { method: 'POST', body }),
  trackReferral: (code) => request(`/r/${encodeURIComponent(code)}`, { auth: false }),
}

/** تنزيل ملف محمي: الرابط المباشر لا يحمل رمز الدخول، فنجلبه ثم نحفظه. */
export async function downloadAudit(params = {}) {
  const res = await fetch(api.auditExportUrl(params), {
    headers: { Authorization: `Bearer ${token()}` },
  })
  if (!res.ok) throw new ApiError('تعذّر تصدير السجل', 'EXPORT_FAILED', res.status)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `growth-audit-${Date.now()}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export const toast = (message, type = 'info') => {
  if (typeof window !== 'undefined' && window.showToast) window.showToast(message, type)
}
