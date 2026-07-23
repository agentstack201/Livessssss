const { body } = require("express-validator");

exports.addCountriesValidation = [
  body("countries")
    .notEmpty()
    .withMessage("حقل الدول مطلوب")
    .isArray()
    .withMessage("الدول يجب أن تكون مصفوفة"),
  body("countries.*.en")
    .notEmpty()
    .withMessage("يجب أن يحتوي كل كائن دولة على مفتاح en وقيمة")
    .isString()
    .withMessage("en يجب أن يكون نصًا")
    .isLength({ max: 191 })
    .withMessage("en يجب أن يكون أقل من 191 حرفًا"),
  body("countries.*.ar")
    .notEmpty()
    .withMessage("يجب أن يحتوي كل كائن دولة على مفتاح ar وقيمة")
    .isString()
    .withMessage("ar يجب أن يكون نصًا")
    .isLength({ max: 191 })
    .withMessage("ar يجب أن يكون أقل من 191 حرفًا"),
];
