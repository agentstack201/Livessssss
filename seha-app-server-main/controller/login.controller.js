const bycrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const Permission = require("../models/permission.model");

module.exports.login = async (req, res, next) => {
  try {
    let user = await User.findOne({ 
      where: { email: req.body.email },
      include: [{
        model: Permission,
        as: 'permissions'
      }]
    });
    if (user) {
      bycrypt
        .compare(req.body.password, user.password)
        .then(async (isEqual) => {
          if (!isEqual) {
            res.status(400).json({
              status_code: 400,
              data: null,
              message: `خطأ فى البريد الإلكترونى او كلمة السر`,
            });
          } else {
            let token;
            let expire_date = "3h";
            token = jwt.sign(
              {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
              },
              process.env.JWT_SECRET || process.env.secret,
              { expiresIn: process.env.JWT_EXPIRES_IN || '3h' }
            );
            return res.status(200).json({
              status_code: 200,
              data: {
                user: {
                  name: user.name,
                  email: user.email,
                  role: user.role,
                  permissions: user.permissions
                },
                token,
              },
              message: `you are login successfully`,
            });
          }
        });
    } else {
      res.status(400).json({
        status_code: 400,
        data: null,
        message: `خطأ فى البريد الإلكترونى او كلمة السر`,
      });
    }
  } catch (error) {
    res.status(500).json({
      status_code: 500,
      data: null,
      message: error.message,
    });
  }
};
