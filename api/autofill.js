// autofill serverless function (Vercel)

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


function buildPrompt(text) {
    return `You are a job listing parser. Extract fields from the job posting below.
Return ONLY valid JSON with these exact keys (empty string if unknown):
company, role, location, workMode, jobType, industry, salary, description,
requirements (array, only include values from this list: Resume / CV, Cover Letter, Portfolio, References, Writing Sample, Work Sample, Assessment / Test, Transcript, Background Check, Video Introduction, LinkedIn Profile, GitHub Profile, Personal Website),
tags (array of 3-5 short lowercase keywords).
workMode must be one of: Remote, Hybrid, On-site, Flexible, or empty string.
jobType must be one of: Full-time, Part-time, Contract, Freelance, Internship, Temporary, Volunteer, or empty string.
Job posting:
---
${text}
---
JSON only. No markdown fences. No explanation.`;
}


function extractFieldsFromProvider(data, provider) {
    let raw = "";
    if (provider === "openrouter") {
        raw = data?.choices?.[0]?.message?.content ?? "";
    } else {
        raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    }
    // strip <think>...</think> reasoning blocks (DeepSeek R1, QwQ, etc.)
    let clean = raw.replace(/<think>[\s\S]*?<\/think>/gi, "");
    // strip markdown fences
    clean = clean.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    // find the outermost { ... } block — handles preamble/postamble text
    const start = clean.indexOf("{");
    const end   = clean.lastIndexOf("}");
    if (start === -1 || end === -1 || end < start) {
        throw new SyntaxError(`No JSON object found in LLM response. Raw: ${raw.slice(0, 200)}`);
    }
    return JSON.parse(clean.slice(start, end + 1));
}


// try OpenRouter - returns { fields } on success, throws { is429, message } on failure
async function tryOpenRouter(text, apiKey) {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            // llama-3.3-70b: stable free model, clean JSON output, no thinking tokens
            model: "meta-llama/llama-3.3-70b-instruct:free",
            messages: [{ role: "user", content: buildPrompt(text) }],
            temperature: 0.1,
            max_tokens: 1024,
        }),
    });
    const data = await r.json();
    if (!r.ok) {
        const msg = data?.error?.metadata?.raw ?? data?.error?.message ?? `OpenRouter error ${r.status}`;
        throw Object.assign(new Error(msg), { is429: r.status === 429 });
    }
    return extractFieldsFromProvider(data, "openrouter");
}


// try Gemini - returns { fields } on success, throws { is429, message } on failure
async function tryGemini(text, apiKey) {
    // gemini-2.0-flash-lite: separate quota pool, 30 RPM / 1500 RPD free tier
    const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: buildPrompt(text) }] }],
                generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
            }),
        }
    );
    const data = await r.json();
    if (!r.ok) {
        const msg = data?.error?.message ?? `Gemini error ${r.status}`;
        throw Object.assign(new Error(msg), { is429: r.status === 429 });
    }
    return extractFieldsFromProvider(data, "gemini");
}


export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

    let body;
    try { body = await parseBody(req); }
    catch (err) { return res.status(400).json({ error: err.message }); }

    const { mode, url, text, userOrKey, userGeminiKey } = body;

    // fetch-url: proxy through jina reader
    if (mode === "fetch-url") {
        if (!url) return res.status(400).json({ error: "Missing url." });
        try {
            const r = await fetch(`https://r.jina.ai/${url.trim()}`, {
                headers: { "Accept": "text/plain, text/markdown, */*", "X-Return-Format": "text" },
            });
            if (!r.ok) return res.status(r.status).json({ error: `Could not fetch that page (${r.status}). Try pasting instead.` });
            const raw = await r.text();
            const cleaned = raw.trim().slice(0, 5000);
            if (!cleaned) return res.status(422).json({ error: "Page returned no readable content. Try pasting instead." });
            return res.status(200).json({ text: cleaned });
        } catch (err) {
            return res.status(500).json({ error: `Fetch failed: ${err.message}. Try pasting instead.` });
        }
    }

    // extract: try providers in order, fall back automatically on 429
    if (mode === "extract") {
        if (!text) return res.status(400).json({ error: "Missing text." });

        const orKey     = process.env.OPENROUTER_KEY || userOrKey || "";
        const geminiKey = process.env.GEMINI_API_KEY  || userGeminiKey || "";

        if (!orKey && !geminiKey) {
            return res.status(400).json({
                error: "No API key available. Add your free OpenRouter or Gemini key in Settings.",
            });
        }

        const errors = [];

        // try OpenRouter first
        if (orKey) {
            try {
                const fields = await tryOpenRouter(text, orKey);
                return res.status(200).json({ fields });
            } catch (err) {
                errors.push(`OpenRouter: ${err.message}`);
                if (!err.is429) {
                    // non-429 error (bad key, malformed response, etc.) - surface it directly
                    return res.status(500).json({ error: err.message });
                }
                // 429 - fall through to Gemini
            }
        }

        // fall back to Gemini
        if (geminiKey) {
            try {
                const fields = await tryGemini(text, geminiKey);
                return res.status(200).json({ fields });
            } catch (err) {
                errors.push(`Gemini: ${err.message}`);
                if (!err.is429) {
                    return res.status(500).json({ error: err.message });
                }
                // both 429 - fall through to error response
            }
        }

        // both providers exhausted
        return res.status(429).json({
            error: "Both AI providers are rate limited right now. Free tiers reset daily — try again later, or paste the description and use local fill instead.",
        });
    }

    return res.status(400).json({ error: "Invalid mode. Expected 'fetch-url' or 'extract'." });
}