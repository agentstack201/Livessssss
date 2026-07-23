const Setting = require("../models/settings.model");

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
