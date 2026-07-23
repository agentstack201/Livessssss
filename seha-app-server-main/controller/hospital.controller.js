const Hospital = require("../models/hospital.model");

// Get all hospitals
module.exports.getAllHospitals = async (req, res) => {
  try {
    const hospitals = await Hospital.findAll({
      order: [['name_ar', 'ASC']]
    });
    return res.status(200).json({
      success: true,
      data: hospitals,
      message: "تم جلب قائمة المستشفيات بنجاح"
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Add new hospital
module.exports.addHospital = async (req, res) => {
  try {
    const { name_ar, name_en, license_number, logo } = req.body;

    if (!name_ar || !name_en) {
      return res.status(400).json({
        success: false,
        message: "يرجى إدخال اسم المستشفى بالعربية والإنجليزية"
      });
    }

    const existing = await Hospital.findOne({ where: { name_ar } });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "هذا المستشفى مسجل مسبقاً"
      });
    }

    const hospital = await Hospital.create({
      name_ar,
      name_en,
      license_number,
      logo: logo || null,
      created_by: req.user?.name || 'system',
      user_id: req.user?.id || null
    });

    return res.status(201).json({
      success: true,
      data: hospital,
      message: "تم تسجيل المستشفى بنجاح"
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update hospital info
module.exports.updateHospital = async (req, res) => {
  try {
    const { id } = req.params;
    const { name_ar, name_en, license_number, logo } = req.body;

    const hospital = await Hospital.findByPk(id);
    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: "المستشفى غير موجود"
      });
    }

    await hospital.update({
      name_ar,
      name_en,
      license_number,
      logo: logo || null
    });

    return res.status(200).json({
      success: true,
      data: hospital,
      message: "تم تحديث بيانات المستشفى بنجاح"
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Delete hospital
module.exports.deleteHospital = async (req, res) => {
  try {
    const { id } = req.params;

    const hospital = await Hospital.findByPk(id);
    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: "المستشفى غير موجود"
      });
    }

    await hospital.destroy();

    return res.status(200).json({
      success: true,
      message: "تم حذف المستشفى بنجاح"
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
