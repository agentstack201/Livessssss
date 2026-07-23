const Doctor = require("../models/doctor.model");

// Get all doctors
module.exports.getAllDoctors = async (req, res) => {
  try {
    const doctors = await Doctor.findAll({
      order: [['name_ar', 'ASC']]
    });
    return res.status(200).json({
      success: true,
      data: doctors,
      message: "تم جلب قائمة الأطباء بنجاح"
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Add new doctor
module.exports.addDoctor = async (req, res) => {
  try {
    const { name_ar, name_en, position_ar, position_en } = req.body;

    if (!name_ar || !name_en) {
      return res.status(400).json({
        success: false,
        message: "يرجى إدخال اسم الطبيب بالعربية والإنجليزية"
      });
    }

    const existing = await Doctor.findOne({ where: { name_ar } });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "هذا الطبيب مسجل مسبقاً"
      });
    }

    const doctor = await Doctor.create({
      name_ar,
      name_en,
      position_ar,
      position_en,
      created_by: req.user?.name || 'system',
      user_id: req.user?.id || null
    });

    return res.status(201).json({
      success: true,
      data: doctor,
      message: "تم تسجيل الطبيب بنجاح"
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update doctor info
module.exports.updateDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const { name_ar, name_en, position_ar, position_en } = req.body;

    const doctor = await Doctor.findByPk(id);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "الطبيب غير موجود"
      });
    }

    await doctor.update({
      name_ar,
      name_en,
      position_ar,
      position_en
    });

    return res.status(200).json({
      success: true,
      data: doctor,
      message: "تم تحديث بيانات الطبيب بنجاح"
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Delete doctor
module.exports.deleteDoctor = async (req, res) => {
  try {
    const { id } = req.params;

    const doctor = await Doctor.findByPk(id);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "الطبيب غير موجود"
      });
    }

    await doctor.destroy();

    return res.status(200).json({
      success: true,
      message: "تم حذف الطبيب بنجاح"
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
