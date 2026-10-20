const Setting = require("../models/settings.model");
const tribute = require("../utils/loginTribute");

// Get all settings
exports.getAllSettings = async (req, res) => {
    try {
        const settings = await Setting.findAll();
        return res.status(200).json({
            success: true,
            data: settings,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error fetching settings",
            error: error.message,
        });
    }
};

// Get setting by key
exports.getSettingByKey = async (req, res) => {
    try {
        const { key } = req.params;
        const setting = await Setting.findOne({ where: { key } });

        if (!setting) {
            return res.status(404).json({
                success: false,
                message: "Setting not found",
            });
        }

        return res.status(200).json({
            success: true,
            data: setting,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error fetching setting",
            error: error.message,
        });
    }
};

// Update or Create setting
exports.updateSetting = async (req, res) => {
    try {
        const { key, value, description } = req.body;

        if (!key) {
            return res.status(400).json({
                success: false,
                message: "Key is required",
            });
        }

        // إعداد التكريم له مسار مخصص يتحقق من القيم والصلاحية؛ لا يُكتب من هنا.
        if (String(key).trim().toLowerCase() === tribute.SETTING_KEY) {
            return res.status(400).json({
                success: false,
                message: "إعداد التكريم الملكي لا يُحفظ من هنا — استخدم المسار المخصص PUT /settings/login-tribute",
            });
        }

        let setting = await Setting.findOne({ where: { key } });

        if (setting) {
            setting.value = value;
            if (description) setting.description = description;
            await setting.save();
        } else {
            setting = await Setting.create({ key, value, description });
        }

        return res.status(200).json({
            success: true,
            message: "Setting saved successfully",
            data: setting,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error saving setting",
            error: error.message,
        });
    }
};

// Helper function to get value internally
exports.getSettingValue = async (key) => {
    try {
        const setting = await Setting.findOne({ where: { key } });
        return setting ? setting.value : null;
    } catch (error) {
        console.error(`Error getting setting ${key}:`, error);
        return null;
    }
};

// ── التكريم الملكي في صفحة الدخول ─────────────────────────────────────────

// قراءة عامة بلا مصادقة — صفحة الدخول تطلبها قبل تسجيل الدخول.
exports.getLoginTribute = async (req, res) => {
    res.set("Cache-Control", "no-store");
    try {
        const config = await tribute.readConfig();
        const data = await tribute.publicView(config);
        return res.status(200).json({ success: true, data });
    } catch (error) {
        console.error("Login tribute read failed:", error);
        return res.status(500).json({
            success: false,
            message: "تعذّر جلب إعدادات التكريم",
        });
    }
};

// صورة/صوت التكريم — يُخدم الملف المحفوظ في الإعداد فقط، لا أي رقم يرسله الزائر.
exports.getLoginTributeMedia = async (req, res) => {
    const { kind } = req.params;
    const notFound = () =>
        res.status(404).json({
            success: false,
            message: kind === "audio" ? "لا يوجد ملف صوتي للتكريم" : "لا توجد صورة للتكريم",
        });

    // Express 5 لا يدعم القيود النمطية في المعاملات، فنتحقق هنا.
    if (!Object.prototype.hasOwnProperty.call(tribute.MEDIA_KINDS, kind)) return notFound();

    try {
        const body = await tribute.loadMediaBody(kind);
        if (!body) return notFound();
        if (body.redirect) {
            res.set("Cache-Control", "public, max-age=300");
            return res.redirect(302, body.redirect);
        }
        return tribute.sendMediaBytes(req, res, body.buffer, body.mime);
    } catch (error) {
        console.error(`Login tribute ${kind} failed:`, error);
        return res.status(500).json({
            success: false,
            message: "تعذّر جلب ملف التكريم",
        });
    }
};

// حفظ الإعداد (يتطلب can_manage_settings): تحقق صارم ثم حفظ ما أُرسل فقط.
exports.saveLoginTribute = async (req, res) => {
    let config;
    try {
        config = tribute.sanitize(req.body, { strict: true });
    } catch (error) {
        if (error instanceof tribute.TributeValidationError) {
            return res.status(400).json({ success: false, message: error.message, field: error.field });
        }
        throw error;
    }

    try {
        for (const kind of Object.keys(tribute.MEDIA_KINDS)) {
            const id = config[kind] && config[kind].mediaId;
            if (!id) continue;
            const check = await tribute.inspectMedia(kind, id);
            if (!check.ok) {
                return res.status(400).json({
                    success: false,
                    message: check.message,
                    field: `${kind}.mediaId`,
                });
            }
        }

        const stored = await tribute.saveConfig(config);
        const data = await tribute.publicView(stored);
        res.set("Cache-Control", "no-store");
        return res.status(200).json({
            success: true,
            message: "تم حفظ إعدادات التكريم",
            data,
        });
    } catch (error) {
        console.error("Login tribute save failed:", error);
        return res.status(500).json({
            success: false,
            message: "حدث خطأ أثناء حفظ إعدادات التكريم",
            error: error.message,
        });
    }
};
