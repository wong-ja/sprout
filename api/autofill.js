// autofill serverless function (Vercel)
// jina fetch + structured parser, LLM extraction with user key (optional)

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


// structured job posting parser (text/markdown)
function parseJobPosting(text) {
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

    // title / role (first H1/H2 in md)
    let role = "";
    for (const line of lines) {
        // skip lines that look like nav, labels, or boilerplate
        if (/^(apply|share|back|jobs? at|posted|department|location|employment|compensation|overview|about|benefits?|why|what|how|you|we|our|the)\b/i.test(line)) continue;
        if (line.length < 3 || line.length > 120) continue;
        // markdown heading
        const headingMatch = line.match(/^#{1,3}\s+(.+)/);
        if (headingMatch) { role = headingMatch[1].trim(); break; }
        // plain first line that looks like a job title
        if (/[A-Z]/.test(line[0]) && !/[.?!]$/.test(line)) { role = line; break; }
    }

    // label:value extraction, handles:
    //   1. "Label\nValue" (Ashby, Greenhouse, etc)
    //   2. "Label: Value" or "**Label:** Value" (markdown inline)
    //   3. Structured markdown tables

    const labelMap = {};

    // format 1: label on one line, value on the next
    // detect lines that are short labels (≤4 words, no sentence punctuation)
    const KNOWN_LABELS = [
        "location", "employment type", "job type", "location type", "work type",
        "work location", "workplace", "remote", "department", "team",
        "compensation", "salary", "pay", "rate", "compensation range",
        "company", "organization", "employer",
        "level", "seniority", "experience level",
        "industry", "sector",
        "posted", "deadline", "closing date",
    ];

    for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].toLowerCase().replace(/[*_:#]/g, "").trim();
        const next = lines[i + 1];
        if (KNOWN_LABELS.some(l => line === l || line.startsWith(l)) && next.length < 120) {
            labelMap[line] = next;
        }
    }

    // format 2: inline "Label: Value" or "**Label:** Value"
    for (const line of lines) {
        const m = line.match(/^\*{0,2}([A-Za-z ]{2,30})\*{0,2}\s*[:\-–]\s*(.+)/);
        if (m) {
            const key = m[1].toLowerCase().trim();
            const val = m[2].replace(/\*+/g, "").trim();
            if (!labelMap[key]) labelMap[key] = val;
        }
    }

    // extract each field

    // company: look for "at Company", "jobs at X", "Company:" patterns, or page title suffix
    let company = "";
    const companyPatterns = [
        text.match(/\bjobs?\s+at\s+([A-Z][A-Za-z0-9\s&.,'-]{1,40}?)(?:\s*[|\-–]|\n|$)/i),
        text.match(/\bat\s+([A-Z][A-Za-z0-9\s&.,'-]{1,40}?)\s*(?:is|are|we|–|-|\||\n)/i),
        text.match(/powered by\s+\n+([A-Z][A-Za-z0-9\s&.'-]{1,40})/i),
    ];
    // also check labelMap
    const companyLabel = labelMap["company"] || labelMap["organization"] || labelMap["employer"] || labelMap["company name"] || "";
    if (companyLabel) {
        company = companyLabel;
    } else {
        for (const m of companyPatterns) {
            if (m?.[1]?.trim()) { company = m[1].trim(); break; }
        }
    }
    // style: often appears in the URL path or page title, fall back to first bold/heading that isn't the role
    if (!company) {
        const boldMatch = text.match(/\*\*([A-Z][A-Za-z0-9\s&.'-]{2,40})\*\*/);
        if (boldMatch && boldMatch[1].trim() !== role) company = boldMatch[1].trim();
    }

    // location
    const locationRaw =
        labelMap["location"] ||
        labelMap["work location"] ||
        labelMap["office location"] ||
        labelMap["city"] ||
        "";
    // clean up "location type" contamination
    const location = locationRaw
        .replace(/\b(remote|hybrid|on-?site|flexible)\b/gi, "")
        .replace(/\s+/g, " ").trim();

    // workMode: check labelMap["location type"] first, then scan full text
    const locationTypeRaw = (
        labelMap["location type"] ||
        labelMap["workplace"] ||
        labelMap["work type"] ||
        labelMap["remote"] ||
        ""
    ).toLowerCase();

    let workMode = "";
    if (/remote/i.test(locationTypeRaw) && /on.?site|office|hybrid/i.test(locationTypeRaw)) workMode = "Hybrid";
    else if (/remote/i.test(locationTypeRaw)) workMode = "Remote";
    else if (/hybrid/i.test(locationTypeRaw)) workMode = "Hybrid";
    else if (/on.?site|in.?office|in.?person/i.test(locationTypeRaw)) workMode = "On-site";
    else if (/flexible/i.test(locationTypeRaw)) workMode = "Flexible";
    // fall back to full-text scan
    if (!workMode) {
        if (/\bfully[- ]remote\b|\b100%\s*remote\b|\bremote[- ]first\b/i.test(text)) workMode = "Remote";
        else if (/\bremote\b/i.test(text) && /\boffice\b|\bon[- ]?site\b/i.test(text)) workMode = "Hybrid";
        else if (/\bremote\b/i.test(text)) workMode = "Remote";
        else if (/\bhybrid\b/i.test(text)) workMode = "Hybrid";
        else if (/\bon[- ]?site\b|\bin[- ]?office\b/i.test(text)) workMode = "On-site";
        else if (/\bflexible\s+(?:work|location|hours)\b/i.test(text)) workMode = "Flexible";
    }

    // jobType: check labelMap first
    const jobTypeRaw = (
        labelMap["employment type"] ||
        labelMap["job type"] ||
        labelMap["work type"] ||
        labelMap["type"] ||
        ""
    ).toLowerCase();

    let jobType = "";
    if (/full.?time/i.test(jobTypeRaw)) jobType = "Full-time";
    else if (/part.?time/i.test(jobTypeRaw)) jobType = "Part-time";
    else if (/contract/i.test(jobTypeRaw)) jobType = "Contract";
    else if (/freelance/i.test(jobTypeRaw)) jobType = "Freelance";
    else if (/internship|intern\b/i.test(jobTypeRaw)) jobType = "Internship";
    else if (/temporary|temp\b/i.test(jobTypeRaw)) jobType = "Temporary";
    else if (/volunteer/i.test(jobTypeRaw)) jobType = "Volunteer";
    // fall back to full-text scan
    if (!jobType) {
        if (/\bfull[.\s-]?time\b/i.test(text)) jobType = "Full-time";
        else if (/\bpart[.\s-]?time\b/i.test(text)) jobType = "Part-time";
        else if (/\bcontract\b/i.test(text)) jobType = "Contract";
        else if (/\bfreelance\b/i.test(text)) jobType = "Freelance";
        else if (/\binternship\b|\bintern\b/i.test(text)) jobType = "Internship";
        else if (/\btemporary\b|\btemp\b/i.test(text)) jobType = "Temporary";
        else if (/\bvolunteer\b/i.test(text)) jobType = "Volunteer";
    }

    // salary: labelMap first, then regex scan
    const salaryRaw =
        labelMap["compensation"] ||
        labelMap["salary"] ||
        labelMap["pay"] ||
        labelMap["rate"] ||
        labelMap["compensation range"] ||
        "";
    // clean equity/bonus noise from compensation field
    const salary = salaryRaw
        ? salaryRaw.replace(/\s*•\s*offers?\s+equity/gi, "").replace(/\s*•\s*bonus/gi, "").trim()
        : (text.match(/[\$£€]\s*[\d,]+[kK]?\s*(?:[-–—to]+\s*[\$£€]?\s*[\d,]+[kK]?)?(?:\s*(?:per|\/)\s*(?:year|yr|hour|hr|annum))?/i)?.[0]?.trim() ?? "");

    // industry: check department label as a proxy, or known industry keywords
    const deptRaw = labelMap["department"] || labelMap["team"] || labelMap["industry"] || labelMap["sector"] || "";
    const INDUSTRIES = [
        "Technology","Healthcare","Finance","Education","Retail","Manufacturing",
        "Media","Government","Nonprofit","Real Estate","Legal","Marketing",
        "Consulting","Hospitality","Transportation","Energy","Agriculture",
        "Construction","Insurance","Pharmaceuticals",
    ];
    let industry = "";
    for (const ind of INDUSTRIES) {
        if (new RegExp(`\\b${ind}\\b`, "i").test(text)) { industry = ind; break; }
    }
    // "health" → Healthcare etc.
    if (!industry) {
        if (/\bhealth\b|\bmedical\b|\bclinic\b|\bpsych/i.test(text)) industry = "Healthcare";
        else if (/\bfintech\b|\bbank\b|\bfinance\b|\binvest/i.test(text)) industry = "Finance";
        else if (/\bedtech\b|\beducation\b|\blearning\b/i.test(text)) industry = "Education";
    }

    // requirements: scan for known document requirements
    const reqMap = {
        "Resume / CV":       /\bresume\b|\bcv\b|\bcurriculum vitae\b/i,
        "Cover Letter":      /\bcover letter\b/i,
        "Portfolio":         /\bportfolio\b/i,
        "References":        /\breferences?\b/i,
        "Writing Sample":    /\bwriting sample\b/i,
        "Work Sample":       /\bwork sample\b/i,
        "Assessment / Test": /\bassessment\b|\btake[- ]?home\s*(test|project|assignment)\b/i,
        "Transcript":        /\btranscript\b/i,
        "Background Check":  /\bbackground check\b/i,
        "LinkedIn Profile":  /\blinkedin\b/i,
        "GitHub Profile":    /\bgithub\b/i,
        "Personal Website":  /\bpersonal\s+(?:website|site)\b/i,
        "Video Introduction":/\bvideo\s+(?:intro|introduction|cover)\b/i,
    };
    const requirements = Object.entries(reqMap)
        .filter(([, re]) => re.test(text))
        .map(([l]) => l);

    // tags: derive from role + industry + key signals
    const tags = [];
    if (workMode) tags.push(workMode.toLowerCase().replace("-", ""));
    if (industry) tags.push(industry.toLowerCase());
    if (/\bstartup\b|\bseries [a-e]\b/i.test(text)) tags.push("startup");
    if (/\bremote\b/i.test(text)) tags.push("remote");
    if (/\bequity\b/i.test(text)) tags.push("equity");
    if (/\bai\b|\bmachine learning\b|\bllm\b/i.test(text)) tags.push("ai");
    // de-dup and limit to 5
    const uniqueTags = [...new Set(tags)].slice(0, 5);

    // description: strip boilerplate, take meaningful body
    const DROP_LINES = [
        /^apply\s+(for\s+this\s+job|now)/i,
        /^powered by/i,
        /^privacy policy/i,
        /^security$/i,
        /^vulnerability disclosure/i,
        /^share\b/i,
        /^back\b/i,
    ];
    const descLines = lines.filter(l => !DROP_LINES.some(re => re.test(l)));
    // skip the first few lines that we already parsed as structured fields
    const descStart = descLines.findIndex(l =>
        /overview|about\s+(the\s+)?(role|job|position|company|us|team)|responsibilities|what you|why you|we'?re\s+looking/i.test(l)
    );
    const description = descLines
        .slice(descStart >= 0 ? descStart : 0)
        .join("\n")
        .slice(0, 2000)
        .trim();

    return {
        company:      company.slice(0, 100),
        role:         role.slice(0, 100),
        location:     location.slice(0, 100),
        workMode,
        jobType,
        industry,
        salary:       salary.slice(0, 100),
        description,
        requirements,
        tags:         uniqueTags,
    };
}


// confidence check: returns how many fields were successfully extracted (decides LLM usage)
function parserConfidence(fields) {
    const key = ["company", "role", "location", "salary", "workMode", "jobType"];
    return key.filter(k => fields[k] && fields[k].length > 0).length;
}


// LLM helpers (optional with user API key)
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
    if (!r.ok) throw Object.assign(
        new Error(data?.error?.metadata?.raw ?? data?.error?.message ?? `OpenRouter error ${r.status}`),
        { is429: r.status === 429 }
    );
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
    if (!r.ok) throw Object.assign(
        new Error(data?.error?.message ?? `Gemini error ${r.status}`),
        { is429: r.status === 429 }
    );
    return extractFieldsFromProvider(data, "gemini");
}

// attempt LLM - silently returns null on any failure so caller can fall back to parser result
async function tryLLM(text, orKey, geminiKey) {
    if (orKey) {
        try { return await tryOpenRouter(text, orKey); } catch (_) {}
    }
    if (geminiKey) {
        try { return await tryGemini(text, geminiKey); } catch (_) {}
    }
    return null;
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

        const orKey     = process.env.OPENROUTER_KEY || userOrKey     || "";
        const geminiKey = process.env.GEMINI_API_KEY  || userGeminiKey || "";

        // always run the structured parser first
        const parsed = parseJobPosting(text);
        const confidence = parserConfidence(parsed);

        // if parser extracted most fields (≥3 key fields), return it directly
        // if parser got fewer than 3 fields AND a key is available, try LLM to fill gaps
        // always return something, never 429
        if (confidence >= 3 || (!orKey && !geminiKey)) {
            return res.status(200).json({ fields: parsed, source: "parser" });
        }

        // try LLM to improve on low-confidence parse - but don't fail if it errors
        const llmFields = await tryLLM(text, orKey, geminiKey);
        if (llmFields) {
            // merge: prefer LLM values for fields the parser missed, keep parser values otherwise
            const merged = {};
            for (const key of Object.keys(parsed)) {
                merged[key] = llmFields[key] || parsed[key];
            }
            return res.status(200).json({ fields: merged, source: "llm" });
        }

        // LLM failed or unavailable - return parser result anyway
        return res.status(200).json({ fields: parsed, source: "parser" });
    }

    return res.status(400).json({ error: "Invalid mode. Expected 'fetch-url' or 'extract'." });
}