const { body } = require("express-validator");

exports.loginValidation = [
  body("email")
    .notEmpty()
    .withMessage("البريد الإلكتروني مطلوب")
    .isEmail()
    .withMessage("يجب أن يكون البريد الإلكتروني صالحًا")
    .isLength({ max: 191 })
    .withMessage("يجب أن يكون البريد الإلكتروني أقل من 191 حرفًا"),
  body("password")
    .notEmpty()
    .withMessage("كلمة المرور مطلوبة")
    .isString()
    .withMessage("يجب أن تكون كلمة المرور نصًا"),
];
