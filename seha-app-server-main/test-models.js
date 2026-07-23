require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function listModels() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("❌ No API Key found in .env");
        return;
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        // The SDK doesn't have a direct 'listModels' in the same way, 
        // but the underlying API does. We'll try to fetch it via a raw request or 
        // check if there's a helper. Actually, the SDK 0.24.1 might have it.

        // Alternative: Try gemini-1.5-flash-latest
        const modelsToTry = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-1.5-flash-002", "gemini-1.5-flash-latest"];

        for (const m of modelsToTry) {
            try {
                const model = genAI.getGenerativeModel({ model: m });
                const res = await model.generateContent("test");
                console.log(`✅ Success with ${m}`);
                return;
            } catch (e) {
                console.log(`❌ ${m}: ${e.message}`);
            }
        }

    } catch (error) {
        console.error("error:", error);
    }
}

listModels();
