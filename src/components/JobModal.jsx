import { useState, useEffect, useRef } from "react";
import {
    INTERVIEW_STAGES, JOB_TYPES, WORK_MODES, INDUSTRIES,
    APPLICATION_REQUIREMENTS, columnById, fmtDate, getInitials,
    btnStyle,
} from "../store.js";

const IS_DEV = import.meta.env.DEV && !import.meta.env.VITE_USE_SERVERLESS;

// text cleaning before sending to LLM
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
        /background check(s)? (may|will) be/i,
        /compensation (may|will) vary/i,
    ];
    return raw
        .split("\n")
        .map(l => l.trim())
        .filter(l => l.length > 8)
        .filter(l => !DROP.some(re => re.test(l)))
        .join("\n")
        .slice(0, 5000);
}

// fetch job page text via jina reader
async function fetchUrlViaJina(url) {
    if (IS_DEV) {
        const res = await fetch(`https://r.jina.ai/${url.trim()}`, {
            headers: { "Accept": "text/plain, text/markdown, */*" },
        });
        if (!res.ok) throw new Error(`Could not fetch that page (${res.status}). Try pasting the description instead.`);
        return (await res.text()).trim().slice(0, 5000);
    }
    // prod: route through Vercel serverless
    const res = await fetch("/api/autofill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "fetch-url", url }),
    });
    const data = await res.json().catch(() => { throw new Error("Server returned an unreadable response."); });
    if (!res.ok) throw new Error(data?.error ?? `Server error ${res.status}`);
    return data.text ?? "";
}

// robust JSON extractor
function parseJSON(raw) {
    // 1. strip <think>...</think> reasoning blocks (DeepSeek R1, QwQ, etc.)
    let clean = raw.replace(/<think>[\s\S]*?<\/think>/gi, "");
    // 2. strip markdown fences
    clean = clean.replace(/```json\s*/gi, "").replace(/```\s*/g, "");
    // 3. find outermost { ... } — handles preamble/postamble text
    const start = clean.indexOf("{");
    const end   = clean.lastIndexOf("}");
    if (start === -1 || end === -1 || end < start) {
        throw new SyntaxError(`No JSON object found in LLM response. Raw: ${raw.slice(0, 200)}`);
    }
    return JSON.parse(clean.slice(start, end + 1));
}

// classify 429 body:
// "transient" = upstream overload, retry after a short delay
// "exhausted" = daily/project quota gone, don't bother retrying today
function classify429(body) {
    const raw = JSON.stringify(body).toLowerCase();
    // Gemini RESOURCE_EXHAUSTED with limit:0 = hard quota exhausted
    if (raw.includes("resource_exhausted") || raw.includes("limit: 0") || raw.includes("limit\":0")) return "exhausted";
    // OpenRouter "temporarily rate-limited upstream" = transient Venice/provider overload
    if (raw.includes("temporarily") || raw.includes("retry shortly")) return "transient";
    // default: treat as transient so we at least try the other provider
    return "transient";
}

// single-provider fetch (dev, prod goes through /api/autofill)
async function fetchFromOpenRouter(text, apiKey) {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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

    const body = await res.json().catch(() => ({}));
    console.log(`[autofill] OpenRouter ${res.status}:`, body);

    if (!res.ok) {
        const msg = body?.error?.message ?? body?.error?.metadata?.raw ?? `OpenRouter error ${res.status}`;
        const kind = res.status === 429 ? classify429(body) : "error";
        throw Object.assign(new Error(msg), { is429: res.status === 429, kind });
    }
    return parseJSON(body.choices?.[0]?.message?.content ?? "");
}

async function fetchFromGemini(text, apiKey) {
    // gemini-2.0-flash-lite: 30 RPM / 1500 RPD free tier
    const res = await fetch(
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

    const body = await res.json().catch(() => ({}));
    console.log(`[autofill] Gemini ${res.status}:`, body);

    if (!res.ok) {
        const msg = body?.error?.message ?? `Gemini error ${res.status}`;
        const kind = res.status === 429 ? classify429(body) : "error";
        throw Object.assign(new Error(msg), { is429: res.status === 429, kind });
    }
    return parseJSON(body.candidates?.[0]?.content?.parts?.[0]?.text ?? "");
}

// callLLM - tries both providers, falls back automatically on 429
// Dev: calls providers directly (IS_DEV=true), tries Gemini then OpenRouter
// Prod: routes through /api/autofill which handles fallback server-side
async function callLLM(text, allKeys) {
    if (IS_DEV) {
        const orKey     = allKeys?.openrouter ?? "";
        const geminiKey = allKeys?.gemini ?? "";

        // try Gemini first in dev
        if (geminiKey) {
            try {
                const fields = await fetchFromGemini(text, geminiKey);
                console.log("[autofill] fields from Gemini:", fields);
                return fields;
            } catch (err) {
                if (!err.is429) throw err;
                console.warn(`[autofill] Gemini 429 (${err.kind}) — trying OpenRouter`);
            }
        }

        if (orKey) {
            try {
                const fields = await fetchFromOpenRouter(text, orKey);
                console.log("[autofill] fields from OpenRouter:", fields);
                return fields;
            } catch (err) {
                if (!err.is429) throw err;
                console.warn(`[autofill] OpenRouter 429 (${err.kind}) — both exhausted`);
            }
        }

        // both failed message
        throw new Error(
            "Both AI providers are unavailable right now (quota limits)."
        );
    }

    // prod: send both keys over HTTPS (npt logged server-side) - server tries OpenRouter first, falls back to Gemini
    const res = await fetch("/api/autofill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            mode: "extract",
            text,
            userOrKey:     allKeys?.openrouter ?? "",
            userGeminiKey: allKeys?.gemini     ?? "",
        }),
    });
    const data = await res.json().catch(() => { throw new Error("Server returned an unreadable response."); });
    if (!res.ok) throw new Error(data?.error ?? `Server error ${res.status}`);
    if (!data.fields) throw new Error("Unexpected response from server. Try again.");

    console.log("[autofill] fields from server:", data.fields);
    return data.fields;
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

// no-key local fallback
// Only attempts fields that regex is reliably good at.
// Intentionally leaves company/role/industry blank rather than guessing badly —
// a wrong autofilled value is worse than an empty field the user fills themselves.
// When an API key is present, the LLM path handles all of this with far higher quality.
function extractFromPaste(text) {
    const salaryMatch = text.match(
        /[\$£€]\s*[\d,]+[kK]?\s*(?:[-–—to]+\s*[\$£€]?\s*[\d,]+[kK]?)?(?:\s*(?:per|\/)\s*(?:year|yr|hour|hr|annum))?/i
    );

    // location: explicit label first, then city+state pattern as fallback
    const locationMatch =
        text.match(/(?:^|\n)\s*(?:Location|Based in|Office location|Location:|City)[:\s–-]+([^\n]{3,60})/im) ??
        text.match(/\b([A-Z][a-z]+(?: [A-Z][a-z]+)?,\s*[A-Z]{2})\b/);

    const workMode =
        /\bfully[- ]remote\b|\b100%\s*remote\b|\bremote[- ]first\b/i.test(text) ? "Remote" :
        /\bremote\b/i.test(text) && /\boffice\b|\bon[- ]?site\b/i.test(text)    ? "Hybrid" :
        /\bremote\b/i.test(text)                                                 ? "Remote" :
        /\bhybrid\b/i.test(text)                                                 ? "Hybrid" :
        /\bon[- ]?site\b|\bin[- ]?office\b|\bin the office\b/i.test(text)        ? "On-site" :
        /\bflexible\s+(?:work|location|hours|arrangement)\b/i.test(text)         ? "Flexible" : "";

    const jobType =
        /\bfull[.\s-]?time\b/i.test(text)                  ? "Full-time" :
        /\bpart[.\s-]?time\b/i.test(text)                  ? "Part-time" :
        /\bcontract(?:\s+role|\s+position)?\b/i.test(text) ? "Contract"  :
        /\bfreelance\b/i.test(text)                        ? "Freelance" :
        /\binternship\b|\bintern\b/i.test(text)            ? "Internship":
        /\btemporary\b|\btemp\b/i.test(text)               ? "Temporary" :
        /\bvolunteer\b/i.test(text)                        ? "Volunteer" : "";

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
    };

    return {
        company:      "",   // too error-prone without LLM - left blank intentionally
        role:         "",   // too error-prone without LLM - left blank intentionally
        location:     locationMatch?.[1]?.trim() ?? "",
        workMode,
        jobType,
        industry:     "",
        salary:       salaryMatch?.[0]?.trim().replace(/\s+/g, " ") ?? "",
        description:  text.slice(0, 2000),
        requirements: Object.entries(reqMap).filter(([, re]) => re.test(text)).map(([l]) => l),
        tags:         [],
    };
}


// apply extracted fields to form, preserving any user-typed values
function mergeExtracted(form, extracted, sourceUrl) {
    // pick prefers the extracted value over the existing form value
    const pick = (extractedVal, existingVal) => extractedVal || existingVal;
    return {
        ...form,
        // if autofilled from a URL, populate the url field too
        ...(sourceUrl ? { url: sourceUrl } : {}),
        company:      pick(extracted.company,     form.company),
        role:         pick(extracted.role,         form.role),
        location:     pick(extracted.location,     form.location),
        workMode:     pick(extracted.workMode,     form.workMode),
        jobType:      pick(extracted.jobType,      form.jobType),
        industry:     pick(extracted.industry,     form.industry),
        salary:       pick(extracted.salary,       form.salary),
        description:  pick(extracted.description,  form.description),
        requirements: extracted.requirements?.length ? extracted.requirements : form.requirements,
        // defensive: LLM can occasionally return tags as a plain string
        tags: Array.isArray(extracted.tags) && extracted.tags.length
            ? extracted.tags.join(", ")
            : typeof extracted.tags === "string" && extracted.tags
                ? extracted.tags
                : form.tags,
    };
}



// =================== JOB MODAL =====================================================
export default function JobModal({ modal, columns, onClose, onAdd, onUpdate, onDelete, onMove, onEdit }) {
    const { mode, job } = modal;
    const isView = mode === "view";
    const isAdd  = mode === "add";
    const isEdit = mode === "edit";
    const overlayRef = useRef();

    useEffect(() => {
        const el = overlayRef.current;
        if (!el) return;
        const focusable = el.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
        const first = focusable[0];
        const last  = focusable[focusable.length - 1];
        first?.focus();
        const trap = e => {
            if (e.key !== "Tab") return;
            if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
                e.preventDefault();
                (e.shiftKey ? last : first)?.focus();
            }
        };
        el.addEventListener("keydown", trap);
        return () => el.removeEventListener("keydown", trap);
    }, [mode]);

    const col = columnById(columns, job?.column ?? modal.column ?? "watchlist");

    return (
        <div
            ref={overlayRef}
            role="dialog"
            aria-modal="true"
            aria-label={isAdd ? "Add job" : isEdit ? `Edit job — ${job?.company}` : `${job?.company} — ${job?.role}`}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
            style={{
                position: "fixed", inset: 0,
                background: "rgba(0,0,0,0.45)",
                display: "flex", alignItems: "center", justifyContent: "center",
                zIndex: 200, padding: 16,
                backdropFilter: "blur(2px)",
            }}
        >
            <div style={{
                background: "var(--bg-surface)",
                borderRadius: 16,
                border: "1px solid var(--border-default)",
                width: "100%",
                maxWidth: isView ? 560 : 640,
                maxHeight: "90vh",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                boxShadow: "var(--shadow-lg)",
            }}>
                <ModalHeader mode={mode} job={job} col={col} onClose={onClose} onEdit={onEdit} onDelete={onDelete} />
                <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
                    {isView && job
                        ? <ViewBody job={job} col={col} columns={columns} onMove={onMove} />
                        : null}
                    {(isAdd || isEdit)
                        ? <FormBody
                            initial={isAdd
                                ? {
                                    company: "", role: "", location: "", workMode: "", jobType: "",
                                    industry: "", salary: "", url: "", notes: "", tags: "",
                                    requirements: [], interviewStage: "", referralContact: "",
                                    recruiterName: "", recruiterEmail: "", applicationDeadline: "",
                                    description: "",
                                    column: modal.column ?? "watchlist",
                                    prefilled: modal.prefilled,
                                    prefilledIsUrl: modal.prefilledIsUrl,
                                }
                                : { ...job, tags: (job.tags ?? []).join(", ") }
                            }
                            columns={columns}
                            onSubmit={isAdd ? onAdd : onUpdate}
                            onCancel={onClose}
                            isAdd={isAdd}
                          />
                        : null}
                </div>
            </div>
        </div>
    );
}


// MODAL HEADER
function ModalHeader({ mode, job, col, onClose, onEdit, onDelete }) {
    const isView   = mode === "view";
    const initials = job ? getInitials(job.company) : "";
    return (
        <div style={{
            padding: "14px 16px",
            borderBottom: "1px solid var(--border-default)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 10, flexShrink: 0,
        }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                {job && (
                    <div aria-hidden="true" style={{
                        width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                        background: col?.bg ?? "var(--bg-subtle)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, fontWeight: 700, color: col?.color ?? "var(--text-secondary)",
                    }}>
                        {initials}
                    </div>
                )}
                <div style={{ minWidth: 0 }}>
                    <h2 style={{ margin: 0, fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }} className="truncate">
                        {mode === "add" ? "Add a job" : mode === "edit" ? `Editing — ${job?.company}` : job?.company}
                    </h2>
                    {isView && job?.role && (
                        <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>{job.role}</p>
                    )}
                </div>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                {isView && job && (
                    <>
                        <button onClick={() => onEdit(job)} style={btnStyle("outline")} aria-label="Edit this job">Edit</button>
                        <button onClick={() => onDelete(job.id)} style={btnStyle("danger")} aria-label="Delete this job">Delete</button>
                    </>
                )}
                <button
                    onClick={onClose}
                    style={{ ...btnStyle("ghost"), fontSize: 20, padding: "2px 8px" }}
                    aria-label="Close modal"
                >×</button>
            </div>
        </div>
    );
}


//  ===================== VIEW BODY ==================================================
function ViewBody({ job, col, columns, onMove }) {
    return (
        <div>
            {/* STATUS PILLS */}
            <fieldset style={{ border: "none", padding: 0, margin: "0 0 16px" }}>
                <legend style={{ ...labelStyle, marginBottom: 8 }}>Status</legend>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {columns.map(c => (
                        <button
                            key={c.id}
                            onClick={() => onMove(job.id, c.id)}
                            aria-pressed={c.id === job.column}
                            style={{
                                fontSize: 12, padding: "5px 12px", borderRadius: 99,
                                border: `1.5px solid ${c.id === job.column ? c.color : "var(--border-default)"}`,
                                background: c.id === job.column ? c.bg : "transparent",
                                color: c.id === job.column ? c.textColor ?? c.color : "var(--text-secondary)",
                                cursor: "pointer", fontWeight: c.id === job.column ? 700 : 400,
                                transition: "all 0.12s",
                            }}
                        >
                            {c.label}
                        </button>
                    ))}
                </div>
            </fieldset>
            {job.column === "interviewing" && job.interviewStage && (
                <InfoRow label="Interview stage" value={job.interviewStage} />
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 20px", marginBottom: 14 }}>
                <InfoRow label="Role" value={job.role} />
                {job.location          && <InfoRow label="Location"   value={job.location} />}
                {job.workMode          && <InfoRow label="Work mode"  value={job.workMode} />}
                {job.jobType           && <InfoRow label="Job type"   value={job.jobType} />}
                {job.industry          && <InfoRow label="Industry"   value={job.industry} />}
                {job.salary            && <InfoRow label="Salary"     value={job.salary} />}
                {job.applicationDeadline && <InfoRow label="Deadline" value={job.applicationDeadline} />}
                <InfoRow label="Added" value={fmtDate(job.createdAt)} />
            </div>
            {job.url && (
                <div style={{ marginBottom: 12 }}>
                    <p style={labelStyle}>Job listing</p>
                    <a href={job.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "var(--accent)", wordBreak: "break-all" }}>{job.url}</a>
                </div>
            )}
            {job.requirements?.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                    <p style={labelStyle}>Required documents</p>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {job.requirements.map(r => (
                            <span key={r} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, background: "var(--bg-subtle)", color: "var(--text-secondary)", border: "1px solid var(--border-default)" }}>
                                {r}
                            </span>
                        ))}
                    </div>
                </div>
            )}
            {job.tags?.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                    <p style={labelStyle}>Tags</p>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        {job.tags.map(t => (
                            <span key={t} style={{ fontSize: 12, padding: "3px 10px", borderRadius: 99, background: "var(--accent-light)", color: "var(--accent-text)", fontWeight: 600 }}>
                                {t}
                            </span>
                        ))}
                    </div>
                </div>
            )}
            {(job.recruiterName || job.referralContact) && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 20px", marginBottom: 14 }}>
                    {job.recruiterName   && <InfoRow label="Recruiter" value={job.recruiterName + (job.recruiterEmail ? ` · ${job.recruiterEmail}` : "")} />}
                    {job.referralContact && <InfoRow label="Referral"  value={job.referralContact} />}
                </div>
            )}
            {job.notes && (
                <div style={{ marginBottom: 14 }}>
                    <p style={labelStyle}>Notes</p>
                    <p style={{ margin: 0, fontSize: 13, color: "var(--text-primary)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{job.notes}</p>
                </div>
            )}
            {job.description && (
                <div>
                    <p style={labelStyle}>Job description</p>
                    <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7, whiteSpace: "pre-wrap", maxHeight: 200, overflowY: "auto" }}>{job.description}</p>
                </div>
            )}
        </div>
    );
}

function InfoRow({ label, value }) {
    return (
        <div>
            <p style={labelStyle}>{label}</p>
            <p style={{ margin: 0, fontSize: 14, color: "var(--text-primary)", fontWeight: 500 }}>{value}</p>
        </div>
    );
}

const labelStyle = {
    margin: "0 0 3px",
    fontSize: 11, fontWeight: 600,
    color: "var(--text-tertiary)",
    textTransform: "uppercase", letterSpacing: "0.05em",
};


// ================== FORM BODY =======================================================
function FormBody({ initial, columns, onSubmit, onCancel, isAdd }) {
    const [form, setForm]             = useState(initial);
    const [errors, setErrors]         = useState({});
    const [autofillMode, setAutofillMode] = useState(
        initial.prefilledIsUrl ? "url" : "paste"
    );
    const [autofillUrl, setAutofillUrl]   = useState(
        initial.prefilledIsUrl ? (initial.prefilled ?? "") : ""
    );
    const [autofillText, setAutofillText] = useState(
        initial.prefilledIsUrl ? "" : (initial.prefilled ?? "")
    );
    const [autofilling, setAutofilling]   = useState(false);
    const [autofillError, setAutofillError]   = useState("");
    const [autofillSuccess, setAutofillSuccess] = useState(false);

    // read API keys from localStorage (Settings)
    const openrouterKey  = localStorage.getItem("sprout_or_key") ?? "";
    const geminiKey      = localStorage.getItem("sprout_gemini_key") ?? "";
    const hasKey         = !!(openrouterKey || geminiKey);
    const activeKeyLabel = openrouterKey ? "OpenRouter" : geminiKey ? "Gemini" : null;

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const toggleReq = r => {
        const reqs = form.requirements ?? [];
        set("requirements", reqs.includes(r) ? reqs.filter(x => x !== r) : [...reqs, r]);
    };

    const validate = () => {
        const e = {};
        if (!form.company?.trim()) e.company = "Company name is required";
        if (!form.role?.trim())    e.role    = "Role is required";
        return e;
    };

    const submit = () => {
        const e = validate();
        if (Object.keys(e).length) { setErrors(e); return; }
        const tags = typeof form.tags === "string"
            ? form.tags.split(",").map(t => t.trim()).filter(Boolean)
            : form.tags ?? [];
        onSubmit({ ...form, tags });
    };

    const handleAutofill = async () => {
        setAutofilling(true);
        setAutofillError("");
        setAutofillSuccess(false);

        try {
            let extracted;
            // both keys passed - server (or dev fallback) decides which to use
            const allKeys = { openrouter: openrouterKey, gemini: geminiKey };
            const hasAnyKey = !!(openrouterKey || geminiKey);

            if (autofillMode === "paste") {
                // PASTE mode
                if (!autofillText.trim()) throw new Error("Please paste the job description first.");
                if (hasAnyKey) {
                    extracted = await callLLM(cleanPastedText(autofillText), allKeys);
                } else {
                    // no key - local heuristic. Only fills what regex is reliable for
                    // (work mode, job type, salary, requirements, description).
                    // Company/role intentionally left blank to avoid bad guesses.
                    extracted = extractFromPaste(autofillText);
                }
            } else {
                // URL mode - needs a key
                if (!autofillUrl.trim()) throw new Error("Please enter a URL.");
                if (!hasAnyKey) throw new Error("An API key is needed to autofill from a URL. Add an OpenRouter or Gemini key in Settings, or paste the description instead.");
                const pageText = await fetchUrlViaJina(autofillUrl.trim());
                // guard against Jina returning empty content (login walls, Workday, Greenhouse, etc.)
                if (!pageText?.trim()) throw new Error("Couldn't read that page — it may be behind a login or block scrapers. Try pasting the description instead.");
                extracted = await callLLM(pageText, allKeys);
            }

            // DEBUG
            console.log("[autofill] merging into form:", extracted);

            setForm(f => mergeExtracted(
                f,
                extracted,
                autofillMode === "url" ? autofillUrl.trim() : null,
            ));
            setAutofillSuccess(true);

        } catch (err) {
            // DEBUG
            console.error("[autofill] error:", err);
            setAutofillError(err.message || "Couldn't extract job details. Try pasting the description instead.");
        }

        setAutofilling(false);
    };

    return (
        // AUTOFILL
        <div style={{ display: "flex", flexDirection: "column", gap: 18, fontFamily: "var(--font-sans)", fontSize: 14 }}>
            <section aria-labelledby="autofill-heading">
                <p id="autofill-heading" style={{ ...labelStyle, marginBottom: 10 }}>Autofill from job listing</p>

                {/* AUTOFILL MODE */}
                <div role="group" aria-label="Autofill mode" style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 10 }}>
                    {[{ id: "url", label: "From URL" }, { id: "paste", label: "Paste description" }].map(m => (
                        <button
                            key={m.id}
                            type="button"
                            onClick={() => setAutofillMode(m.id)}
                            aria-pressed={autofillMode === m.id}
                            style={{
                                fontSize: 13, padding: "6px 14px", borderRadius: 99, cursor: "pointer",
                                border: `1.5px solid ${autofillMode === m.id ? "var(--accent)" : "var(--border-default)"}`,
                                background: autofillMode === m.id ? "var(--accent-light)" : "var(--bg-subtle)",
                                color: autofillMode === m.id ? "var(--accent-text)" : "var(--text-secondary)",
                                fontWeight: autofillMode === m.id ? 700 : 400,
                                transition: "all 0.12s",
                                fontFamily: "var(--font-sans)",
                            }}
                        >
                            {m.label}
                        </button>
                    ))}
                </div>

                {autofillMode === "url" ? (
                    <div>
                        <label htmlFor="autofill-url" className="sr-only">Job listing URL</label>
                        <input
                            id="autofill-url"
                            type="url"
                            value={autofillUrl}
                            onChange={e => setAutofillUrl(e.target.value)}
                            placeholder="https://jobs.example.com/posting/123"
                            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAutofill(); } }}
                            style={inputStyle()}
                        />
                        <p style={{ margin: "5px 0 0", fontSize: 12, color: "var(--text-tertiary)" }}>
                            {hasKey
                                ? "Fetches the page via Jina Reader, then extracts fields with AI."
                                : "Requires an API key — add one in Settings, or paste the description instead."}
                        </p>
                    </div>
                ) : (
                    <div>
                        <label htmlFor="autofill-paste" className="sr-only">Job description to parse</label>
                        <textarea
                            id="autofill-paste"
                            value={autofillText}
                            onChange={e => setAutofillText(e.target.value)}
                            placeholder="Paste the full job description here..."
                            style={{ ...inputStyle(), minHeight: 90, resize: "vertical", fontSize: 13 }}
                            rows={4}
                        />
                        <p style={{ margin: "5px 0 0", fontSize: 12, color: "var(--text-tertiary)" }}>
                            {hasKey
                                ? "AI will extract all fields. Boilerplate is stripped automatically."
                                : "No key needed — Sprout fills what it can locally. Add a free OpenRouter key in Settings for full extraction."}
                        </p>
                    </div>
                )}

                {/* KEY STATUS INDICATOR - key management in Settings */}
                <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    margin: "10px 0",
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: "var(--bg-subtle)",
                    border: "1px solid var(--border-subtle)",
                    fontSize: 12,
                }}>
                    <span style={{ color: hasKey ? "var(--success)" : "var(--text-tertiary)", fontWeight: hasKey ? 600 : 400 }}>
                        {hasKey
                            ? `✓ ${activeKeyLabel} key active`
                            : "⚠ No key — partial fill only (work mode, job type, salary)"}
                    </span>
                    <a
                        href="#settings"
                        onClick={e => { e.preventDefault(); document.querySelector('[aria-label="Open settings"]')?.click(); }}
                        style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}
                    >
                        Manage keys →
                    </a>
                </div>

                {/* AUTOFILL BUTTON */}
                <button
                    onClick={handleAutofill}
                    disabled={autofilling}
                    style={{ ...btnStyle("primary"), opacity: autofilling ? 0.65 : 1, width: "100%", justifyContent: "center" }}
                    aria-label="Autofill form fields from job listing"
                    aria-busy={autofilling}
                >
                    {autofilling ? "Filling fields…" : "Autofill fields"}
                </button>

                {autofillError && (
                    <div role="alert" style={{
                        margin: "8px 0 0", fontSize: 13, color: "var(--danger)",
                        lineHeight: 1.5, padding: "8px 10px",
                        background: "var(--danger-bg)", borderRadius: 7,
                        border: "1px solid var(--danger)",
                    }}>
                        {autofillError}
                    </div>
                )}
                {autofillSuccess && (
                    <p role="status" aria-live="polite" style={{ margin: "8px 0 0", fontSize: 13, color: "var(--success)", fontWeight: 500 }}>
                        ✓ Fields filled — review everything before saving.
                    </p>
                )}
            </section>

            <hr style={{ border: "none", borderTop: "1px solid var(--border-subtle)", margin: 0 }} />

            {/* JOB DETAILS */}
            <section aria-label="Core job details">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <Field label="Company" required error={errors.company}>
                        <input
                            value={form.company ?? ""}
                            onChange={e => set("company", e.target.value)}
                            placeholder="e.g. Acme Corp"
                            style={inputStyle(errors.company)}
                            aria-required="true"
                        />
                    </Field>
                    <Field label="Role / Title" required error={errors.role}>
                        <input
                            value={form.role ?? ""}
                            onChange={e => set("role", e.target.value)}
                            placeholder="e.g. Marketing Manager"
                            style={inputStyle(errors.role)}
                            aria-required="true"
                        />
                    </Field>
                    <Field label="Location">
                        <input value={form.location ?? ""} onChange={e => set("location", e.target.value)} placeholder="City, State or Remote" style={inputStyle()} />
                    </Field>
                    <Field label="Salary / Rate">
                        <input value={form.salary ?? ""} onChange={e => set("salary", e.target.value)} placeholder="e.g. $60k–$80k or $40/hr" style={inputStyle()} />
                    </Field>
                    <Field label="Work mode">
                        <select value={form.workMode ?? ""} onChange={e => set("workMode", e.target.value)} style={inputStyle()}>
                            <option value="">Select…</option>
                            {WORK_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </Field>
                    <Field label="Job type">
                        <select value={form.jobType ?? ""} onChange={e => set("jobType", e.target.value)} style={inputStyle()}>
                            <option value="">Select…</option>
                            {JOB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </Field>
                    <Field label="Industry">
                        <select value={form.industry ?? ""} onChange={e => set("industry", e.target.value)} style={inputStyle()}>
                            <option value="">Select…</option>
                            {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                        </select>
                    </Field>
                    <Field label="Pipeline status">
                        <select value={form.column ?? "watchlist"} onChange={e => set("column", e.target.value)} style={inputStyle()}>
                            {columns.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                        </select>
                    </Field>
                </div>
            </section>

            {/* INTERVIEW STAGE */}
            {form.column === "interviewing" && (
                <Field label="Interview stage">
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {INTERVIEW_STAGES.map(s => (
                            <button
                                key={s}
                                type="button"
                                onClick={() => set("interviewStage", form.interviewStage === s ? "" : s)}
                                aria-pressed={form.interviewStage === s}
                                style={{
                                    fontSize: 13, padding: "5px 11px", borderRadius: 99, cursor: "pointer",
                                    border: `1.5px solid ${form.interviewStage === s ? "var(--accent)" : "var(--border-default)"}`,
                                    background: form.interviewStage === s ? "var(--accent-light)" : "transparent",
                                    color: form.interviewStage === s ? "var(--accent-text)" : "var(--text-secondary)",
                                    fontWeight: form.interviewStage === s ? 700 : 400,
                                    transition: "all 0.12s",
                                    fontFamily: "var(--font-sans)",
                                }}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </Field>
            )}

            {/* APPLICATION REQUIREMENTS */}
            <section aria-labelledby="req-heading">
                <p id="req-heading" style={{ ...labelStyle, marginBottom: 8 }}>
                    Application requirements{" "}
                    <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, fontSize: 12 }}>
                        (select all that apply)
                    </span>
                </p>
                <div role="group" aria-label="Application requirements" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {APPLICATION_REQUIREMENTS.map(r => {
                        const active = (form.requirements ?? []).includes(r);
                        return (
                            <button
                                key={r}
                                type="button"
                                onClick={() => toggleReq(r)}
                                aria-pressed={active}
                                style={{
                                    fontSize: 13, padding: "5px 11px", borderRadius: 6, cursor: "pointer",
                                    border: `1.5px solid ${active ? "var(--accent)" : "var(--border-default)"}`,
                                    background: active ? "var(--accent-light)" : "transparent",
                                    color: active ? "var(--accent-text)" : "var(--text-secondary)",
                                    fontWeight: active ? 700 : 400,
                                    transition: "all 0.12s",
                                    fontFamily: "var(--font-sans)",
                                }}
                            >
                                {r}
                            </button>
                        );
                    })}
                </div>
                <WriteIn
                    placeholder="Add custom requirement…"
                    onAdd={val => {
                        if (val && !(form.requirements ?? []).includes(val))
                            set("requirements", [...(form.requirements ?? []), val]);
                    }}
                />
            </section>

            <section aria-label="Contact details">
                <p style={{ ...labelStyle, marginBottom: 8 }}>
                    Contact info{" "}
                    <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, fontSize: 12 }}>(optional)</span>
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <Field label="Recruiter name">
                        <input value={form.recruiterName ?? ""} onChange={e => set("recruiterName", e.target.value)} placeholder="e.g. Alex Kim" style={inputStyle()} />
                    </Field>
                    <Field label="Recruiter email">
                        <input type="email" value={form.recruiterEmail ?? ""} onChange={e => set("recruiterEmail", e.target.value)} placeholder="recruiter@company.com" style={inputStyle()} />
                    </Field>
                    <Field label="Referral contact">
                        <input value={form.referralContact ?? ""} onChange={e => set("referralContact", e.target.value)} placeholder="Name and/or relationship" style={inputStyle()} />
                    </Field>
                    <Field label="Application deadline">
                        <input type="date" value={form.applicationDeadline ?? ""} onChange={e => set("applicationDeadline", e.target.value)} style={inputStyle()} aria-label="Application deadline" />
                    </Field>
                </div>
            </section>

            <Field label="Tags">
                <input
                    value={typeof form.tags === "string" ? form.tags : (form.tags ?? []).join(", ")}
                    onChange={e => set("tags", e.target.value)}
                    placeholder="e.g. remote, nonprofit, design (comma separated)"
                    style={inputStyle()}
                    aria-describedby="tags-hint"
                />
                <p id="tags-hint" style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-tertiary)" }}>
                    Separate with commas. Used for search and filtering.
                </p>
            </Field>

            <Field label="Notes">
                <textarea
                    value={form.notes ?? ""}
                    onChange={e => set("notes", e.target.value)}
                    placeholder="Why are you interested? Interview notes, follow-up reminders…"
                    style={{ ...inputStyle(), minHeight: 80, resize: "vertical" }}
                    rows={3}
                />
            </Field>

            <Field label="Job description">
                <textarea
                    value={form.description ?? ""}
                    onChange={e => set("description", e.target.value)}
                    placeholder="Full job description (auto-populated if autofill used)"
                    style={{ ...inputStyle(), minHeight: 100, resize: "vertical", fontSize: 13 }}
                    rows={4}
                />
            </Field>

            <div style={{ display: "flex", gap: 8, justifyContent: "center", paddingTop: 4 }}>
                <button onClick={onCancel} style={{ ...btnStyle("outline"), flex: 1, justifyContent: "center" }}>Cancel</button>
                <button
                    onClick={submit}
                    style={{ ...btnStyle("primary"), flex: 1, justifyContent: "center" }}
                    aria-label={isAdd ? "Save new job" : "Save changes"}
                >
                    {isAdd ? "Add Job" : "Save changes"}
                </button>
            </div>
        </div>
    );
}

function Field({ label, required, error, children }) {
    return (
        <div>
            <label style={{ display: "block", marginBottom: 5, fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", fontFamily: "var(--font-sans)" }}>
                {label}
                {required && <span style={{ color: "var(--danger)", marginLeft: 3 }} aria-hidden="true">*</span>}
                {required && <span className="sr-only"> (required)</span>}
            </label>
            {children}
            {error && <p role="alert" style={{ margin: "4px 0 0", fontSize: 12, color: "var(--danger)" }}>{error}</p>}
        </div>
    );
}

function WriteIn({ placeholder, onAdd }) {
    const [val, setVal] = useState("");
    const submit = () => {
        const trimmed = val.trim();
        if (trimmed) { onAdd(trimmed); setVal(""); }
    };
    return (
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <label htmlFor="writein-input" className="sr-only">{placeholder}</label>
            <input
                id="writein-input"
                value={val}
                onChange={e => setVal(e.target.value)}
                placeholder={placeholder}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
                style={{ ...inputStyle(), flex: 1, fontSize: 13 }}
                aria-label={placeholder}
            />
            <button onClick={submit} style={{ ...btnStyle("outline"), fontSize: 13, padding: "5px 10px" }}>Add</button>
        </div>
    );
}

function inputStyle(error) {
    return {
        width: "100%",
        padding: "8px 10px",
        fontSize: 14,
        borderRadius: 8,
        border: `1px solid ${error ? "var(--danger)" : "var(--border-default)"}`,
        background: "var(--bg-subtle)",
        color: "var(--text-primary)",
        outline: "none",
        transition: "border-color 0.12s",
        boxSizing: "border-box",
        fontFamily: "var(--font-sans)",
    };
}