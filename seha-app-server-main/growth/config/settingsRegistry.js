// ───────────────────────────────────────────────────────────────────────────
// سجل الإعدادات — المفاتيح مُعلنة هنا، والقيم تعيش في PostgreSQL.
//
// القاعدة التي يفرضها هذا الملف: لا يوجد مفتاح إعداد إلا وله سطر هنا، ولكل
// مفتاح نوع ونطاق ومكان استعمال حقيقي في الخادم. مفتاح يظهر في اللوحة ولا
// يقرأه أي كود هو «إعداد وهمي» — يخدع المشغّل ويجعله يظن أنه غيّر سلوكاً.
// لذلك عمود `usedBy` إلزامي في كل سطر: يسمّي الخدمة التي تقرأ المفتاح فعلاً.
//
// public: true  ⇐ يخرج على مسار عام بلا مصادقة (رقم الدعم، تعليمات الدفع)
//                 لأن واجهة العميل تحتاجه قبل تسجيل الدخول.
// public: false ⇐ لا يغادر اللوحة إلا لمن يملك settings:read.
// ───────────────────────────────────────────────────────────────────────────

const INV = require('./invariants');

/**
 * كل مفتاح:
 *   type      نوع القيمة — يُفرض عند الكتابة، وتُحوَّل القيمة إليه عند القراءة
 *   default   ما يُرجَع قبل أن يكتب الأدمن أي شيء (لا يوجد صف في الجدول بعد)
 *   public    هل يُقرأ بلا مصادقة
 *   group     تبويب العرض في صفحة الإعدادات
 *   usedBy    الخدمة التي تستهلك القيمة فعلياً — توثيق مُلزِم ضد الإعدادات الوهمية
 *   min/max   نطاق مسموح للأرقام (يُقصّ عنده)
 */
const REGISTRY = {
  // ── دعم العملاء (عام) ───────────────────────────────────────────────────
  'support.whatsapp_number': {
    type: 'string', default: '', public: true, group: 'support',
    label: 'رقم واتساب الدعم', maxLength: 20,
    hint: 'بصيغة دولية بدون + مثال: 966500000000',
    usedBy: 'واجهة العميل — زر التواصل عبر واتساب',
    pattern: /^[0-9]{0,20}$/,
  },
  'support.whatsapp_message': {
    type: 'string', default: 'مرحباً، أحتاج مساعدة', public: true, group: 'support',
    label: 'نص رسالة واتساب الافتراضية', maxLength: 300,
    usedBy: 'واجهة العميل — نص مُعبّأ مسبقاً في زر واتساب',
  },
  'support.email': {
    type: 'string', default: '', public: true, group: 'support',
    label: 'بريد الدعم', maxLength: 191,
    usedBy: 'واجهة العميل — تذييل صفحة الدعم',
  },

  // ── تعليمات الدفع (عام) ─────────────────────────────────────────────────
  'payment.instructions_ar': {
    type: 'text', default: '', public: true, group: 'payment',
    label: 'تعليمات الدفع (عربي)', maxLength: 4000,
    hint: 'تظهر للعميل بعد إنشاء الطلب وقبل اعتماد الدفع',
    usedBy: 'واجهة العميل — شاشة الطلب بعد الإنشاء',
  },
  'payment.bank_name': {
    type: 'string', default: '', public: true, group: 'payment',
    label: 'اسم البنك', maxLength: 191,
    usedBy: 'واجهة العميل — تفاصيل التحويل',
  },
  'payment.bank_iban': {
    type: 'string', default: '', public: true, group: 'payment',
    label: 'رقم الآيبان', maxLength: 60,
    usedBy: 'واجهة العميل — تفاصيل التحويل',
  },
  'payment.bank_account_name': {
    type: 'string', default: '', public: true, group: 'payment',
    label: 'اسم صاحب الحساب', maxLength: 191,
    usedBy: 'واجهة العميل — تفاصيل التحويل',
  },
  'payment.currency': {
    type: 'string', default: 'SAR', public: true, group: 'payment',
    label: 'العملة', maxLength: 3,
    usedBy: 'خدمة الطلبات — عملة الطلب الافتراضية',
  },

  // ── اقتصاد الأرصدة ──────────────────────────────────────────────────────
  'credits.cost_per_document': {
    type: 'integer', default: 1, public: true, group: 'credits',
    label: 'تكلفة إصدار مستند بالأرصدة',
    min: INV.RANGES.creditCostPerDocument.min, max: INV.RANGES.creditCostPerDocument.max,
    usedBy: 'خدمة الأرصدة — الخصم عند إصدار مستند',
  },
  'credits.enforce_balance': {
    type: 'boolean', default: false, public: false, group: 'credits',
    label: 'منع الإصدار عند نفاد الرصيد',
    hint: 'معطّل = يُخصم الرصيد ويُسجَّل الاستخدام لكن النفاد لا يمنع الإصدار. '
        + 'فعّله حين تصير الأرصدة شرطاً فعلياً للخدمة لا مجرد عدّاد.',
    usedBy: 'hooks.canCreateDocument — فحص قبل إنشاء المستند في leaves.controller',
  },
  'credits.signup_bonus': {
    type: 'integer', default: 0, public: false, group: 'credits',
    label: 'رصيد ترحيبي عند التسجيل', min: 0, max: 10000,
    usedBy: 'خدمة الملف التجاري — إنشاء ملف مستخدم جديد',
  },
  'credits.expire_plan_credits': {
    type: 'boolean', default: false, public: false, group: 'credits',
    label: 'إنهاء أرصدة الاشتراك بعد انقضائه',
    hint: 'أرصدة حزم الشراء لا تنتهي أبداً — العميل دفع ثمنها ولم يستأجرها',
    usedBy: 'credit.service.expireStale — مسح يُشغَّل من صفحة الأرصدة',
  },
  'credits.expiry_grace_days': {
    type: 'integer', default: 7, public: false, group: 'credits',
    label: 'أيام السماح قبل إنهاء الأرصدة', min: 0, max: 90,
    hint: 'تُحتسب من تاريخ انقضاء الاشتراك لا من تاريخ المنح',
    usedBy: 'credit.service.expireStale — مسح يُشغَّل من صفحة الأرصدة',
  },

  // ── الإحالة ─────────────────────────────────────────────────────────────
  'referral.enabled': {
    type: 'boolean', default: true, public: true, group: 'referral',
    label: 'تفعيل نظام الإحالة',
    usedBy: 'خدمة الإحالة — بوابة كل عمليات التتبع والدفع',
  },
  'referral.attribution_window_days': {
    type: 'integer', default: 30, public: false, group: 'referral',
    label: 'نافذة إسناد الإحالة (أيام)',
    min: INV.RANGES.attributionWindowDays.min, max: INV.RANGES.attributionWindowDays.max,
    usedBy: 'خدمة الإحالة — ربط التسجيل بالنقرة',
  },
  'referral.meaningful_action_count': {
    type: 'integer', default: 3, public: false, group: 'referral',
    label: 'عدد المستندات المُعتبَر «فعلاً جوهرياً»',
    min: INV.RANGES.meaningfulActionCount.min, max: INV.RANGES.meaningfulActionCount.max,
    usedBy: 'خدمة الإحالة — ترقية المرحلة إلى meaningful_action',
  },
  'referral.min_purchase_for_payout': {
    type: 'decimal', default: 0, public: false, group: 'referral',
    label: 'أدنى قيمة شراء تُفعّل دفعة المُحيل', min: 0, max: 100000,
    usedBy: 'خدمة الإحالة — بوابة مرحلة first_purchase',
  },
  'referral.clawback_window_days': {
    type: 'integer', default: 14, public: false, group: 'referral',
    label: 'نافذة استرجاع المكافأة بعد الاسترداد (أيام)',
    min: INV.RANGES.clawbackWindowDays.min, max: INV.RANGES.clawbackWindowDays.max,
    usedBy: 'خدمة الإحالة — الاسترجاع عند استرداد الطلب',
  },
  'referral.min_referrer_account_age_days': {
    type: 'integer', default: 0, public: false, group: 'referral',
    label: 'أدنى عمر لحساب المُحيل ليُدفع له (أيام)', min: 0, max: 365,
    usedBy: 'خدمة الاحتيال — إشارة عمر الحساب',
  },

  // ── كشف الاحتيال ────────────────────────────────────────────────────────
  'fraud.medium_threshold': {
    type: 'integer', default: 30, public: false, group: 'fraud',
    label: 'عتبة المخاطرة المتوسطة',
    min: INV.RANGES.fraudMediumThreshold.min, max: INV.RANGES.fraudMediumThreshold.max,
    hint: 'عندها تُعلَّق دفعة المُحيل للمراجعة ويُدفع للمُحال إليه',
    usedBy: 'خدمة الاحتيال — تصنيف النطاق',
  },
  'fraud.high_threshold': {
    type: 'integer', default: 70, public: false, group: 'fraud',
    label: 'عتبة المخاطرة العالية',
    min: INV.RANGES.fraudHighThreshold.min, max: INV.RANGES.fraudHighThreshold.max,
    hint: 'عندها تُعلَّق دفعتا الطرفين وتتطلبان موافقة صريحة',
    usedBy: 'خدمة الاحتيال — تصنيف النطاق',
  },
  'fraud.referral_velocity_per_day': {
    type: 'integer', default: 10, public: false, group: 'fraud',
    label: 'أقصى إحالات لمُحيل واحد خلال 24 ساعة قبل الاشتباه',
    min: INV.RANGES.referralVelocityPerDay.min, max: INV.RANGES.referralVelocityPerDay.max,
    usedBy: 'خدمة الاحتيال — إشارة السرعة',
  },
  'fraud.auto_release_days': {
    type: 'integer', default: 7, public: false, group: 'fraud',
    label: 'أيام الإفراج عن دفعة متوسطة المخاطر', min: 0, max: 90,
    hint: 'يُشغَّل الإفراج من طابور المراجعة في صفحة الإحالات',
    usedBy: 'referral.service.autoReleaseExpiredHolds — زر في طابور المراجعة',
  },

  // ── التشغيل ─────────────────────────────────────────────────────────────
  'ops.auto_approve_orders': {
    type: 'boolean', default: false, public: false, group: 'ops',
    label: 'اعتماد الطلبات تلقائياً بدون مراجعة',
    hint: 'اتركه معطّلاً ما دام الدفع يدوياً',
    usedBy: 'خدمة الطلبات — إنشاء الطلب',
  },
  'ops.new_signups_enabled': {
    type: 'boolean', default: true, public: true, group: 'ops',
    label: 'قبول تسجيلات جديدة',
    usedBy: 'واجهة العميل — إظهار زر التسجيل',
  },
  'ops.storefront_notice': {
    type: 'text', default: '', public: true, group: 'ops',
    label: 'شريط إعلان أعلى صفحة الباقات', maxLength: 500,
    usedBy: 'واجهة العميل — شريط الإعلان',
  },
};

const ALL_KEYS = Object.keys(REGISTRY);
const PUBLIC_KEYS = ALL_KEYS.filter((k) => REGISTRY[k].public);

/** يحوّل قيمة نصية مخزّنة إلى نوعها المُعلن. الجدول يخزّن نصاً دائماً. */
function castOut(key, raw) {
  const meta = REGISTRY[key];
  if (!meta) return null;
  if (raw === null || raw === undefined) return meta.default;
  switch (meta.type) {
    case 'integer': {
      const n = parseInt(raw, 10);
      return Number.isFinite(n) ? n : meta.default;
    }
    case 'decimal': {
      const n = parseFloat(raw);
      return Number.isFinite(n) ? n : meta.default;
    }
    case 'boolean':
      return raw === true || raw === 'true' || raw === '1';
    case 'json':
      try { return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return meta.default; }
    default:
      return String(raw);
  }
}

/**
 * يتحقّق من قيمة واردة من اللوحة ويعيدها جاهزة للتخزين نصاً.
 * يقصّ الأرقام عند النطاق المُعلن بدل رفضها، فلا يستطيع إدخالٌ خاطئ تجاوز الحد.
 */
function validateIn(key, value) {
  const meta = REGISTRY[key];
  if (!meta) return { ok: false, message: `مفتاح إعداد غير معروف: ${key}` };

  switch (meta.type) {
    case 'integer':
    case 'decimal': {
      const n = meta.type === 'integer' ? parseInt(value, 10) : parseFloat(value);
      if (!Number.isFinite(n)) return { ok: false, message: `${meta.label}: القيمة يجب أن تكون رقماً` };
      let v = n;
      if (meta.min !== undefined && v < meta.min) v = meta.min;
      if (meta.max !== undefined && v > meta.max) v = meta.max;
      return { ok: true, stored: String(v), clamped: v !== n, value: v };
    }
    case 'boolean': {
      const b = value === true || value === 'true' || value === 1 || value === '1';
      return { ok: true, stored: String(b), value: b };
    }
    case 'json': {
      try {
        const obj = typeof value === 'string' ? JSON.parse(value) : value;
        return { ok: true, stored: JSON.stringify(obj), value: obj };
      } catch {
        return { ok: false, message: `${meta.label}: JSON غير صالح` };
      }
    }
    default: {
      const s = value === null || value === undefined ? '' : String(value);
      if (meta.maxLength && s.length > meta.maxLength) {
        return { ok: false, message: `${meta.label}: الحد الأقصى ${meta.maxLength} حرفاً` };
      }
      if (meta.pattern && !meta.pattern.test(s)) {
        return { ok: false, message: `${meta.label}: الصيغة غير صحيحة` };
      }
      return { ok: true, stored: s, value: s };
    }
  }
}

/** وصف المفاتيح للوحة — بدون القيم، فقط البنية والحدود والتلميحات. */
function describe(includePrivate = true) {
  const out = {};
  for (const [key, m] of Object.entries(REGISTRY)) {
    if (!includePrivate && !m.public) continue;
    out[key] = {
      key, type: m.type, group: m.group, label: m.label,
      hint: m.hint || '', min: m.min, max: m.max,
      maxLength: m.maxLength, public: !!m.public, usedBy: m.usedBy,
      default: m.default,
    };
  }
  return out;
}

module.exports = { REGISTRY, ALL_KEYS, PUBLIC_KEYS, castOut, validateIn, describe };
