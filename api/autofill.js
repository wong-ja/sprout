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
    // strip markdown fences in case the model ignores the no-fences instruction
    const clean = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    // find the first { ... } block in case the model adds preamble text
    const start = clean.indexOf("{");
    const end   = clean.lastIndexOf("}");
    if (start === -1 || end === -1) throw new SyntaxError("No JSON object found in LLM response.");
    return JSON.parse(clean.slice(start, end + 1));
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

    const { mode, url, text, provider, userApiKey } = body;

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

    // extract: LLM field extraction to unified { fields } response
    if (mode === "extract") {
        if (!text) return res.status(400).json({ error: "Missing text." });

        const useProvider = provider ?? "openrouter";
        // prefer server-side env key ; fall back to user-supplied key
        // NOTE: userApiKey is never logged
        const apiKey = useProvider === "openrouter"
            ? (process.env.OPENROUTER_KEY || userApiKey || "")
            : (process.env.GEMINI_API_KEY  || userApiKey || "");

        if (!apiKey) {
            return res.status(400).json({
                error: "No API key available. Add your free OpenRouter or Gemini key in Settings.",
            });
        }

        const prompt = buildPrompt(text);

        try {
            let providerData;
            // Openrouter
            if (useProvider === "openrouter") {
                const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${apiKey}`,
                    },
                    body: JSON.stringify({
                        // openrouter/free auto-selects from all currently available free models.
                        // avoids hardcoding a specific :free model that can be deprecated at any time.
                        model: "openrouter/free",
                        messages: [{ role: "user", content: prompt }],
                        temperature: 0.1,
                        max_tokens: 1024,
                    }),
                });
                providerData = await r.json();
                if (!r.ok) {
                    if (r.status === 429) return res.status(429).json({ error: "OpenRouter rate limit reached. Wait a moment and try again." });
                    return res.status(r.status).json({ error: providerData?.error?.message ?? "OpenRouter error." });
                }
            } else {
                // Gemini direct
                const r = await fetch(
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
                providerData = await r.json();
                if (!r.ok) {
                    if (r.status === 429) return res.status(429).json({ error: "Gemini rate limit reached. Switch to OpenRouter for more generous free limits." });
                    if (r.status === 400) return res.status(400).json({ error: "Text too long for Gemini. Try pasting a shorter excerpt." });
                    return res.status(r.status).json({ error: providerData?.error?.message ?? "Gemini error." });
                }
            }

            const fields = extractFieldsFromProvider(providerData, useProvider);
            return res.status(200).json({ fields });

        } catch (err) {
            if (err instanceof SyntaxError) {
                return res.status(422).json({ error: "AI returned unparseable output. Try again or paste the description." });
            }
            return res.status(500).json({ error: err.message });
        }
    }

    return res.status(400).json({ error: "Invalid mode. Expected 'fetch-url' or 'extract'." });
}