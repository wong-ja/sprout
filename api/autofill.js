// jina reader fetch job listing --> send cleaned txt to Gemini, return JSON for job fields
function parseBody(req) {
    return new Promise((resolve, reject) => {
        if (req.body && typeof req.body === "object") return resolve(req.body);
        let raw = "";
        req.on("data", chunk => { raw += chunk; });
        req.on("end", () => {
            try { resolve(raw ? JSON.parse(raw) : {}); }
            catch { reject(new Error("Invalid JSON in request body.")); }
        });
        req.on("error", reject);
    });
}

function cleanPastedText(raw) {
    const DROP = [
        /equal opportunity employer/i,
        /eeo statement/i,
        /without regard to race|color|religion|sex|national origin/i,
        /affirmative action/i,
        /we do not discriminate/i,
        /reasonable accommodat/i,
        /disability.{0,30}veteran/i,
        /privacy policy/i,
        /cookie policy/i,
        /terms of (use|service)/i,
        /all rights reserved/i,
        /copyright ©?\s*\d{4}/i,
        /drug.free workplace/i,
        /background check(s)? (may|will) be (required|conducted)/i,
        /compensation (may|will) vary/i,
        /\bnavigation\b/i,
        /skip to (main|content)/i,
        /^(home|about|careers|jobs|login|sign in|sign up|apply now)$/i,
    ];

    const lines = raw
        .split("\n")
        .map(l => l.trim())
        .filter(l => l.length > 8)
        .filter(l => !DROP.some(re => re.test(l)));

    return lines.join("\n").slice(0, 5000);
}

export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

    let body;
    try {
        body = await parseBody(req);
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }

    const { mode, url, text, userApiKey } = body;

    // jina reader - fetch job data
    if (mode === "fetch-url") {
        if (!url || typeof url !== "string") {
            return res.status(400).json({ error: "Missing or invalid url." });
        }

        try {
            const jinaRes = await fetch(`https://r.jina.ai/${url.trim()}`, {
                headers: { "Accept": "text/plain, text/markdown, */*", "X-Return-Format": "text" },
            });

            if (!jinaRes.ok) {
                return res.status(jinaRes.status).json({
                    error: `Could not fetch that page (${jinaRes.status}). Try pasting the description instead.`,
                });
            }

            const raw = await jinaRes.text();
            const cleaned = raw.trim().slice(0, 5000);

            if (!cleaned) {
                return res.status(422).json({
                    error: "The page returned no readable content. Try pasting the description instead.",
                });
            }

            return res.status(200).json({ text: cleaned });
        } catch (err) {
            return res.status(500).json({
                error: `Could not reach that URL: ${err.message}. Try pasting the description instead.`,
            });
        }
    }

    // extract fields via Gemini
    if (mode === "extract") {
        const apiKey = process.env.GEMINI_API_KEY || userApiKey;

        if (!apiKey) {
            return res.status(400).json({
                error: "No Gemini API key available. Add your free key in the autofill panel, or use paste mode without a key.",
            });
        }

        if (!text || typeof text !== "string") {
            return res.status(400).json({ error: "Missing text to extract from." });
        }

        const prompt = `You are a job listing parser. Extract the following fields from the job posting text below.
Return ONLY valid JSON with these exact keys (empty string if unknown):
company, role, location, workMode, jobType, industry, salary, description, requirements (array, only include values from: Resume / CV, Cover Letter, Portfolio, References, Writing Sample, Work Sample, Assessment / Test, Transcript, Background Check, Video Introduction, LinkedIn Profile, GitHub Profile, Personal Website), tags (array of 3-5 short relevant keywords).

Job posting:
---
${text}
---

Respond with JSON only. No markdown fences, no explanation.`;

        try {
            const geminiRes = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
                    }),
                }
            );

            const geminiData = await geminiRes.json();

            if (!geminiRes.ok) {
                const code = geminiData?.error?.code ?? geminiRes.status;
                const msg    = geminiData?.error?.message ?? "Unknown Gemini error.";
                if (code === 429) return res.status(429).json({ error: "Gemini rate limit reached. Wait a moment and try again, or use paste mode without a key." });
                if (code === 400) return res.status(400).json({ error: "Text may still be too long for Gemini. Try pasting a shorter excerpt." });
                return res.status(geminiRes.status).json({ error: msg });
            }

            return res.status(200).json(geminiData);
        } catch (err) {
            return res.status(500).json({ error: `Gemini request failed: ${err.message}` });
        }
    }

    return res.status(400).json({ error: "Invalid mode. Expected 'fetch-url' or 'extract'." });
}