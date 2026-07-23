const express = require("express");
const router = express.Router();
const Country = require("../models/countries.model");

// Get all countries
router.get("/countries", async (req, res) => {
  try {
    const countries = await Country.findAll({
      attributes: ['id', 'country_name_ar', 'country_name_en'],
      order: [['id', 'ASC']]
    });

    return res.status(200).json({
      success: true,
      data: countries
    });
  } catch (error) {
    console.error("Error fetching countries:", error);
    return res.status(500).json({
      success: false,
      message: "خطأ في جلب قائمة الدول",
      error: error.message
    });
  }
});

module.exports = router;
