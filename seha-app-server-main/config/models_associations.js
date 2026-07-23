const User = require("../models/user.model.js");
const leaves = require("../models/leaves.model.js");
const countries = require("../models/countries.model.js");
const Permission = require("../models/permission.model.js");
const Media = require("../models/media.model.js");
const Setting = require("../models/settings.model.js");
const Doctor = require("../models/doctor.model.js");
const Hospital = require("../models/hospital.model.js");

countries.hasMany(leaves, { foreignKey: 'countryId', as: 'countryLeaves' });
leaves.belongsTo(countries, { foreignKey: 'countryId', as: 'country' });

// User - Permission relationship
User.hasOne(Permission, { foreignKey: 'user_id', as: 'permissions' });
Permission.belongsTo(User, { foreignKey: 'user_id' });

// User - Leaves relationship
User.hasMany(leaves, { foreignKey: 'user_id', as: 'userLeaves' });
leaves.belongsTo(User, { foreignKey: 'user_id', as: 'creator' });

// User - Doctor relationship
User.hasMany(Doctor, { foreignKey: 'user_id', as: 'userDoctors' });
Doctor.belongsTo(User, { foreignKey: 'user_id', as: 'creator' });

// User - Hospital relationship
User.hasMany(Hospital, { foreignKey: 'user_id', as: 'userHospitals' });
Hospital.belongsTo(User, { foreignKey: 'user_id', as: 'creator' });

// Export all models
module.exports = { User, leaves, countries, Permission, Media, Setting, Doctor, Hospital };
