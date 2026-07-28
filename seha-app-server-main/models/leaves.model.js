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
      defaultValue: 'سعودي',
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
  },

  {
    indexes: [
      { unique: true, fields: ["service_num", "national_id"] }
    ],
  }
);

module.exports = leaves;
