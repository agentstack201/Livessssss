const { body, check } = require("express-validator");
const leaves = require("../models/leaves.model");
const Country = require("../models/countries.model");

exports.addNewLeavesValidation = [
  body("service_num")
    .notEmpty()
    .withMessage("رقم الخدمة مطلوب")
    .isString()
    .withMessage("رقم الخدمة يجب أن يكون نصًا")
    .isLength({ max: 191 })
    .withMessage("رقم الخدمة يجب أن يكون أقل من 191 حرفًا"),

  body("leave_id")
    .notEmpty()
    .withMessage("رمز الاجازة مطلوب")
    .isString()
    .withMessage("رمز الاجازة يجب أن يكون نصًا")
    .isLength({ max: 191 })
    .withMessage("رمز الاجازة يجب أن يكون أقل من 191 حرفًا"),

  body("admission_date_en")
    .notEmpty()
    .withMessage("تاريخ الدخول مطلوب")
    .isString()
    .withMessage("تاريخ الدخول يجب أن يكون نصًا")
    .isLength({ max: 191 })
    .withMessage("تاريخ الدخول يجب أن يكون أقل من 191 حرفًا"),

  body("discharge_date_en")
    .notEmpty()
    .withMessage("تاريخ الخروج مطلوب")
    .isString()
    .withMessage("تاريخ الخروج يجب أن يكون نصًا")
    .isLength({ max: 191 })
    .withMessage("تاريخ الخروج يجب أن يكون أقل من 191 حرفًا"),

  body("issue_date")
    .notEmpty()
    .withMessage("تاريخ إصدار التقرير مطلوب")
    .isString()
    .withMessage("تاريخ إصدار التقرير يجب أن يكون نصًا")
    .isLength({ max: 191 })
    .withMessage("تاريخ إصدار التقرير يجب أن يكون أقل من 191 حرفًا"),

  body("name_en")
    .notEmpty()
    .withMessage("الإسم مطلوب")
    .isString()
    .withMessage("الإسم يجب أن يكون نصًا")
    .isLength({ max: 191 })
    .withMessage("الإسم يجب أن يكون أقل من 191 حرفًا"),

  body("name_ar")
    .notEmpty()
    .withMessage("الإسم باللغة العربية مطلوب")
    .isString()
    .withMessage("الإسم باللغة العربية يجب أن يكون نصًا")
    .isLength({ max: 191 })
    .withMessage("الإسم باللغة العربية يجب أن يكون أقل من 191 حرفًا"),

  body("national_id").notEmpty().withMessage("national_id مطلوب"),
  // .isString()
  // .withMessage("national_id يجب أن يكون نصًا")
  // .isLength({ max: 191 })
  // .withMessage("national_id يجب أن يكون أقل من 191 حرفًا"),

  body("phone")
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage("رقم الجوال يجب أن يكون نصًا")
    .isLength({ max: 30 })
    .withMessage("رقم الجوال يجب أن يكون أقل من 30 حرفًا"),

  body("employer_en")
    .optional()
    .isString()
    .withMessage("جهة العمل   يجب أن يكون نصًا")
    .isLength({ max: 191 })
    .withMessage("جهة العمل   يجب أن يكون أقل من 191 حرفًا"),

  body("employer_ar")
    .optional()
    .isString()
    .withMessage("جهة العمل باللغة العربية يجب أن يكون نصًا")
    .isLength({ max: 191 })
    .withMessage("جهة العمل باللغة العربية يجب أن يكون أقل من 191 حرفًا"),

  body("physician_name_en")
    .notEmpty()
    .withMessage(" مطلوب إسم الطبيب المعالج")
    .isString()
    .withMessage("إسم الطبيب المعالج يجب أن يكون نصًا")
    .isLength({ max: 191 })
    .withMessage("إسم الطبيب المعالج أن يكون أقل من 191 حرفًا"),

  body("physician_name_ar")
    .notEmpty()
    .withMessage("اسم الطبيب المعالج باللغة العربية مطلوب")
    .isString()
    .withMessage("اسم الطبيب المعالج باللغة العربية يجب أن يكون نصًا")
    .isLength({ max: 191 })
    .withMessage(
      "اسم الطبيب المعالج باللغة العربية يجب أن يكون أقل من 191 حرفًا"
    ),

  body("position_en")
    .notEmpty()
    .withMessage("المسمى الوظيفى مطلوب")
    .isString()
    .withMessage("المسمى الوظيفى يجب أن يكون نصًا")
    .isLength({ max: 191 })
    .withMessage("المسمى الوظيفى يجب أن يكون أقل من 191 حرفًا"),

  body("position_ar")
    .notEmpty()
    .withMessage("المسمى الوظيفى باللغة العربية مطلوب")
    .isString()
    .withMessage("المسمى الوظيفى باللغة العربية يجب أن يكون نصًا")
    .isLength({ max: 191 })
    .withMessage("المسمى الوظيفى باللغة العربية يجب أن يكون أقل من 191 حرفًا"),

  body("countryId")
    .optional()
    .isInt()
    .withMessage("countryId يجب أن يكون عددًا صحيحًا"),
  // تم تعطيل التحقق من جدول الدول - نستخدم nationality كنص
  // check("countryId").custom((value, req) => {
  //   return Country.findOne({ where: { id: value } }).then((country) => {
  //     if (!country) {
  //       return Promise.reject("لم يتم العثور على countryId!");
  //     }
  //   });
  // }),
];

exports.validateGetLeaveById = [
  body("leave_id")
    .notEmpty()
    .withMessage("رمز الأجازة مطلوب")
    .isString()
    .withMessage("رمز الأجازة يجب أن يكون نصًا")
    .isLength({ max: 191 })
    .withMessage("رمز الأجازة يجب أن يكون أقل من 191 حرفًا"),
  body("national_id")
    .notEmpty()
    .withMessage("الرقم القومى مطلوب")
    .isInt()
    .withMessage("الرقم القومى يجب أن يكون رقمًا")
    .isLength({ max: 191 })
    .withMessage("الرقم القومى يجب أن يكون أقل من 191 حرفًا"),
];
