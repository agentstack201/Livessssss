// ───────────────────────────────────────────────────────────────────────────
// مفردات الصلاحيات — ثابتة في الكود، غير قابلة للتوسيع من اللوحة.
//
// لماذا ثابتة؟ لأن صلاحية يخترعها الأدمن من الواجهة لا يفحصها أي مسار في
// الخادم، فتبدو مفعّلة وهي بلا أثر — وهذا بالضبط «إعداد وهمي». الأدمن يركّب
// الأدوار من هذه القائمة فقط، وكل عنصر فيها مربوط بمسار حقيقي يفحصه.
//
// إضافة صلاحية جديدة = سطر هنا + استعمالها في المسار. لا شيء غيره.
// ───────────────────────────────────────────────────────────────────────────

/** كل صلاحية: المفتاح، الوصف العربي، والمجموعة التي تظهر تحتها في مُنتقي الصلاحيات. */
const PERMISSIONS = {
  // المنتجات والتسعير
  'products:read':      { group: 'المنتجات',   label: 'عرض المنتجات والأسعار' },
  'products:write':     { group: 'المنتجات',   label: 'إنشاء وتعديل المنتجات والأسعار' },
  'products:delete':    { group: 'المنتجات',   label: 'حذف المنتجات' },

  // الطلبات والمدفوعات
  'orders:read':        { group: 'الطلبات',    label: 'عرض الطلبات' },
  'orders:approve':     { group: 'الطلبات',    label: 'اعتماد الدفع وتفعيل الطلب' },
  'orders:refund':      { group: 'الطلبات',    label: 'استرداد الطلبات' },

  // الأرصدة
  'credits:read':       { group: 'الأرصدة',    label: 'عرض الأرصدة والدفتر' },
  'credits:adjust':     { group: 'الأرصدة',    label: 'تعديل رصيد المستخدمين يدوياً' },

  // الكوبونات
  'coupons:read':       { group: 'الكوبونات',  label: 'عرض الكوبونات' },
  'coupons:write':      { group: 'الكوبونات',  label: 'إنشاء وتعديل الكوبونات' },
  'coupons:delete':     { group: 'الكوبونات',  label: 'حذف الكوبونات' },

  // الإحالات
  'referrals:read':     { group: 'الإحالات',   label: 'عرض روابط الإحالة والقمع' },
  'referrals:write':    { group: 'الإحالات',   label: 'إنشاء وتعديل روابط الإحالة' },
  'referrals:moderate': { group: 'الإحالات',   label: 'اعتماد أو إلغاء مكافآت الإحالة' },

  // الحملات
  'campaigns:read':     { group: 'الحملات',    label: 'عرض الحملات' },
  'campaigns:write':    { group: 'الحملات',    label: 'إنشاء وتعديل الحملات' },
  'campaigns:delete':   { group: 'الحملات',    label: 'حذف الحملات' },

  // المكافآت
  'rewards:read':       { group: 'المكافآت',   label: 'عرض قواعد المكافآت والمنح' },
  'rewards:write':      { group: 'المكافآت',   label: 'إنشاء وتعديل قواعد المكافآت' },
  'rewards:revoke':     { group: 'المكافآت',   label: 'إلغاء مكافأة ممنوحة' },

  // الأدوار
  'roles:read':         { group: 'الصلاحيات',  label: 'عرض الأدوار' },
  'roles:write':        { group: 'الصلاحيات',  label: 'إنشاء الأدوار وإسنادها للمستخدمين' },

  // الإعدادات التشغيلية
  'settings:read':      { group: 'الإعدادات',  label: 'عرض الإعدادات التشغيلية' },
  'settings:write':     { group: 'الإعدادات',  label: 'تعديل الإعدادات التشغيلية' },

  // التحليلات والتدقيق
  'analytics:read':     { group: 'التحليلات',  label: 'عرض لوحة التحليلات' },
  'audit:read':         { group: 'التحليلات',  label: 'عرض سجل التدقيق' },

  // ملفات المستخدمين التجارية
  'members:read':       { group: 'المستخدمون', label: 'عرض الملف التجاري لأي مستخدم' },
};

const ALL_PERMISSIONS = Object.keys(PERMISSIONS);

/** يتحقّق أن كل عنصر في المصفوفة صلاحية معروفة. يُستعمل عند إنشاء/تعديل دور. */
function validatePermissionList(list) {
  if (!Array.isArray(list)) return { valid: false, unknown: [], message: 'الصلاحيات يجب أن تكون مصفوفة' };
  const unknown = list.filter((p) => !ALL_PERMISSIONS.includes(p));
  return {
    valid: unknown.length === 0,
    unknown,
    message: unknown.length ? `صلاحيات غير معروفة: ${unknown.join(', ')}` : '',
  };
}

/** الصلاحيات مجمّعة لعرضها في مُنتقي الصلاحيات في اللوحة. */
function groupedPermissions() {
  const groups = {};
  for (const [key, meta] of Object.entries(PERMISSIONS)) {
    (groups[meta.group] ||= []).push({ key, label: meta.label });
  }
  return groups;
}

module.exports = { PERMISSIONS, ALL_PERMISSIONS, validatePermissionList, groupedPermissions };
