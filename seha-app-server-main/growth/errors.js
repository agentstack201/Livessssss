// ───────────────────────────────────────────────────────────────────────────
// أخطاء الوحدة — صنف واحد يحمل رمز حالة HTTP ورمز خطأ مقروءاً.
//
// السبب: الواجهة تحتاج التمييز بين «رصيد غير كافٍ» و«كوبون منتهٍ» و«ليس لك
// صلاحية» لتعرض الرسالة الصحيحة وتقترح الإجراء الصحيح. رسالة نصّية وحدها
// تُجبر الواجهة على مطابقة نصوص، وهي تنكسر مع أول تعديل صياغة.
// ───────────────────────────────────────────────────────────────────────────

class GrowthError extends Error {
  constructor(code, message, status = 400, details = null) {
    super(message);
    this.name = 'GrowthError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const err = {
  notFound: (what = 'العنصر') => new GrowthError('NOT_FOUND', `${what} غير موجود`, 404),
  forbidden: (msg = 'ليس لديك صلاحية لهذه العملية') => new GrowthError('FORBIDDEN', msg, 403),
  validation: (msg, details) => new GrowthError('VALIDATION', msg, 422, details),
  conflict: (msg) => new GrowthError('CONFLICT', msg, 409),

  insufficientCredits: (needed, available) =>
    new GrowthError('INSUFFICIENT_CREDITS',
      `الرصيد غير كافٍ: مطلوب ${needed} والمتاح ${available}`, 422, { needed, available }),

  reasonRequired: () =>
    new GrowthError('REASON_REQUIRED', 'السبب إلزامي في هذه العملية', 422),

  limitExceeded: (msg) => new GrowthError('LIMIT_EXCEEDED', msg, 422),
  invariantViolation: (msg) => new GrowthError('INVARIANT_VIOLATION', msg, 500),
};

module.exports = { GrowthError, err };
