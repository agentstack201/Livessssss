const leaves = require("../models/leaves.model");
const config = require("../config/middlewares");
const { normalizeDocumentType, rendererNameFor } = require("../config/documentTypes");
const { normalizeNationality } = require("../utils/nationality");
const {
  sanitizeHospitalName,
  sanitizePersonName,
  sanitizeNationalId,
  sanitizePhone,
  sanitizeVisitTypeArabic,
  sanitizeVisitTypeEnglish,
  sanitizeTime,
} = require("../utils/extractionClean");
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

// طريقة التاريخ: أي قيمة غير 'issue_date' بالضبط تعود للسلوك الحالي
// (actual) — فلا يمكن لقيمة غير متوقعة أن تغيّر طريقة حساب مدة الإجازة.
const normalizeDateMode = (value) => (value === 'issue_date' ? 'issue_date' : 'actual');

// مدة الإجازة كقيمة مستقلة تُحفظ فقط في وضع "يبدأ من تاريخ الإصدار"، وفقط
// إذا كانت رقماً صحيحاً موجباً صالحاً. في أي حالة أخرى تبقى NULL ويستمر
// حساب calcDays() من تاريخي الدخول والخروج كما كان دائماً.
const normalizeLeaveDaysOverride = (dateMode, rawValue) => {
  if (dateMode !== 'issue_date') return null;
  const parsed = parseInt(rawValue, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

// مدة الإجازة الفعلية لسجل ما: في وضع "يبدأ من تاريخ الإصدار" مع قيمة
// leave_days محفوظة تُستخدم هذه القيمة كما أُدخلت. في أي حالة أخرى (وكل
// السجلات القديمة بلا date_mode) يبقى الحساب من الفرق بين تاريخي الدخول
// والخروج تماماً كما كان قبل هذا التعديل — لا تغيير على السلوك الحالي.
function resolveLeaveDays(leave) {
  if (leave.date_mode === 'issue_date' && leave.leave_days) {
    return leave.leave_days;
  }
  return config.calcDays(leave.admission_date_en, leave.discharge_date_en);
}

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
    phone,
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
    // QR اختياري وطريقة التاريخ (اختياريان — انظر resolveLeaveDays أدناه)
    add_qr,
    date_mode,
    leave_days,
    // حقول قالب «مشهد مراجعة لمرافق» (اختيارية — تُتجاهل مع الإجازة المرضية)
    document_type,
    admission_time,
    discharge_time,
    relation_en,
    relation_ar,
    visit_type_en,
    visit_type_ar,
    // حقول التقارير الورقية: كائن JSON حرّ لكل قالب + خيار الخط.
    template_data,
    document_font,
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

    // وحدة النمو: بوّابة الرصيد. تسبق الإنشاء عمداً — المنع بعد إنشاء
    // المستند يترك مستنداً موجوداً بلا خصم. وهي صامتة ما دام إعداد
    // «منع الإصدار عند نفاد الرصيد» معطّلاً، وهو الافتراضي.
    if (req.user?.id) {
      const gate = await require('../growth/hooks')
        .canCreateDocument({ userId: req.user.id, req });
      if (!gate.allowed) {
        return res.status(402).json({
          status_code: 402,
          data: { balance: gate.balance, cost: gate.cost, shortfall: gate.shortfall },
          message: `لا يوجد رصيد كافٍ لإصدار المستند. الرصيد ${gate.balance} والتكلفة ${gate.cost}.`,
        });
      }
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
      phone: phone || '',
      employer_en,
      employer_ar,
      physician_name_en,
      physician_name_ar,
      position_en,
      position_ar,
      // الجنسية تُوحَّد قبل الحفظ: «سعودي» بأي رسم → «السعودية»، والفراغ →
      // «السعودية». التوحيد على البيانات نفسها لا على العرض.
      nationality: normalizeNationality(nationality),
      countryId: countryId || 1,
      hospital_name_en: hospital_name_en || 'AL NOOR SPECIALIST HOSPITAL',
      hospital_name_ar: hospital_name_ar || 'مستشفى النور التخصصي',
      license_number: license_number || '1410845906',
      show_license_number: show_license_number !== false && show_license_number !== 'false',
      add_qr: add_qr !== false && add_qr !== 'false',
      date_mode: normalizeDateMode(date_mode),
      leave_days: normalizeLeaveDaysOverride(normalizeDateMode(date_mode), leave_days),
      report_time: report_time || DateObj.currentTime,
      report_date: report_date || DateObj.currentDate,
      footer_logo,
      // نوع المستند يمرّ عبر القائمة البيضاء في config/documentTypes.js:
      // أي نوع مدعوم يُحفظ كما هو، وأي قيمة مجهولة تعود للافتراضي (إجازة مرضية).
      document_type: normalizeDocumentType(document_type),
      admission_time: admission_time || '',
      discharge_time: discharge_time || '',
      relation_en: relation_en || '',
      relation_ar: relation_ar || '',
      visit_type_en: visit_type_en || '',
      visit_type_ar: visit_type_ar || '',
      template_data: sanitizeTemplateData(template_data),
      document_font: document_font || null,
      created_by: req.user?.name || 'system',
      user_id: req.user?.id || null,
    });

    // وحدة النمو: الخصم وتسجيل الاستخدام وتقدّم قمع التفعيل. المنع وقع في
    // البوّابة أعلاه، فما يبقى هنا محاسبة تفشل بصمت — عطل في النمو يجب
    // ألّا يمنع طبيباً من إصدار إجازة.
    if (req.user?.id) {
      try {
        // بلا await: تسجيل النمو لا يؤخّر رد المستخدم. الخطّاف يلتقط أخطاءه
        // داخلياً، و.catch حارس أخير ضد رفض غير معالَج يُسقط العملية.
        require('../growth/hooks')
          .onDocumentCreated({ userId: req.user.id, documentId: new_leave.id, req })
          .catch((e) => console.warn('[growth] تعذّر تسجيل المستند:', e.message));
      } catch (hookError) {
        console.warn('[growth] تعذّر تسجيل المستند:', hookError.message);
      }
    }

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

    // ملاحظة أداء: لا نضمّ جدول المستخدمين (creator) هنا. هذه النقطة عامة
    // ويستهلكها الاستعلام والمعاينة وتحميل الـ PDF، ولا أحد منها يقرأ اسم
    // المُنشئ (لوحة التحكم وحدها تعرضه وتجلبه من /sick-leaves/all). حذف الضمّ
    // يوفّر JOIN كاملاً على كل استعلام دون أي تغيير في المخرجات المستخدَمة.
    const leave = await leaves.findOne({
      where: whereCondition,
      include: [
        {
          model: Country,
          as: 'country',
          attributes: ['country_name_en', 'country_name_ar'],
        },
      ],
    });

    console.log('📋 Found leave:', leave ? 'Yes' : 'No');

    if (leave) {
      leave.dataValues.leave_days = resolveLeaveDays(leave.dataValues);

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
    phone,
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
    // QR اختياري وطريقة التاريخ (اختياريان)
    add_qr,
    date_mode,
    leave_days,
    // حقول قالب «مشهد مراجعة لمرافق» (اختيارية)
    document_type,
    admission_time,
    discharge_time,
    relation_en,
    relation_ar,
    visit_type_en,
    visit_type_ar,
    template_data,
    document_font,
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
      phone: phone !== undefined ? (phone || '') : existingLeave.phone,
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
      // نفس التوحيد عند التعديل — وإلا عاد «سعودي» إلى السجل من طلب قديم.
      nationality: nationality !== undefined
        ? normalizeNationality(nationality)
        : normalizeNationality(existingLeave.nationality),
      countryId,
      hospital_name_en,
      hospital_name_ar,
      license_number,
      show_license_number: show_license_number !== false && show_license_number !== 'false',
      footer_logo: footer_logo !== undefined ? footer_logo : existingLeave.footer_logo,
      // QR وطريقة التاريخ: تُحدَّثان فقط إذا أُرسلتا، وإلا تبقيان كما كانتا —
      // فطلب تعديل قديم لا يرسل هذين الحقلين لا يُسقط الـ QR ولا يغيّر الوضع.
      add_qr: add_qr !== undefined
        ? (add_qr !== false && add_qr !== 'false')
        : existingLeave.add_qr,
      date_mode: date_mode !== undefined
        ? normalizeDateMode(date_mode)
        : normalizeDateMode(existingLeave.date_mode),
      leave_days: leave_days !== undefined
        ? normalizeLeaveDaysOverride(
            date_mode !== undefined ? normalizeDateMode(date_mode) : normalizeDateMode(existingLeave.date_mode),
            leave_days
          )
        : existingLeave.leave_days,
      // حقول قالب «مشهد مراجعة لمرافق»: تُحدَّث فقط إذا أُرسلت، وإلا تبقى كما هي
      // (فالطلبات القديمة التي لا ترسلها لا تفقد بياناتها).
      document_type: document_type !== undefined
        ? normalizeDocumentType(document_type)
        : normalizeDocumentType(existingLeave.document_type),
      admission_time: admission_time !== undefined ? admission_time : existingLeave.admission_time,
      discharge_time: discharge_time !== undefined ? discharge_time : existingLeave.discharge_time,
      relation_en: relation_en !== undefined ? relation_en : existingLeave.relation_en,
      relation_ar: relation_ar !== undefined ? relation_ar : existingLeave.relation_ar,
      visit_type_en: visit_type_en !== undefined ? visit_type_en : existingLeave.visit_type_en,
      visit_type_ar: visit_type_ar !== undefined ? visit_type_ar : existingLeave.visit_type_ar,
      // كما بقية حقول القوالب: تُحدَّث فقط إذا أُرسلت، وإلا تبقى كما هي.
      template_data: template_data !== undefined ? sanitizeTemplateData(template_data) : existingLeave.template_data,
      document_font: document_font !== undefined ? (document_font || null) : existingLeave.document_font,
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

    const { llmGenerate } = require("../utils/llm");

    const prompt = `
      You are an expert medical-data extractor for Saudi sick-leave workflows.
      The text below is ONE of two common shapes; identify which, then extract.

      ── INPUT SHAPES ──

      SHAPE A — SECRETARY MESSAGE (WhatsApp / plain notes)
      Recognisable by short "label: value" lines in Arabic; no bilingual
      headers, no Hijri dates, no "Leave ID". Common labels (may include
      typos/extra spaces):
        الاسم | رقم الهوية | تاريخ الميلاد | رقم الجوال | جهة العمل |
        الجنسية | المنطقة | اسم المهنة | تاريخ الاجازه/الاجازة
      Rules for shape A:
      - "اسم المهنة" is the PATIENT's occupation (كاشير، موظف استقبال، طالب …).
        It is NEVER the doctor's specialty. DO NOT put it in
        physicianPosition / physicianPositionArabic. There is no output
        field for the patient's occupation — ignore it.
      - "تاريخ الميلاد" and "المنطقة" have no output field either — ignore
        them, do not stuff them elsewhere.
      - "تاريخ الاجازه" is the sick-leave date → admissionDate; also copy the
        same value to dischargeDate. If the value is a bare day ("17") or
        contains only a month name without a year ("2 Sep"), leave both dates
        empty ("") — never invent the missing parts.
      - The doctor / hospital fields are usually absent in this shape; leave
        them "".

      SHAPE B — SEHA / OFFICIAL SICK-LEAVE REPORT (PDF / screenshot OCR)
      Recognisable by bilingual headers ("Sick Leave Report / تقرير إجازة
      مرضية" or "Statement of Visit / مشهد مراجعة"), a "Leave ID" token,
      Hijri and Gregorian dates side-by-side, and a hospital line usually
      near the BOTTOM in both Arabic and English.
      Rules for shape B:
      - serviceNum AND leaveId = the value on the "Leave ID" line (uppercase,
        no separators). Common prefixes: GSL, PSL, CSL.
      - Hospital name is the facility line near the end (Arabic "مستشفى …" or
        English "… Hospital"). IGNORE these lines entirely — they are NOT
        the hospital: "وزارة الصحة", "Ministry of Health", "المركز الوطني
        للمعلومات الصحية", "National Health Information Center", any URL
        (www.seha.sa/…), "ALIHEALTH", "Seha", "صحة", any Hijri/Gregorian
        timestamp line (e.g. "Sunday, 02 August 2026", "11:14 PM").
      - "Practitioner Name" and "Physician Name" both label the doctor —
        same field (doctorName / doctorNameArabic).
      - "Position" / "المسمى الوظيفي" is the DOCTOR's specialty. Seha often
        prints it truncated as "General" — treat it as "General
        Practitioner" / "طبيب عام".
      - Dates are DD-MM-YYYY in the Gregorian column and DD-MM-YYYY Hijri
        alongside. Take the GREGORIAN value and output as YYYY-MM-DD.
      - In a Statement-of-Visit (مشهد مراجعة), the admission and discharge
        rows glue the TIME after the date with a dash:
        "13-08-2026-10:03 AM". Split them: date → admissionDate/dischargeDate
        (YYYY-MM-DD), time → admissionTime/dischargeTime (12-hour
        "HH:MM AM/PM"). Never output the joined string in either field.
        Do NOT try to output a waiting period — the app derives it from
        the two times.
      - Visit type ("Visit Type" / "نوع الزيارة"; OCR variant "Visitn Type"):
        map to the clean value. Common OCR error: "عبادات" is a
        mis-recognition of "عيادات" (OutPatient) — output "عيادات" +
        "OutPatient", NOT the OCR letters.
      - License: numeric string after "رقم الترخيص" / "License".
      - Employer: the Arabic line under "Employer / جهة العمل" — the
        organisation name only.
      - OCR often REVERSES English names ("SHAMMARI AL. MARJI ABDULMAJEED"
        from Arabic "عبد المجيد مرجي الشمري"). When Arabic is present, treat
        it as the source of truth for word order and derive a natural
        English transliteration in the SAME order ("Abdulmajeed Marji
        Al-Shammari"). Do NOT copy the reversed English verbatim.

      ── FIELDS TO EXTRACT ──
      (use these exact keys; unknown fields → "")

      Single-value fields (extract as-is, never translate):
      - serviceNum: (Leave ID uppercase, e.g. GSL261..., PSL261..., CSL...) or ""
      - nationalID: (10-digit Saudi ID/Iqama, digits only) or ""
      - phone: (phone number, Saudi mobiles usually start with 05...) or ""
      - leaveId: (same value as serviceNum in shape B; else "")
      - admissionDate: (YYYY-MM-DD) or ""
      - dischargeDate: (YYYY-MM-DD) or ""
      - admissionTime: (12-hour, e.g. "10:03 AM") or "" — see shape B rules
      - dischargeTime: (12-hour, e.g. "11:07 AM") or "" — see shape B rules
      - issueDate: (YYYY-MM-DD) or ""
      - licenseNumber: (medical license number) or ""

      Bilingual fields — ALWAYS provide BOTH Arabic AND English:
      - name: (Patient name in ENGLISH — patient only, no titles like
        "المريض", "Mr.")
      - nameArabic: (Patient name in ARABIC)
      - doctorName: (Doctor name in ENGLISH — NAME ONLY; drop titles
        "د.", "الدكتور", "Dr.", "Prof."; never include specialty, badge or
        license)
      - doctorNameArabic: (Doctor name in ARABIC — same rule)
      - hospitalNameEnglish: (Facility name ONLY, in ENGLISH — the official
        facility line and nothing else. NEVER include: department ("قسم",
        "Department", "Ward"), reception, cashier ("الكاشير"), staff names,
        badge numbers, phone/fax, PO box, VAT, floor, address lines,
        vendor/ministry banners, URLs, or timestamps. If the source shows
        "مستشفى الملك فهد التخصصي — الكاشير: أحمد" the value is "King Fahad
        Specialist Hospital".)
      - hospitalNameArabic: (Same rule, in ARABIC — the facility name only)
      - physicianPosition: (Doctor specialty in ENGLISH — SPECIALTY ONLY,
        e.g. "General Practitioner"; not the doctor's name, not the
        department, and NOT the PATIENT's occupation from "اسم المهنة")
      - physicianPositionArabic: (Doctor specialty in ARABIC — same rule)
      - employer: (Employer / place of work — favour Arabic if present; the
        employer name only, not the address or phone)
      - nationality: (Patient nationality in ARABIC — e.g. 'السعودية', 'مصري')
      - visitTypeEnglish: (Visit type in ENGLISH — e.g. "OutPatient",
        "InPatient", "Emergency"; only for a Statement-of-Visit document;
        otherwise "")
      - visitTypeArabic: (Visit type in ARABIC — e.g. "عيادات" for
        outpatient, "منومين" for inpatient, "طوارئ" for emergency; only for
        a Statement-of-Visit document; otherwise "")

      ── BILINGUAL RULES ──
      For every bilingual field pair (Arabic + English):

      1. If ONLY Arabic is in the source text:
         - Keep the Arabic value as-is
         - Generate the English equivalent:
           • Personal names → natural transliteration (محمد تركي البلوي → Mohammed Turki Al-Balawi)
           • Titles/positions → standard English (طبيب عام → General Practitioner)
           • Hospital names → formal translation (مستشفى الملك فهد → King Fahad Hospital)
           • Nationality → keep Arabic for nationality field

      2. If ONLY English is in the source text:
         - Keep the English value as-is
         - Generate the Arabic equivalent

      3. If BOTH Arabic and English exist in the source:
         - Preserve both exactly as written — EXCEPT for names in shape B
           where the English side is OCR-reversed (see shape B rules).

      4. If NEITHER exists → return "" for both

      ── NAME RULES ──
      - Preserve the original word order. NEVER rearrange family names
        (except to fix an OCR reversal in shape B, using the Arabic order).
      - For "عبدالمجيد ... الشمري", output English as "Abdulmajeed ... Al-Shammari"
        NOT "Al-Shammari ... Abdulmajeed".
      - If the user already provides an English spelling AND it matches the
        Arabic word order, preserve it exactly.

      ── DATA INTEGRITY ──
      - NEVER invent missing information
      - NEVER fabricate ID numbers, phone numbers, or dates
      - If a field is missing from the text, return ""
      - Do NOT complete partial dates (year-only stays year-only; a bare
        day number stays absent — return "")

      Return ONLY the raw JSON object. No markdown, no code blocks, no explanation.

      Text to process:
      """
      ${clientInfo}
      """
    `;


    let text;
    try {
      // json:true asks the provider for a JSON object, so no markdown fences
      // have to be stripped off. The pool picks a working key/provider.
      const out = await llmGenerate(prompt, { json: true });
      text = out.text;
      console.log(`✅ AI extract via ${out.provider} model "${out.model}"`);
    } catch (err) {
      const status = err.httpStatus || (["NO_KEYS", "MALFORMED_KEY"].includes(err.code) ? 400 : 502);
      console.error("AI Extract failed:", err.code, err.message, err.details || "");
      return res.status(status).json({
        status_code: status,
        success: false,
        code: err.code,
        message: err.message || "تعذّر استخراج البيانات.",
        details: err.details,
        retry_at: err.retryAt || undefined,
      });
    }

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

    // ── Bilingual validation ────────────────────────────────────────────────
    // Safety net: if the AI returned Arabic but left English empty (or vice
    // versa) for a bilingual field pair, generate the missing side. This keeps
    // the extraction as ONE AI call in the happy path; only on failure does a
    // small repair call fire.
    const bilingualPairs = [
      { ar: "nameArabic",            en: "name",                 type: "name" },
      { ar: "doctorNameArabic",      en: "doctorName",           type: "name" },
      { ar: "hospitalNameArabic",    en: "hospitalNameEnglish",  type: "translate" },
      { ar: "physicianPositionArabic", en: "physicianPosition",  type: "translate" },
    ];

    const isArabic = (s) => /[\u0600-\u06FF]/.test(s);
    const repairPrompts = [];

    for (const pair of bilingualPairs) {
      const arVal = (extractedData[pair.ar] || "").trim();
      const enVal = (extractedData[pair.en] || "").trim();

      if (arVal && !enVal) {
        // Arabic exists, English missing — queue a repair
        repairPrompts.push({ key: pair.en, text: arVal, type: pair.type });
      } else if (enVal && !arVal && !isArabic(enVal)) {
        // English exists, Arabic missing — queue a repair
        repairPrompts.push({ key: pair.ar, text: enVal, type: pair.type === "name" ? "name_to_ar" : "translate_to_ar" });
      }
    }

    if (repairPrompts.length > 0) {
      try {
        const repairPrompt =
          `You are a bilingual Arabic-English assistant for Saudi medical forms.\n` +
          `For each item below, provide the translation/transliteration.\n` +
          `Return ONLY a JSON object with the numbered keys.\n\n` +
          repairPrompts.map((r, i) => {
            if (r.type === "name") return `${i}: Transliterate this Arabic name to English naturally (محمد → Mohammed): "${r.text}"`;
            if (r.type === "name_to_ar") return `${i}: Transliterate this English name to Arabic naturally (Mohammed → محمد): "${r.text}"`;
            if (r.type === "translate") return `${i}: Translate to standard English: "${r.text}"`;
            return `${i}: Translate to Arabic: "${r.text}"`;
          }).join("\n");

        const repairOut = await llmGenerate(repairPrompt, { json: true });
        const repairData = JSON.parse(repairOut.text.replace(/```json/g, "").replace(/```/g, "").trim());

        repairPrompts.forEach((r, i) => {
          const val = (repairData[String(i)] || "").trim();
          if (val) extractedData[r.key] = val;
        });
        console.log(`🔧 Bilingual repair: filled ${repairPrompts.length} missing field(s)`);
      } catch (repairErr) {
        console.warn("⚠️ Bilingual repair failed (non-fatal):", repairErr.message);
        // Non-fatal — the form will just have the Arabic side filled
      }
    }

    // ── Paste-to-Fill enrichment ───────────────────────────────────────────
    // Fill in everything the AI can't know so a single paste yields a complete,
    // ready-to-confirm record: identifiers, Hijri dates, duration, report stamp.
    const enriched = await enrichExtracted(extractedData);

    // الجنسية المستخرَجة تُوحَّد قبل أن تصل النموذج: «سعودي» بأي رسم (أو أي
    // مرادف إنجليزي) → «السعودية». فلا يعود «سعودي» إلى النظام من الاستخراج.
    if (enriched && Object.prototype.hasOwnProperty.call(enriched, "nationality")) {
      enriched.nationality = normalizeNationality(enriched.nationality);
    }

    return res.status(200).json({
      status_code: 200,
      success: true,
      data: enriched,
      message: "تم استخراج البيانات وتعبئتها بالكامل",
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

// ترجمة نص قصير (جنسية/حالة) بين العربية والإنجليزية باستخدام Gemini
module.exports.translate = async (req, res) => {
  try {
    const { text, to } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: "لا يوجد نص للترجمة" });
    }

    const { llmGenerate } = require("../utils/llm");
    const target = to === "ar" ? "Arabic" : "English";
    const prompt =
      `Translate the following nationality or residency-status term into ${target}. ` +
      `It is used on an official medical document, so use the standard/formal term. ` +
      `Return ONLY the translated term with no quotes, no explanation, no extra words.\n\n` +
      `Term: "${text.trim()}"`;

    const out = await llmGenerate(prompt);
    const translation = (out.text || "")
      .replace(/```/g, "")
      .replace(/^["'\s]+|["'\s]+$/g, "")
      .split("\n")[0]
      .trim();

    return res.status(200).json({ success: true, data: { translation } });
  } catch (error) {
    const status = error.httpStatus || (["NO_KEYS", "MALFORMED_KEY"].includes(error.code) ? 400 : 502);
    console.error("Translate failed:", error.code, error.message, error.details || "");
    return res.status(status).json({
      success: false,
      code: error.code,
      message: error.message || "تعذّرت الترجمة",
      details: error.details,
    });
  }
};

// Complete an AI-extracted record so the form needs no further typing:
// generate the service/leave identifiers, derive Hijri dates and the duration,
// and stamp the report time — all server-side where the converters already live.
async function enrichExtracted(data) {
  const out = { ...data };

  // Post-extraction cleanup: even a strict prompt occasionally lets adjacent
  // header noise (الكاشير, الاستقبال, department, badge, Dr. prefix …) leak
  // into a name value. Fix it here so what reaches the form is only what the
  // field is meant to hold. Only mutates strings that need it.
  const applyIfString = (key, fn) => {
    if (typeof out[key] === "string" && out[key]) out[key] = fn(out[key]);
  };
  applyIfString("hospitalNameArabic", sanitizeHospitalName);
  applyIfString("hospitalNameEnglish", sanitizeHospitalName);
  applyIfString("doctorName", sanitizePersonName);
  applyIfString("doctorNameArabic", sanitizePersonName);
  applyIfString("name", sanitizePersonName);
  applyIfString("nameArabic", sanitizePersonName);
  applyIfString("admissionTime", sanitizeTime);
  applyIfString("dischargeTime", sanitizeTime);
  applyIfString("visitTypeArabic", sanitizeVisitTypeArabic);
  applyIfString("visitTypeEnglish", sanitizeVisitTypeEnglish);
  if (out.nationalID) out.nationalID = sanitizeNationalId(out.nationalID);
  if (out.phone) out.phone = sanitizePhone(out.phone);

  // Identifiers: keep a valid extracted service number, else generate one.
  // leave_id is kept identical to service_num (same rule as addNewLeaves).
  let serviceNum = (out.serviceNum || "").trim();
  if (!isValidIdFormat(serviceNum)) serviceNum = await generateServiceNumber();
  out.serviceNum = serviceNum;
  out.leaveId = serviceNum;

  // Hijri equivalents for whatever Gregorian dates we have.
  if (out.admissionDate) out.admissionDateAr = config.convertDates(out.admissionDate);
  if (out.dischargeDate) out.dischargeDateAr = config.convertDates(out.dischargeDate);
  if (out.issueDate) out.issueDateAr = config.convertDates(out.issueDate);

  // Duration in days (inclusive), when both endpoints are present. calcDays
  // throws on a malformed date, so guard — a bad AI date must not fail the paste.
  if (out.admissionDate && out.dischargeDate) {
    try {
      const days = config.calcDays(out.admissionDate, out.dischargeDate);
      if (days) out.duration = String(days);
    } catch { /* leave duration for the user to complete */ }
  }

  // report_time / report_date are intentionally left for the form's own
  // formatting (and are stamped at save time if still empty) to avoid a
  // format mismatch with the time/date inputs.

  return out;
}

// Client memory: return the most recent record for a national id so a returning
// client's reusable details prefill instantly. Reads only stable identity fields
// (never the previous dates or service number).
module.exports.getClientByNationalId = async (req, res) => {
  try {
    const nationalId = (req.params.national_id || "").trim();
    if (!/^\d{6,}$/.test(nationalId)) {
      return res.status(400).json({ success: false, message: "رقم هوية غير صالح" });
    }

    const last = await leaves.findOne({
      where: { national_id: nationalId },
      order: [["createdAt", "DESC"]],
      include: [{ model: Country, as: "country", attributes: ["id", "country_name_ar", "country_name_en"] }],
    });

    if (!last) return res.status(200).json({ success: true, found: false, data: null });

    const total = await leaves.count({ where: { national_id: nationalId } });

    return res.status(200).json({
      success: true,
      found: true,
      data: {
        name: last.name_en || "",
        nameArabic: last.name_ar || "",
        phone: last.phone || "",
        nationality: (last.country && last.country.country_name_ar) || last.nationality || "",
        countryId: last.countryId || null,
        employer: last.employer_ar || last.employer_en || "",
        physicianPosition: last.position_en || "",
        physicianPositionArabic: last.position_ar || "",
        doctorName: last.physician_name_en || "",
        doctorNameArabic: last.physician_name_ar || "",
        hospitalNameEnglish: last.hospital_name_en || "",
        hospitalNameArabic: last.hospital_name_ar || "",
        licenseNumber: last.license_number || "",
        previousRequests: total,
        lastRequestAt: last.createdAt,
      },
    });
  } catch (error) {
    console.error("getClientByNationalId failed:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// Helper Functions
// ============================================

// template_data كائن حرّ يأتي من العميل. نقبله ككائن مسطّح بقيم بسيطة فقط
// (نص/منطقي/رقم) وبحدّ لطول النص، فلا يُخزَّن فيه شيء غير متوقّع. الصور
// تصل كـ data URI أو رابط، وكلاهما نص.
function sanitizeTemplateData(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (typeof k !== 'string' || k.length > 64) continue;
    if (typeof v === 'boolean' || typeof v === 'number') out[k] = v;
    else if (typeof v === 'string') out[k] = v.length > 2_000_000 ? v.slice(0, 2_000_000) : v;
    // أي شيء آخر (كائنات/مصفوفات/دوال) يُتجاهل عمداً.
  }
  return out;
}

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
    'Filipino', 'Ethiopian', 'السعودية', 'مصري', 'سوري', 'أردني', 'لبناني',
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
    const leave_days = resolveLeaveDays(leave);
    console.log('📊 Leave days:', leave_days);

    // Get country details
    const country = await Country.findOne({
      where: { id: leave.countryId }
    });
    console.log('🌍 Country:', country ? country.country_name_en : 'Not found');

    // Generate PDF in memory (as buffer)
    const DateObj = getFormattedDateTime();
    console.log('📅 Date Object:', DateObj);

    // اختيار القالب حسب نوع المستند من السجلّ الموحّد — الافتراضي (وكل السجلات
    // القديمة بلا قيمة) إجازة مرضية. إضافة قالب جديد لا تتطلّب أي تعديل هنا.
    const documentType = normalizeDocumentType(leave.document_type);
    const renderPdf = config[rendererNameFor(documentType)];
    console.log('🔄 Generating PDF...', `(${documentType})`);
    const pdfBuffer = await renderPdf(
      leave.dataValues,
      leave_days,
      DateObj,
      country
    );
    console.log('✅ PDF generated, size:', pdfBuffer.length, 'bytes');

    // Send PDF buffer directly to user
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="sickLeaves.pdf"');
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

// معاينة صورة المصغّرة قبل الإرسال — تُعيد الـ JPEG نفسها التي سترافق الرسالة،
// فيمكن ضبط WHATSAPP_THUMB_WIDTH / _BLUR / _QUALITY ورؤية الأثر فوراً بلا
// إرسال أي رسالة. لا علاقة لها بالملف: الـ PDF يُقرأ فقط ولا يُعدَّل.
module.exports.previewWhatsappThumbnail = async (req, res) => {
  try {
    const { service_num, national_id } = req.params;
    const leave = await leaves.findOne({
      where: { service_num, national_id },
      include: [{ model: Country, as: 'country' }],
    });
    if (!leave) {
      return res.status(404).json({ status_code: 404, success: false, message: 'لم يتم العثور على الإجازة المرضية' });
    }

    const leave_days = resolveLeaveDays(leave);
    const country = await Country.findOne({ where: { id: leave.countryId } });
    const renderPdf = config[rendererNameFor(normalizeDocumentType(leave.document_type))];
    const pdfBuffer = await renderPdf(leave.dataValues, leave_days, getFormattedDateTime(), country);

    const buildThumbnail = require('../middlewares/whatsappThumbnail');
    const thumb = await buildThumbnail(pdfBuffer);

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Length', thumb.buffer.length);
    res.setHeader('X-Thumbnail-Size', `${thumb.width}x${thumb.height}`);
    return res.send(thumb.buffer);
  } catch (error) {
    console.error('❌ WhatsApp thumbnail preview error:', error);
    return res.status(500).json({ status_code: 500, success: false, message: error.message });
  }
};

// ───────────────────────────────────────────────────────────────────────────
// إرسال التقرير عبر واتساب من الخادم.
//
// هذه هي نقطة التحكّم الوحيدة في صورة معاينة المستند داخل المحادثة: عندما يبني
// الخادم الرسالة بنفسه يستطيع تمرير jpegThumbnail خاصة به (مموّهة)، بينما تبقى
// بايتات الـ PDF كما هي حرفياً — فيُفتح الملف لدى المستلم بجودته الأصلية كاملة.
// عبر navigator.share في المتصفح هذا مستحيل: واتساب هو من يبني الرسالة ويولّد
// المعاينة بنفسه.
//
// الوجهة الافتراضية هي رقمنا نحن (WHATSAPP_SELF_NUMBER) ليقوم الموظف بإعادة
// توجيه الرسالة للزبون — وإعادة التوجيه تنقل المصغّرة كما هي ولا تعيد توليدها.
// ويمكن الإرسال مباشرة لرقم الزبون المحفوظ في السجل بـ target=customer.
// ───────────────────────────────────────────────────────────────────────────
module.exports.sendPdfToWhatsapp = async (req, res) => {
  try {
    const whatsapp = require('../utils/whatsappSender');
    if (!whatsapp.isEnabled()) {
      return res.status(503).json({
        status_code: 503,
        success: false,
        message: 'خدمة الإرسال عبر واتساب غير مفعّلة على الخادم',
      });
    }

    const { service_num, national_id } = req.params;
    const { target = 'self', to } = req.body || {};

    const leave = await leaves.findOne({
      where: { service_num, national_id },
      include: [{ model: Country, as: 'country' }],
    });
    if (!leave) {
      return res.status(404).json({
        status_code: 404, success: false, message: 'لم يتم العثور على الإجازة المرضية',
      });
    }

    // اختيار المستلم: رقم صريح، أو رقم الزبون المحفوظ، أو رقمنا (الافتراضي).
    const destination = to
      || (target === 'customer' ? leave.phone : process.env.WHATSAPP_SELF_NUMBER);
    if (!destination) {
      return res.status(400).json({
        status_code: 400, success: false,
        message: target === 'customer'
          ? 'لا يوجد رقم جوال محفوظ لهذا الزبون'
          : 'لم يُضبط رقم الاستقبال WHATSAPP_SELF_NUMBER على الخادم',
      });
    }

    // نفس مسار توليد الـ PDF المستخدم في التنزيل — بلا أي اختلاف.
    const leave_days = resolveLeaveDays(leave);
    const country = await Country.findOne({ where: { id: leave.countryId } });
    const DateObj = getFormattedDateTime();
    const renderPdf = config[rendererNameFor(normalizeDocumentType(leave.document_type))];
    const pdfBuffer = await renderPdf(leave.dataValues, leave_days, DateObj, country);

    // المصغّرة تُبنى بقراءة الصفحة الأولى فقط — الملف لا يُعدَّل إطلاقاً.
    let thumbnail = null;
    try {
      const buildThumbnail = require('../middlewares/whatsappThumbnail');
      const t = await buildThumbnail(pdfBuffer);
      thumbnail = t.buffer;
      console.log(`[WA] THUMBNAIL_BUILT ${t.width}x${t.height} bytes=${t.buffer.length} q=${t.quality} pdfBytes=${pdfBuffer.length}`);
    } catch (thumbErr) {
      // فشل «مفتوح»: نرسل الملف بلا مصغّرة مخصّصة بدل ألا نرسل شيئاً.
      console.error(`[WA] THUMBNAIL_ERROR msg=${thumbErr.message}`);
    }

    console.log(`[WA] SEND_START to=${destination} pdfBytes=${pdfBuffer.length} thumb=${thumbnail ? thumbnail.length : 0}`);
    const sent = await whatsapp.sendDocument({
      to: destination,
      pdfBuffer,                 // كما خرج من المولّد، بايت ببايت
      fileName: 'sickLeaves.pdf',
      thumbnail,
    });

    console.log(`[WA] SEND_OK messageId=${sent.id} to=${sent.to}`);
    return res.status(200).json({
      status_code: 200,
      success: true,
      data: { messageId: sent.id, to: sent.to, thumbnailBytes: thumbnail ? thumbnail.length : 0 },
      message: 'تم إرسال التقرير عبر واتساب',
    });
  } catch (error) {
    console.error(`[WA] SEND_ERROR msg=${error.message}`);
    console.error(`[WA] SEND_ERROR_AT ${String(error.stack).split('\n')[1]?.trim() || 'n/a'}`);
    return res.status(500).json({
      status_code: 500, success: false, message: error.message,
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

// ───────────────────────────────────────────────────────────────────────────
// معاينة القالب الخامس: يولّد الـ PDF من بيانات مُرسَلة في الطلب مباشرةً بلا
// أي قراءة أو كتابة في قاعدة البيانات. تحتاجه المعاينة في الواجهة لأن القالب
// الخامس هو ملف PDF أصلي تُحقن فيه البيانات — فالمعاينة الصادقة الوحيدة هي
// الملف نفسه، لا محاكاةٌ له بـ HTML.
// ───────────────────────────────────────────────────────────────────────────
module.exports.previewTemplate5 = async (req, res) => {
  try {
    const { renderTemplate5Pdf } = require("../templates/template5");
    const data = (req.body && req.body.data) || req.body || {};
    const now = getFormattedDateTime();
    const pdfBuffer = await renderTemplate5Pdf({
      data,
      leaveDays: data.leave_days,
      country: data.country,
      reportDate: data.report_date || now.currentDate,
      reportTime: data.report_time || now.currentTime,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'inline; filename="template5-preview.pdf"');
    res.setHeader("Content-Length", pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error("❌ Template-5 preview error:", error);
    return res.status(500).json({
      status_code: 500,
      success: false,
      message: error.message,
    });
  }
};

// ───────────────────────────────────────────────────────────────────────────
// دوال داخلية مكشوفة للاختبار فقط (نفس نمط middlewares/generatePdf.js).
// لا تُستدعى من أي مسار في التطبيق — وجودها هنا يسمح باختبار قواعد «طريقة
// التاريخ» ومدة الإجازة مباشرةً بدل إعادة كتابتها في الاختبار.
// ───────────────────────────────────────────────────────────────────────────
module.exports._internals = {
  normalizeDateMode,
  normalizeLeaveDaysOverride,
  resolveLeaveDays,
};
