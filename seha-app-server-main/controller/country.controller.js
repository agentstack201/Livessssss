const country = require("../models/countries.model");

module.exports.addNewCountries = async (req, res, next) => {
  const { countries } = req.body;
  try {
    countries.forEach(async (country_item) => {
      const new_countries = await country.create({
        country_name_en: country_item.en,
        country_name_ar: country_item.ar,
        created_by: req.user?.name || 'system',
        user_id: req.user?.id || null,
      });
    });
    return res.status(200).json({
      status_code: 200,
      data: null,
      message: "countries added successfully",
    });
  } catch (error) {
    return res.status(500).json({
      status_code: 500,
      data: null,
      message: error.message,
    });
  }
};

module.exports.getAllCountries = async (req, res, next) => {
  try {
    const countries = await country.findAll({
      attributes: ["id", "country_name_en", "country_name_ar", "created_by", "createdAt"],
      order: [['id', 'ASC']]
    });
    return res.status(200).json({
      status_code: 200,
      data: countries,
      message: "request success",
    });
  } catch (error) {
    return res.status(500).json({
      status_code: 500,
      data: null,
      message: error.message,
    });
  }
};

// إضافة دولة جديدة
module.exports.addCountry = async (req, res) => {
  try {
    const { country_name_ar, country_name_en } = req.body;

    if (!country_name_ar || !country_name_en) {
      return res.status(400).json({
        success: false,
        message: "يرجى إدخال اسم الدولة بالعربية والإنجليزية"
      });
    }

    // التحقق من عدم وجود الدولة مسبقاً
    const existing = await country.findOne({
      where: { country_name_ar }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "هذه الدولة موجودة مسبقاً"
      });
    }

    const newCountry = await country.create({
      country_name_ar,
      country_name_en,
      created_by: req.user?.name || 'system',
      user_id: req.user?.id || null
    });

    return res.status(201).json({
      success: true,
      data: newCountry,
      message: "تم إضافة الدولة بنجاح"
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// تعديل دولة
module.exports.updateCountry = async (req, res) => {
  try {
    const { id } = req.params;
    const { country_name_ar, country_name_en } = req.body;

    const existingCountry = await country.findByPk(id);
    if (!existingCountry) {
      return res.status(404).json({
        success: false,
        message: "الدولة غير موجودة"
      });
    }

    await existingCountry.update({
      country_name_ar,
      country_name_en
    });

    return res.status(200).json({
      success: true,
      data: existingCountry,
      message: "تم تحديث الدولة بنجاح"
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// حذف دولة
module.exports.deleteCountry = async (req, res) => {
  try {
    const { id } = req.params;

    const existingCountry = await country.findByPk(id);
    if (!existingCountry) {
      return res.status(404).json({
        success: false,
        message: "الدولة غير موجودة"
      });
    }

    await existingCountry.destroy();

    return res.status(200).json({
      success: true,
      message: "تم حذف الدولة بنجاح"
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
