const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  let token, decoded;
  try {
    const authHeader = req.get("Authorization");
    if (!authHeader) {
      // No credentials: fail closed and stop (return prevents a second response).
      return res.status(401).json({
        status_code: 401,
        data: null,
        message: "You should register first",
      });
    }
    token = authHeader.split(" ")[1];
    decoded = jwt.verify(token, process.env.JWT_SECRET || process.env.secret);
    req.id = decoded.id;
    req.name = decoded.name;
    req.email = decoded.email;
    req.avatar = decoded.avatar;
    req.role = decoded.role;
    // إضافة كائن المستخدم للاتساق
    req.user = {
      id: decoded.id,
      name: decoded.name,
      email: decoded.email,
      role: decoded.role
    };
  } catch (error) {
    error.status = 401;
    error.message = "You are not authorized to access this resource";
    // next(error);
    res.status(401).json({
      status_code: 401,
      data: null,
      message: error.message,
    });
  }
  if (decoded !== undefined) {
    next();
  }
};
