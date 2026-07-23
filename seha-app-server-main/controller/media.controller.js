const path = require("path");
const fs = require("fs");
const { Op } = require("sequelize");
const { createClient } = require("@supabase/supabase-js");

// إعداد Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// اسم الـ Bucket
const BUCKET_NAME = "media";

// التحقق من البيئة
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;

// مجلد التخزين المحلي (للبيئة المحلية فقط)
const UPLOAD_DIR = path.join(__dirname, "../public/uploads");

// التأكد من وجود مجلد التحميل (محلياً فقط)
if (!isVercel) {
  try {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
  } catch (err) {
    console.log("Cannot create upload directory:", err.message);
  }
}

// استيراد Model بشكل آمن
let Media;
try {
  Media = require("../models/media.model");
} catch (error) {
  console.error("Failed to load Media model:", error.message);
  Media = null;
}

// دالة رفع ملف إلى Supabase Storage
async function uploadToSupabase(file) {
  try {
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    const filePath = `uploads/${filename}`;
    
    // الحصول على محتوى الملف
    let fileBuffer;
    if (file.buffer) {
      // من memory storage
      fileBuffer = file.buffer;
    } else if (file.path) {
      // من disk storage
      fileBuffer = fs.readFileSync(file.path);
    } else {
      throw new Error("No file content available");
    }

    // رفع الملف إلى Supabase
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, fileBuffer, {
        contentType: file.mimetype,
        upsert: false
      });

    if (error) {
      console.error("Supabase upload error:", error);
      throw error;
    }

    // الحصول على الرابط العام
    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    return {
      filename,
      path: filePath,
      url: publicUrlData.publicUrl,
      supabasePath: data.path
    };
  } catch (error) {
    console.error("Upload to Supabase failed:", error);
    throw error;
  }
}

// دالة حذف ملف من Supabase Storage
async function deleteFromSupabase(filePath) {
  try {
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath]);

    if (error) {
      console.error("Supabase delete error:", error);
    }
  } catch (error) {
    console.error("Delete from Supabase failed:", error);
  }
}

// رفع ملف جديد
module.exports.uploadMedia = async (req, res) => {
  try {
    if (!Media) {
      return res.status(503).json({
        success: false,
        message: "خدمة الوسائط غير متاحة حالياً",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "لم يتم اختيار ملف للرفع",
      });
    }

    const { alt_text, category } = req.body;
    const file = req.file;

    // رفع الملف إلى Supabase
    const uploadResult = await uploadToSupabase(file);

    // إنشاء سجل في قاعدة البيانات
    const media = await Media.create({
      filename: uploadResult.filename,
      original_name: file.originalname,
      mime_type: file.mimetype,
      size: file.size,
      path: uploadResult.path,
      url: uploadResult.url,
      alt_text: alt_text || file.originalname,
      category: category || "general",
      uploaded_by: req.user?.name || "system",
    });

    return res.status(201).json({
      success: true,
      message: "تم رفع الملف بنجاح",
      data: media,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return res.status(500).json({
      success: false,
      message: "حدث خطأ أثناء رفع الملف",
      error: error.message,
    });
  }
};

// رفع ملفات متعددة
module.exports.uploadMultipleMedia = async (req, res) => {
  try {
    if (!Media) {
      return res.status(503).json({
        success: false,
        message: "خدمة الوسائط غير متاحة حالياً",
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "لم يتم اختيار ملفات للرفع",
      });
    }

    const { category } = req.body;
    const uploadedMedia = [];

    for (const file of req.files) {
      // رفع الملف إلى Supabase
      const uploadResult = await uploadToSupabase(file);
      
      const media = await Media.create({
        filename: uploadResult.filename,
        original_name: file.originalname,
        mime_type: file.mimetype,
        size: file.size,
        path: uploadResult.path,
        url: uploadResult.url,
        alt_text: file.originalname,
        category: category || "general",
        uploaded_by: req.user?.name || "system",
      });
      uploadedMedia.push(media);
    }

    return res.status(201).json({
      success: true,
      message: `تم رفع ${uploadedMedia.length} ملف بنجاح`,
      data: uploadedMedia,
    });
  } catch (error) {
    console.error("Multiple upload error:", error);
    return res.status(500).json({
      success: false,
      message: "حدث خطأ أثناء رفع الملفات",
      error: error.message,
    });
  }
};

// جلب جميع الوسائط
module.exports.getAllMedia = async (req, res) => {
  try {
    if (!Media) {
      return res.status(200).json({
        success: true,
        data: [],
        pagination: {
          total: 0,
          page: 1,
          limit: 20,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
      });
    }

    const { page = 1, limit = 20, category, search, type } = req.query;
    const offset = (page - 1) * limit;

    // بناء شروط البحث
    const whereConditions = {};

    if (category && category !== "all") {
      whereConditions.category = category;
    }

    if (type && type !== "all") {
      whereConditions.mime_type = { [Op.like]: `${type}%` };
    }

    if (search) {
      whereConditions[Op.or] = [
        { original_name: { [Op.like]: `%${search}%` } },
        { alt_text: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows: media } = await Media.findAndCountAll({
      where: whereConditions,
      order: [["createdAt", "DESC"]],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    return res.status(200).json({
      success: true,
      data: media,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
        hasNext: page * limit < count,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error("Get media error:", error);
    return res.status(500).json({
      success: false,
      message: "حدث خطأ أثناء جلب الوسائط",
      error: error.message,
    });
  }
};

// جلب ملف واحد
module.exports.getMediaById = async (req, res) => {
  try {
    if (!Media) {
      return res.status(404).json({ success: false, message: "الملف غير موجود" });
    }

    const { id } = req.params;
    const media = await Media.findByPk(id);

    if (!media) {
      return res.status(404).json({
        success: false,
        message: "الملف غير موجود",
      });
    }

    return res.status(200).json({
      success: true,
      data: media,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "حدث خطأ أثناء جلب الملف",
      error: error.message,
    });
  }
};

// تحديث معلومات الملف
module.exports.updateMedia = async (req, res) => {
  try {
    if (!Media) {
      return res.status(404).json({ success: false, message: "الملف غير موجود" });
    }

    const { id } = req.params;
    const { alt_text, category } = req.body;

    const media = await Media.findByPk(id);

    if (!media) {
      return res.status(404).json({
        success: false,
        message: "الملف غير موجود",
      });
    }

    await media.update({
      alt_text: alt_text ?? media.alt_text,
      category: category ?? media.category,
    });

    return res.status(200).json({
      success: true,
      message: "تم تحديث معلومات الملف بنجاح",
      data: media,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "حدث خطأ أثناء تحديث الملف",
      error: error.message,
    });
  }
};

// حذف ملف
module.exports.deleteMedia = async (req, res) => {
  try {
    if (!Media) {
      return res.status(404).json({ success: false, message: "الملف غير موجود" });
    }

    const { id } = req.params;
    const media = await Media.findByPk(id);

    if (!media) {
      return res.status(404).json({
        success: false,
        message: "الملف غير موجود",
      });
    }

    // حذف الملف من Supabase Storage
    await deleteFromSupabase(media.path);

    // حذف السجل من قاعدة البيانات
    await media.destroy();

    return res.status(200).json({
      success: true,
      message: "تم حذف الملف بنجاح",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "حدث خطأ أثناء حذف الملف",
      error: error.message,
    });
  }
};

// حذف ملفات متعددة
module.exports.deleteMultipleMedia = async (req, res) => {
  try {
    if (!Media) {
      return res.status(200).json({ success: true, message: "لم يتم حذف أي ملف" });
    }

    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "يرجى تحديد الملفات المراد حذفها",
      });
    }

    const media = await Media.findAll({
      where: { id: { [Op.in]: ids } },
    });

    // حذف الملفات من Supabase Storage
    for (const file of media) {
      await deleteFromSupabase(file.path);
    }

    await Media.destroy({
      where: { id: { [Op.in]: ids } },
    });

    return res.status(200).json({
      success: true,
      message: `تم حذف ${media.length} ملف بنجاح`,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "حدث خطأ أثناء حذف الملفات",
      error: error.message,
    });
  }
};

// جلب إحصائيات الوسائط
module.exports.getMediaStats = async (req, res) => {
  try {
    if (!Media) {
      return res.status(200).json({
        success: true,
        data: {
          totalCount: 0,
          totalSize: 0,
          totalSizeFormatted: "0 Bytes",
          categoryStats: [],
          typeStats: [],
        },
      });
    }

    const totalCount = await Media.count();
    const totalSize = await Media.sum("size") || 0;

    const categoryStats = await Media.findAll({
      attributes: [
        "category",
        [require("sequelize").fn("COUNT", require("sequelize").col("id")), "count"],
      ],
      group: ["category"],
    });

    const typeStats = await Media.findAll({
      attributes: [
        "mime_type",
        [require("sequelize").fn("COUNT", require("sequelize").col("id")), "count"],
      ],
      group: ["mime_type"],
    });

    return res.status(200).json({
      success: true,
      data: {
        totalCount,
        totalSize,
        totalSizeFormatted: formatBytes(totalSize),
        categoryStats,
        typeStats,
      },
    });
  } catch (error) {
    console.error("Stats error:", error);
    return res.status(500).json({
      success: false,
      message: "حدث خطأ أثناء جلب الإحصائيات",
      error: error.message,
    });
  }
};

// دالة تنسيق حجم الملف
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}
