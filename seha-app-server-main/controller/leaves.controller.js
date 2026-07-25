const leaves = require("../models/leaves.model");
const config = require("../config/middlewares");
const Country = require("../models/countries.model");
const User = require("../models/user.model");
const { Sequelize, Op } = require("sequelize");
const moment = require("moment");

const getFormattedDateTime = () => {
  // Getting current time in "hh:mm A" format
  const currentTime = moment().format("hh:mm A");

  // Getting current date in "dddd, DD MMMM YYYY" format
  const currentDate = moment().format("dddd, DD MMMM YYYY");

  return { currentTime, currentDate };
};

module.exports.addNewLeaves = async (req, res, next) => {
  let {
    service_num,
    leave_id,
    admission_date_en,
    // admission_date_ar,
    discharge_date_en,
    issue_date,
    name_en,
    name_ar,
    national_id,
    employer_en,
    employer_ar,
    physician_name_en,
    physician_name_ar,
    position_en,
    position_ar,
    nationality,
    countryId,
    hospital_name_en,
    hospital_name_ar,
    license_number,
    report_time,
    report_date,
    footer_logo,
    show_license_number,
  } = req.body;
  try {
    // Ensure leave_id and service_num are identical
    // If service_num is provided and valid, use it for leave_id
    // If only leave_id is provided and valid, use it for service_num
    // If neither is valid, generate a new one

    if (service_num && service_num.trim() !== '') {
      leave_id = service_num;
    } else if (leave_id && leave_id.trim() !== '') {
      service_num = leave_id;
    } else {
      // Generate new one ONLY if both are missing
      service_num = await generateServiceNumber();
      leave_id = service_num;
    }

    let path;
    const DateObj = getFormattedDateTime();
    let admission_date_ar = config.convertDates(admission_date_en);
    let discharge_date_ar = config.convertDates(discharge_date_en);
    let new_leave = await leaves.create({
      service_num,
      leave_id,
      admission_date_en,
      admission_date_ar,
      discharge_date_en,
      discharge_date_ar,
      issue_date,
      name_en,
      name_ar,
      national_id,
      employer_en,
      employer_ar,
      physician_name_en,
      physician_name_ar,
      position_en,
      position_ar,
      nationality: nationality || 'سعودي',
      countryId: countryId || 1,
      hospital_name_en: hospital_name_en || 'AL NOOR SPECIALIST HOSPITAL',
      hospital_name_ar: hospital_name_ar || 'مستشفى النور التخصصي',
      license_number: license_number || '1410845906',
      show_license_number: show_license_number !== false && show_license_number !== 'false',
      report_time: report_time || DateObj.currentTime,
      report_date: report_date || DateObj.currentDate,
      footer_logo,
      created_by: req.user?.name || 'system',
      user_id: req.user?.id || null,
    });

    // Debug: طباعة البيانات المستلمة والمخزنة
    console.log('📥 Backend received:', {
      report_time,
      report_date,
      DateObj: DateObj
    });

    console.log('💾 Stored data:', {
      stored_report_time: report_time || DateObj.currentTime,
      stored_report_date: report_date || DateObj.currentDate
    });

    // Return success with leave data (no PDF generation on create)
    return res.status(200).json({
      status_code: 200,
      success: true,
      data: new_leave,
      message: "تم إنشاء الإجازة المرضية بنجاح",
    });
  } catch (error) {
    return res.status(500).json({
      status_code: 500,
      data: null,
      message: error.message,
    });
  }
};

module.exports.getOneLeaveDetails = async (req, res, next) => {
  try {
    const { national_id, service_num } = req.query;

    // Both identifiers are required. Without this check a missing value becomes
    // `undefined` in the Sequelize where-clause and throws a 500 instead of a
    // clean 400.
    if (!national_id || !service_num) {
      return res.status(400).json({
        status_code: 400,
        data: null,
        message: "يرجى إدخال رقم الهوية ورمز الخدمة",
      });
    }

    // Public verification lookup: a valid (national_id, service_num) pair returns
    // the record regardless of who is asking. We intentionally do NOT scope by
    // user_id here — scoping gave logged-in non-admins LESS access than anonymous
    // visitors on this public endpoint.
    const whereCondition = { national_id, service_num };

    const leave = await leaves.findOne({
      where: whereCondition,
      include: [
        {
          model: Country,
          as: 'country',
          attributes: ['country_name_en', 'country_name_ar'],
        },
        {
          model: User,
          as: 'creator',
          attributes: ['name']
        }
      ],
    });

    console.log('📋 Found leave:', leave ? 'Yes' : 'No');

    if (leave) {
      let leave_days = config.calcDays(
        leave.dataValues.admission_date_en,
        leave.dataValues.discharge_date_en
      );
      leave.dataValues.leave_days = leave_days;

      // Return as array to match frontend expectation
      return res.status(200).json([leave]);
    } else {
      return res.status(404).json([]);
    }
  } catch (error) {
    console.error('❌ Search error:', error.message);
    return res.status(500).json({
      status_code: 500,
      data: null,
      message: error.message,
    });
  }
};

// Update leave
module.exports.updateLeave = async (req, res, next) => {
  const {
    id,
    service_num,
    leave_id,
    admission_date_en,
    discharge_date_en,
    issue_date,
    name_en,
    name_ar,
    national_id,
    employer_en,
    employer_ar,
    physician_name_en,
    physician_name_ar,
    position_en,
    position_ar,
    nationality,
    countryId,
    hospital_name_en,
    hospital_name_ar,
    license_number,
    report_time,
    report_date,
    footer_logo,
    show_license_number,
  } = req.body;

  try {
    // Find existing leave by ID or composite key
    let existingLeave;
    if (id) {
      existingLeave = await leaves.findByPk(id);
    } else {
      existingLeave = await leaves.findOne({
        where: { service_num, national_id }
      });
    }

    if (!existingLeave) {
      return res.status(404).json({
        status_code: 404,
        data: null,
        message: "لم يتم العثور على الإجازة المرضية",
      });
    }

    // Permission check: only admin or the owning user (by numeric user_id) can update.
    // NOTE: matching by user_id (not the mutable/duplicable display name) prevents
    // one user from editing another's record when they share the same name.
    if (req.user && req.user.role !== 'admin' && existingLeave.user_id !== req.user.id) {
      return res.status(403).json({
        status_code: 403,
        data: null,
        message: "ليس لديك صلاحية لتعديل هذا السجل",
      });
    }

    // Convert dates
    let admission_date_ar = config.convertDates(admission_date_en);
    let discharge_date_ar = config.convertDates(discharge_date_en);

    // Ensure leave_id and service_num are identical and respect provided values
    let final_service_num = service_num;
    let final_leave_id = leave_id;

    if (final_service_num && final_service_num.trim() !== '') {
      final_leave_id = final_service_num;
    } else if (final_leave_id && final_leave_id.trim() !== '') {
      final_service_num = final_leave_id;
    } else {
      // Keep existing if both are missing in request
      final_service_num = existingLeave.service_num;
      final_leave_id = existingLeave.leave_id;
    }

    // Update leave
    console.log('🔄 Updating leave with data:', {
      report_time,
      report_date,
      service_num: final_service_num,
      leave_id: final_leave_id
    });

    await existingLeave.update({
      leave_id: final_leave_id,
      service_num: final_service_num,
      national_id,
      admission_date_en,
      admission_date_ar,
      discharge_date_en,
      discharge_date_ar,
      issue_date,
      name_en,
      name_ar,
      employer_en,
      employer_ar,
      physician_name_en,
      physician_name_ar,
      position_en,
      position_ar,
      nationality,
      countryId,
      hospital_name_en,
      hospital_name_ar,
      license_number,
      show_license_number: show_license_number !== false && show_license_number !== 'false',
      footer_logo: footer_logo !== undefined ? footer_logo : existingLeave.footer_logo,
      // إضافة حقول التاريخ والوقت مع القيم الافتراضية إذا كانت فارغة
      report_time: report_time || existingLeave.report_time || (() => {
        const DateObj = getFormattedDateTime();
        return DateObj.currentTime;
      })(),
      report_date: report_date || existingLeave.report_date || (() => {
        const DateObj = getFormattedDateTime();
        return DateObj.currentDate;
      })(),
    });

    console.log('✅ Leave updated successfully');

    // Return success (no PDF generation on update)
    return res.status(200).json({
      status_code: 200,
      success: true,
      data: existingLeave,
      message: "تم تحديث الإجازة المرضية بنجاح",
    });
  } catch (error) {
    return res.status(500).json({
      status_code: 500,
      data: null,
      message: error.message,
    });
  }
};

// Delete leave
module.exports.deleteLeave = async (req, res, next) => {
  try {
    const { service_num, national_id } = req.query;

    if (!service_num || !national_id) {
      return res.status(400).json({
        status_code: 400,
        data: null,
        message: "يرجى تحديد رمز الخدمة ورقم الهوية",
      });
    }

    const leave = await leaves.findOne({
      where: { service_num, national_id }
    });

    if (!leave) {
      return res.status(404).json({
        status_code: 404,
        data: null,
        message: "لم يتم العثور على الإجازة المرضية",
      });
    }

    // Permission check: only admin or the owning user (by numeric user_id) can delete.
    // Matching by user_id (not the mutable/duplicable display name) prevents one user
    // from deleting another's record when they share the same name.
    if (req.user && req.user.role !== 'admin' && leave.user_id !== req.user.id) {
      return res.status(403).json({
        status_code: 403,
        data: null,
        message: "ليس لديك صلاحية لحذف هذا السجل",
      });
    }

    await leave.destroy();

    return res.status(200).json({
      status_code: 200,
      data: null,
      message: "تم حذف الإجازة المرضية بنجاح",
    });
  } catch (error) {
    return res.status(500).json({
      status_code: 500,
      data: null,
      message: error.message,
    });
  }
};

// AI Extract (Powered by Google Gemini)
module.exports.aiExtract = async (req, res, next) => {
  try {
    const { clientInfo } = req.body;

    if (!clientInfo || clientInfo.trim() === '') {
      return res.status(400).json({
        status_code: 400,
        data: null,
        message: "يرجى إدخال نص لاستخراج البيانات",
      });
    }

    const { GoogleGenerativeAI } = require("@google/generative-ai");
    const { getSettingValue } = require("./settings.controller");

    // ------------------------------------------------------------------
    // مفاتيح API متعددة مع تبديل تلقائي (failover):
    // تُقرأ من الإعدادات (قاعدة البيانات) ثم من متغيّرات البيئة، ويمكن وضع
    // أكثر من مفتاح مفصولة بسطر جديد أو فاصلة. إذا توقّف مفتاح (تجاوز الحصة
    // أو خطأ) يُجرَّب الذي يليه تلقائياً.
    // ------------------------------------------------------------------
    const parseKeys = (raw) =>
      (raw || "")
        .split(/[\n,;]+/)
        .map((k) => k.trim())
        .filter(Boolean);

    const dbKeys = parseKeys(await getSettingValue('gemini_api_key'));
    const envKeys = parseKeys(process.env.GEMINI_API_KEY);
    const apiKeys = [...new Set([...dbKeys, ...envKeys])];

    if (apiKeys.length === 0) {
      return res.status(500).json({
        status_code: 500,
        success: false,
        message: "لا يوجد أي مفتاح ربط مع Google Gemini. أضف مفتاحاً واحداً على الأقل في الإعدادات.",
      });
    }

    // النموذج المختار من الإعدادات، مع قائمة نماذج احتياطية مضمونة العمل.
    // لو كان المحفوظ نموذجاً غير موجود، يتحوّل تلقائياً لأول نموذج شغّال.
    const configuredModel =
      (await getSettingValue('gemini_model')) || process.env.GEMINI_MODEL || "gemini-flash-latest";
    const modelsToTry = [
      configuredModel,
      "gemini-flash-latest",
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-1.5-flash",
    ].filter((m, i, a) => m && a.indexOf(m) === i);

    console.log(`AI Extract: ${apiKeys.length} key(s) available | preferred model: ${configuredModel}`);

    const prompt = `
      You are an expert medical data extractor. Your task is to extract sick leave details from the text below and return a valid JSON object only.
      
      Extract these fields (use specific keys):
      - serviceNum: (Format: GSL261... or PSL261...)
      - nationalID: (10 digits)
      - name: (Patient Name in English)
      - nameArabic: (Patient Name in Arabic)
      - leaveId: (Leave ID / CSL number)
      - nationality: (Patient Nationality in ARABIC - e.g., 'سعودي', 'مصري')
      - employer: (Employer Name - Favor Arabic if available)
      - physicianPosition: (Doctor Position English)
      - physicianPositionArabic: (Doctor Position Arabic)
      - admissionDate: (YYYY-MM-DD)
      - dischargeDate: (YYYY-MM-DD)
      - issueDate: (YYYY-MM-DD)
      - doctorName: (Physician Name English)
      - doctorNameArabic: (Physician Name Arabic)
      - hospitalNameEnglish
      - hospitalNameArabic
      
      If any field is missing or ambiguous, leave it as an empty string "".
      Do NOT wrap the output in markdown or code blocks (like \`\`\`json). Just return the raw JSON string.
      
      Text to process:
      """
      ${clientInfo}
      """
    `;

    // محاولة التنفيذ عبر كل مفتاح ثم كل نموذج حتى ينجح واحد
    let text = null;
    let usedKey = -1;
    let usedModel = null;
    const attemptErrors = [];

    for (let ki = 0; ki < apiKeys.length && text === null; ki++) {
      const genAI = new GoogleGenerativeAI(apiKeys[ki]);
      for (let mi = 0; mi < modelsToTry.length; mi++) {
        const modelName = modelsToTry[mi];
        try {
          const model = genAI.getGenerativeModel({ model: modelName });
          const result = await model.generateContent(prompt);
          text = result.response.text();
          usedKey = ki;
          usedModel = modelName;
          break;
        } catch (err) {
          const msg = err && err.message ? err.message : String(err);
          attemptErrors.push(`مفتاح#${ki + 1} / ${modelName}: ${msg}`);
          const low = msg.toLowerCase();
          const invalidKey =
            low.includes('api key not valid') ||
            low.includes('api_key_invalid') ||
            low.includes('invalid api key') ||
            low.includes('permission denied') ||
            low.includes('403');
          const quota =
            low.includes('quota') ||
            low.includes('rate limit') ||
            low.includes('resource_exhausted') ||
            low.includes('429') ||
            low.includes('overloaded') ||
            low.includes('503');
          // مفتاح غير صالح أو تجاوز حصة → انتقل للمفتاح التالي مباشرة
          if (invalidKey || quota) break;
          // غير ذلك (نموذج غير موجود مثلاً) → جرّب النموذج التالي بنفس المفتاح
        }
      }
    }

    if (text === null) {
      console.error("AI Extract — all keys/models failed:", attemptErrors);
      return res.status(502).json({
        status_code: 502,
        success: false,
        message:
          "تعذّر استخراج البيانات: فشلت جميع مفاتيح Gemini. تأكد من صحة المفاتيح ومن عدم تجاوز الحصة.",
        details: attemptErrors,
      });
    }

    console.log(`✅ AI extract succeeded via key #${usedKey + 1} using model "${usedModel}"`);

    let extractedData = {};
    try {
      // تنظيف النص في حال وجود markdown
      const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
      extractedData = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error("JSON Parse Error:", parseError, "RAW:", text);
      return res.status(500).json({
        status_code: 500,
        success: false,
        message: "تم الاتصال بالذكاء الاصطناعي لكن تعذّر تحليل الرد. حاول مرة أخرى.",
      });
    }

    return res.status(200).json({
      status_code: 200,
      success: true,
      data: extractedData,
      message: "تم استخراج البيانات بنجاح باستخدام Gemini AI",
    });

  } catch (error) {
    console.error("AI Extract Error Details:", {
      message: error.message,
      stack: error.stack,
      error
    });
    return res.status(500).json({
      status_code: 500,
      data: null,
      message: error.message || "حدث خطأ أثناء معالجة البيانات",
    });
  }
};

// ============================================
// Helper Functions
// ============================================

// Validate ID format
// PSL: PSL + 11 digits starting with 261 (total 14 chars)
// GSL: GSL + 12 digits starting with 261 (total 15 chars)
function isValidIdFormat(id) {
  if (!id) return false;
  // PSL format: PSL + 11 digits starting with 261
  const pslPattern = /^PSL261\d{8}$/;
  // GSL format: GSL + 12 digits starting with 261
  const gslPattern = /^GSL261\d{9}$/;
  return pslPattern.test(id) || gslPattern.test(id);
}

// Generate unique service number
// Format: GSL + 261 + 9 random digits (12 digits total, 15 chars with GSL)
async function generateServiceNumber() {
  const random = Math.floor(100000000 + Math.random() * 900000000); // 9-digit random

  // GSL format: GSL + 261 + 9 random digits = GSL261XXXXXXXXX
  const serviceNum = `GSL261${random}`;

  // Check if exists
  const exists = await leaves.findOne({ where: { service_num: serviceNum } });
  if (exists) {
    return generateServiceNumber();
  }

  return serviceNum;
}

// Generate unique Leave ID
// Format: PSL + 261 + 8 random digits (11 digits total, 14 chars with PSL)
async function generateUniqueLeaveId() {
  const random = Math.floor(10000000 + Math.random() * 90000000); // 8-digit random

  // PSL format: PSL + 261 + 8 random digits = PSL261XXXXXXXX
  const leaveId = `PSL261${random}`;

  // Check if exists
  const exists = await leaves.findOne({ where: { leave_id: leaveId } });
  if (exists) {
    return generateUniqueLeaveId();
  }

  return leaveId;
}

// ============================================
// Smart Extraction Functions
// ============================================

// Extract Service Number - أي رقم من 3-8 أرقام
function extractServiceNumber(text) {
  // ابحث عن كلمات مفتاحية
  const patterns = [
    /(?:service|service\s*number|service\s*num|service\s*no|رقم\s*الخدمة|خدمة)[:\s#-]*(\d{3,8})/i,
    /(?:^|\n)(\d{3,8})(?:\s|$)/m, // رقم منفصل في سطر
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }

  // ابحث عن أي رقم من 3-8 أرقام
  const numbers = text.match(/\b\d{3,8}\b/g);
  if (numbers && numbers.length > 0) {
    // استبعد الأرقام الطويلة (رقم الهوية)
    const filtered = numbers.filter(n => n.length < 10);
    if (filtered.length > 0) return filtered[0];
  }

  return null;
}

// Extract English Name
function extractEnglishName(text) {
  const patterns = [
    /(?:name|patient\s*name|full\s*name|اسم)[:\s]+([A-Z][a-zA-Z\s]{2,40})(?:\n|$|,|\|)/i,
    /(?:^|\n)([A-Z][a-z]+\s+[A-Z][a-z]+)(?:\s|$)/m, // اسم بصيغة "First Last"
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const name = match[1].trim();
      // تأكد أنه ليس كلمة عربية
      if (!/[ء-ي]/.test(name)) return name;
    }
  }

  return null;
}

// Extract Arabic Name
function extractArabicName(text) {
  const patterns = [
    /(?:الاسم|اسم\s*المريض|اسم)[:\s]+([ء-ي\s]{3,40})(?:\n|$|,|\|)/i,
    /(?:^|\n)([ء-ي]+\s+[ء-ي]+)(?:\s|$)/m, // اسم عربي
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }

  return null;
}

// Extract National ID - رقم من 10 أرقام بالضبط
function extractNationalID(text) {
  const patterns = [
    /(?:national\s*id|id\s*number|رقم\s*الهوية|هوية|رقم\s*هوية)[:\s#-]*(\d{10})/i,
    /\b(\d{10})\b/, // أي رقم من 10 أرقام
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }

  return null;
}

// Extract Leave ID
function extractLeaveID(text) {
  const patterns = [
    /(?:leave\s*id|csl|رقم\s*الإجازة|إجازة)[:\s#-]*([A-Z0-9-]{3,20})/i,
    /\b(CSL-?\d+)\b/i, // CSL format
    /\b([A-Z]{2,4}-?\d{3,6})\b/, // أي كود بحروف وأرقام
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].toUpperCase();
  }

  return null;
}

// Extract Start Date
function extractStartDate(text) {
  const patterns = [
    /(?:admission|start\s*date|from|من\s*تاريخ|تاريخ\s*البداية|بداية)[:\s]+(\d{4}[-/]\d{2}[-/]\d{2})/i,
    /(?:^|\n)(\d{4}[-/]\d{2}[-/]\d{2})/, // أول تاريخ في النص
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].replace(/\//g, '-');
  }

  // ابحث عن أي تاريخ
  const dates = text.match(/\d{4}[-/]\d{2}[-/]\d{2}/g);
  if (dates && dates.length > 0) return dates[0].replace(/\//g, '-');

  return null;
}

// Extract End Date
function extractEndDate(text) {
  const patterns = [
    /(?:discharge|end\s*date|to|until|إلى\s*تاريخ|تاريخ\s*النهاية|نهاية)[:\s]+(\d{4}[-/]\d{2}[-/]\d{2})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].replace(/\//g, '-');
  }

  // ابحث عن ثاني تاريخ في النص
  const dates = text.match(/\d{4}[-/]\d{2}[-/]\d{2}/g);
  if (dates && dates.length > 1) return dates[1].replace(/\//g, '-');

  return null;
}

// Extract Physician Name
function extractPhysicianName(text) {
  const patterns = [
    /(?:doctor|physician|dr\.|د\.|الطبيب|طبيب)[:\s]+([A-Za-zء-ي\s\.]{3,40})(?:\n|$|,|\|)/i,
    /\b(?:Dr\.|د\.)\s*([A-Za-zء-ي\s]{3,30})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }

  return null;
}

// Extract Diagnosis
function extractDiagnosis(text) {
  const patterns = [
    /(?:diagnosis|التشخيص|تشخيص)[:\s]+([^\n]{3,100})/i,
    /(?:condition|حالة)[:\s]+([^\n]{3,100})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }

  return null;
}

// Extract Employer
function extractEmployer(text) {
  const patterns = [
    /(?:employer|company|organization|جهة\s*العمل|الشركة|شركة|مؤسسة)[:\s]+([^\n]{3,100})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }

  return null;
}

// Extract Position
function extractPosition(text) {
  const patterns = [
    /(?:position|job\s*title|role|المسمى\s*الوظيفي|الوظيفة|وظيفة|منصب)[:\s]+([^\n]{3,100})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }

  return null;
}

// Extract Nationality
function extractNationality(text) {
  const patterns = [
    /(?:nationality|الجنسية|جنسية)[:\s]+([^\n]{3,50})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }

  // قائمة الجنسيات الشائعة
  const nationalities = [
    'Saudi', 'Egyptian', 'Syrian', 'Jordanian', 'Lebanese', 'Palestinian',
    'Iraqi', 'Yemeni', 'Sudanese', 'Pakistani', 'Indian', 'Bangladeshi',
    'Filipino', 'Ethiopian', 'سعودي', 'مصري', 'سوري', 'أردني', 'لبناني',
    'فلسطيني', 'عراقي', 'يمني', 'سوداني', 'باكستاني', 'هندي', 'بنغلاديشي',
    'فلبيني', 'إثيوبي'
  ];

  for (const nat of nationalities) {
    if (text.toLowerCase().includes(nat.toLowerCase())) {
      return nat;
    }
  }

  return null;
}

// Helper function for pattern extraction (legacy)
function extractPattern(text, pattern) {
  const match = text.match(pattern);
  return match ? match[1].trim() : null;
}

// Download PDF
module.exports.downloadPDF = async (req, res, next) => {
  try {
    const { service_num, national_id } = req.params;
    console.log('📥 PDF Download Request:', { service_num, national_id });

    const leave = await leaves.findOne({
      where: { service_num, national_id },
      include: [{ model: Country, as: 'country' }]
    });

    if (!leave) {
      console.log('❌ Leave not found');
      return res.status(404).json({
        status_code: 404,
        data: null,
        message: "لم يتم العثور على الإجازة المرضية",
      });
    }

    console.log('✅ Leave found:', leave.id);

    // Calculate leave days
    const leave_days = config.calcDays(
      leave.admission_date_en,
      leave.discharge_date_en
    );
    console.log('📊 Leave days:', leave_days);

    // Get country details
    const country = await Country.findOne({
      where: { id: leave.countryId }
    });
    console.log('🌍 Country:', country ? country.country_name_en : 'Not found');

    // Generate PDF in memory (as buffer)
    const DateObj = getFormattedDateTime();
    console.log('📅 Date Object:', DateObj);

    console.log('🔄 Generating PDF...');
    const pdfBuffer = await config.createPDF(
      leave.dataValues,
      leave_days,
      DateObj,
      country
    );
    console.log('✅ PDF generated, size:', pdfBuffer.length, 'bytes');

    // Send PDF buffer directly to user
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="SickLeaves.pdf"');
    res.setHeader('Content-Length', pdfBuffer.length);

    console.log('📤 Sending PDF to client');
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('❌ PDF Generation Error:', error);
    console.error('Stack:', error.stack);
    return res.status(500).json({
      status_code: 500,
      data: null,
      message: error.message,
    });
  }
};

// Get leaves count for dashboard stats
module.exports.getLeavesCount = async (req, res) => {
  try {
    // Build condition based on role
    const whereCondition = {};
    if (req.user && req.user.role !== 'admin') {
      whereCondition.user_id = req.user.id;
    }

    const count = await leaves.count({ where: whereCondition });

    return res.status(200).json({
      status_code: 200,
      success: true,
      data: { total: count },
      message: "تم جلب عدد الإجازات بنجاح"
    });
  } catch (error) {
    return res.status(500).json({
      status_code: 500,
      success: false,
      message: "خطأ في جلب عدد الإجازات",
      error: error.message
    });
  }
};

// Get all leaves (for dashboard)
module.exports.getAllLeaves = async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '' } = req.query;
    const offset = (page - 1) * limit;

    // Build search conditions
    let whereConditions = {};

    // Filter by creator if not admin
    if (req.user && req.user.role !== 'admin') {
      whereConditions.user_id = req.user.id;
    }

    if (search) {
      const searchCondition = {
        [Op.or]: [
          { name_ar: { [Op.like]: `%${search}%` } },
          { name_en: { [Op.like]: `%${search}%` } },
          { national_id: { [Op.like]: `%${search}%` } },
          { service_num: { [Op.like]: `%${search}%` } },
          { physician_name_ar: { [Op.like]: `%${search}%` } },
          { physician_name_en: { [Op.like]: `%${search}%` } },
          { hospital_name_ar: { [Op.like]: `%${search}%` } },
          { hospital_name_en: { [Op.like]: `%${search}%` } }
        ]
      };

      // Merge with role filter if exists
      if (whereConditions.user_id) {
        whereConditions = {
          [Op.and]: [
            { user_id: whereConditions.user_id },
            searchCondition
          ]
        };
      } else {
        whereConditions = searchCondition;
      }
    }

    const { count, rows: allLeaves } = await leaves.findAndCountAll({
      where: whereConditions,
      include: [
        {
          model: Country,
          as: 'country',
          attributes: ['country_name_ar', 'country_name_en']
        },
        {
          model: User,
          as: 'creator',
          attributes: ['name']
        }
      ],
      order: [['createdAt', 'DESC']], // Latest first
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    return res.status(200).json({
      status_code: 200,
      success: true,
      data: allLeaves,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
        hasNext: page * limit < count,
        hasPrev: page > 1
      },
      message: "تم جلب السجلات بنجاح"
    });
  } catch (error) {
    return res.status(500).json({
      status_code: 500,
      success: false,
      message: "خطأ في جلب السجلات",
      error: error.message
    });
  }
};
