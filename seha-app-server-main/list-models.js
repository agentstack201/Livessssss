require("dotenv").config();
const https = require('https');

async function checkModels() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return console.log("No API Key");

    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

    https.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
            try {
                const json = JSON.parse(data);
                if (json.models) {
                    console.log("Available Models:");
                    json.models.forEach(m => console.log(`- ${m.name}`));
                } else {
                    console.log("No models found or error:", json);
                }
            } catch (e) {
                console.log("Parse error:", e.message);
                console.log("Raw data:", data);
            }
        });
    }).on('error', (err) => {
        console.log("Request error:", err.message);
    });
}

checkModels();
