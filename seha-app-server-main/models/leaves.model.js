const Sequelize = require("sequelize");
const sequelize = require("../config/database");

const leaves = sequelize.define(
  "leaves",
  {
    id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      allowNull: false,
      primaryKey: true,
    },
    service_num: {
      type: Sequelize.STRING(191),
      allowNull: false,
    },
    leave_id: {
      type: Sequelize.STRING(191),
      allowNull: false,
    },
    admission_date_en: {
      type: Sequelize.STRING(191),
      allowNull: false,
    },
    admission_date_ar: {
      type: Sequelize.STRING(191),
      allowNull: false,
    },
    discharge_date_en: {
      type: Sequelize.STRING(191),
      allowNull: false,
    },
    discharge_date_ar: {
      type: Sequelize.STRING(191),
      allowNull: false,
    },
    issue_date: {
      type: Sequelize.STRING(191),
      allowNull: false,
    },
    name_en: {
      type: Sequelize.STRING(191),
      allowNull: false,
    },
    name_ar: {
      type: Sequelize.STRING(191),
      allowNull: false,
    },
    national_id: {
      type: Sequelize.STRING(191),
      allowNull: false,
    },
    phone: {
      type: Sequelize.STRING(30),
      allowNull: true,
      defaultValue: '',
      comment: 'رقم جوال الزبون لإرسال التقرير عبر واتساب',
    },
    employer_en: {
      type: Sequelize.STRING(191),
      allowNull: true,
      defaultValue: '',
    },
    employer_ar: {
      type: Sequelize.STRING(191),
      allowNull: true,
      defaultValue: '',
    },
    physician_name_en: {
      type: Sequelize.STRING(191),
      allowNull: false,
    },
    physician_name_ar: {
      type: Sequelize.STRING(191),
      allowNull: false,
    },
    position_en: {
      type: Sequelize.STRING(191),
      allowNull: false,
    },
    position_ar: {
      type: Sequelize.STRING(191),
      allowNull: false,
    },
    nationality: {
      type: Sequelize.STRING(191),
      allowNull: true,
      defaultValue: 'السعودية',
    },
    hospital_name_en: {
      type: Sequelize.STRING(191),
      allowNull: true,
      defaultValue: 'AL NOOR SPECIALIST HOSPITAL',
    },
    hospital_name_ar: {
      type: Sequelize.STRING(191),
      allowNull: true,
      defaultValue: 'مستشفى النور التخصصي',
    },
    license_number: {
      type: Sequelize.STRING(191),
      allowNull: true,
      defaultValue: '1410845906',
    },
    show_license_number: {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: true,
      comment: 'إظهار أو إخفاء رقم الترخيص في PDF',
    },
    report_time: {
      type: Sequelize.STRING(191),
      allowNull: true,
      comment: 'وقت إصدار التقرير (يدوي أو تلقائي)',
    },
    report_date: {
      type: Sequelize.STRING(191),
      allowNull: true,
      comment: 'تاريخ إصدار التقرير (يدوي أو تلقائي)',
    },
    footer_logo: {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'صورة شعار المرفق في تذييل التقرير (Base64 أو رابط)',
    },
    // ── نوع المستند وحقول قالب «مشهد مراجعة لمرافق» ─────────────────────────
    // كل الحقول التالية اختيارية ولا تؤثر على الإجازة المرضية الحالية إطلاقاً:
    // السجلات القديمة تبقى document_type = 'sick_leave' وتُطبع كما هي.
    document_type: {
      type: Sequelize.STRING(32),
      allowNull: true,
      defaultValue: 'sick_leave',
      comment: "نوع المستند: sick_leave (إجازة مرضية) أو companion_visit (مشهد مراجعة لمرافق)",
    },
    admission_time: {
      type: Sequelize.STRING(32),
      allowNull: true,
      defaultValue: '',
      comment: 'وقت الدخول بصيغة 12 ساعة (مشهد مراجعة لمرافق)',
    },
    discharge_time: {
      type: Sequelize.STRING(32),
      allowNull: true,
      defaultValue: '',
      comment: 'وقت الخروج بصيغة 12 ساعة (مشهد مراجعة لمرافق)',
    },
    relation_en: {
      type: Sequelize.STRING(191),
      allowNull: true,
      defaultValue: '',
      comment: 'صلة القرابة بالإنجليزية (مشهد مراجعة لمرافق)',
    },
    relation_ar: {
      type: Sequelize.STRING(191),
      allowNull: true,
      defaultValue: '',
      comment: 'صلة القرابة بالعربية (مشهد مراجعة لمرافق)',
    },
    visit_type_en: {
      type: Sequelize.STRING(191),
      allowNull: true,
      defaultValue: '',
      comment: 'نوع الزيارة بالإنجليزية (مشهد مراجعة لمرافق)',
    },
    visit_type_ar: {
      type: Sequelize.STRING(191),
      allowNull: true,
      defaultValue: '',
      comment: 'نوع الزيارة بالعربية (مشهد مراجعة لمرافق)',
    },
    created_by: {
      type: Sequelize.STRING(191),
      allowNull: true,
      comment: 'اسم المستخدم الذي أنشأ السجل (نسخة نصية)',
    },
    user_id: {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'رقم المستخدم المرتبط من جدول المستخدمين',
    },
    // ── QR اختياري وطريقة التاريخ (اختيارية) ─────────────────────────────────
    // كلا الحقلين اختياريان بقيم افتراضية تحافظ على السلوك الحالي: كل سجل
    // قديم بلا قيمة يستمر بإظهار الـ QR (add_qr) ويحسب مدة الإجازة من
    // الفرق بين تاريخي الدخول والخروج كما كان دائماً (date_mode = 'actual').
    add_qr: {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: true,
      comment: 'إظهار أو إخفاء رمز الـ QR في PDF',
    },
    date_mode: {
      type: Sequelize.STRING(20),
      allowNull: true,
      defaultValue: 'actual',
      comment: "طريقة التاريخ: actual (الفعلي) أو issue_date (يبدأ من تاريخ الإصدار)",
    },
    leave_days: {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'مدة الإجازة كقيمة مستقلة — تُستخدم فقط عندما date_mode = issue_date',
    },
  },

  {
    indexes: [
      { unique: true, fields: ["service_num", "national_id"] }
    ],
  }
);

module.exports = leaves;
