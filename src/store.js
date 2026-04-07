export const STORAGE_KEY = "sprout_v1";
export const DISMISSED_BANNER_KEY = "sprout_banner_dismissed";

export const DEFAULT_COLUMNS = [
    { id: "watchlist",   label: "Watchlist",    color: "var(--col-watchlist-dot)",  bg: "var(--col-watchlist-bg)",  textColor: "var(--col-watchlist-text)",  locked: true },
    { id: "applied",     label: "Applied",      color: "var(--col-applied-dot)",    bg: "var(--col-applied-bg)",    textColor: "var(--col-applied-text)",    locked: true },
    { id: "interviewing",label: "Interviewing", color: "var(--col-interview-dot)",  bg: "var(--col-interview-bg)",  textColor: "var(--col-interview-text)", locked: true },
    { id: "offer",       label: "Offer",        color: "var(--col-offer-dot)",      bg: "var(--col-offer-bg)",      textColor: "var(--col-offer-text)",      locked: true },
    { id: "rejected",    label: "Rejected",     color: "var(--col-rejected-dot)",   bg: "var(--col-rejected-bg)",   textColor: "var(--col-rejected-text)",   locked: true },
];

export const INTERVIEW_STAGES = [
    "Phone Screen",
    "Recruiter Call",
    "Hiring Manager",
    "Technical Screen",
    "Take-Home",
    "Panel",
    "Final Round",
    "Reference Check",
];

export const JOB_TYPES = ["Full-time", "Part-time", "Contract", "Freelance", "Internship", "Temporary", "Volunteer"];
export const WORK_MODES = ["Remote", "Hybrid", "On-site", "Flexible"];
export const INDUSTRIES = [
    "Technology", "Healthcare", "Education", "Finance", "Legal", "Marketing",
    "Design & Creative", "Engineering", "Nonprofit", "Government", "Retail",
    "Hospitality", "Media & Entertainment", "Real Estate", "Construction",
    "Manufacturing", "Agriculture", "Transportation", "Research & Science", "Other",
];
export const APPLICATION_REQUIREMENTS = [
    "Resume / CV", "Cover Letter", "Portfolio", "References", "Writing Sample",
    "Work Sample", "Assessment / Test", "Transcript", "Background Check",
    "Video Introduction", "LinkedIn Profile", "GitHub Profile", "Personal Website",
];


// ============ PALETTE PRESETS from Coolers ===============================================
export const PALETTES = [
    { id: "lake",        label: "Lake",           swatch: "#4c82f5" },
    { id: "harvest",     label: "Harvest",        swatch: "#dd911e" },
    { id: "clay",        label: "Clay",           swatch: "#c2452d" },
    { id: "sorbet",      label: "Sorbet",         swatch: "#f23c8e" },
    { id: "violet",      label: "Violet",         swatch: "#906df7" },
    { id: "emerald",     label: "Emerald",        swatch: "#00bc7d" },
    { id: "tropical",    label: "Tropical",       swatch: "#f74444" },
    { id: "slate",       label: "Slate",          swatch: "#3a506e" },
    { id: "hc",          label: "High Contrast",  swatch: "#000000", description: "Accessibility (WCAG AAA)" },
];


// ============ SAMPLE JOBS DATA IN DASHBOARD ===============================================
export const SAMPLE_JOBS = [
    {
        id: "sample-1",
        company: "Meridian Health",
        role: "UX Designer",
        location: "Chicago, IL",
        workMode: "Hybrid",
        jobType: "Full-time",
        industry: "Healthcare",
        salary: "$85k–$105k",
        column: "interviewing",
        interviewStage: "Panel",
        url: "",
        notes: "Great mission. Met recruiter at a conference. Portfolio required.",
        tags: ["healthcare", "ux", "figma"],
        requirements: ["Resume / CV", "Portfolio", "References"],
        referralContact: "Jenna Park (Director of Design)",
        recruiterName: "Sam Torres",
        recruiterEmail: "storres@meridianhealth.com",
        applicationDeadline: "",
        description: "",
        createdAt: Date.now() - 86400000 * 4,
    },
    {
        id: "sample-2",
        company: "Oaktree Publishing",
        role: "Content Strategist",
        location: "Remote",
        workMode: "Remote",
        jobType: "Full-time",
        industry: "Media & Entertainment",
        salary: "$70k–$90k",
        column: "applied",
        interviewStage: "",
        url: "",
        notes: "Sent application Tuesday. Writing sample required.",
        tags: ["content", "writing", "remote"],
        requirements: ["Resume / CV", "Cover Letter", "Writing Sample"],
        referralContact: "",
        recruiterName: "",
        recruiterEmail: "",
        applicationDeadline: "",
        description: "",
        createdAt: Date.now() - 86400000 * 6,
    },
    {
        id: "sample-3",
        company: "Veritas Labs",
        role: "Data Analyst",
        location: "Austin, TX",
        workMode: "On-site",
        jobType: "Full-time",
        industry: "Research & Science",
        salary: "$95k–$120k",
        column: "watchlist",
        interviewStage: "",
        url: "",
        notes: "Interesting work on climate data. Will apply by Friday.",
        tags: ["data", "python", "climate"],
        requirements: ["Resume / CV", "Cover Letter"],
        referralContact: "",
        recruiterName: "",
        recruiterEmail: "",
        applicationDeadline: "",
        description: "",
        createdAt: Date.now() - 86400000 * 1,
    },
    {
        id: "sample-4",
        company: "Clearline Law",
        role: "Legal Operations Coordinator",
        location: "New York, NY",
        workMode: "Hybrid",
        jobType: "Full-time",
        industry: "Legal",
        salary: "$65k–$80k",
        column: "offer",
        interviewStage: "",
        url: "",
        notes: "Verbal offer received. Waiting on written offer letter.",
        tags: ["legal", "operations"],
        requirements: ["Resume / CV", "References", "Background Check"],
        referralContact: "Marcus Reid (Partner)",
        recruiterName: "",
        recruiterEmail: "",
        applicationDeadline: "",
        description: "",
        createdAt: Date.now() - 86400000 * 12,
    },
    {
        id: "sample-5",
        company: "Fieldwork Studio",
        role: "Graphic Designer",
        location: "Portland, OR",
        workMode: "On-site",
        jobType: "Full-time",
        industry: "Design & Creative",
        salary: "$60k–$75k",
        column: "rejected",
        interviewStage: "",
        url: "",
        notes: "Great portfolio feedback but went with someone local.",
        tags: ["design", "branding", "illustration"],
        requirements: ["Resume / CV", "Portfolio"],
        referralContact: "",
        recruiterName: "",
        recruiterEmail: "",
        applicationDeadline: "",
        description: "",
        createdAt: Date.now() - 86400000 * 9,
    },
];

// ============ STORAGE & HELPER FUNCTIONS, IMPORT/EXPORT ===============================
function parse(raw, fallback) {
    try { return raw ? JSON.parse(raw) : fallback; }
    catch { return fallback; }
}

export function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    const saved = parse(raw, null);
    if (saved) return saved;
    return {
        jobs: SAMPLE_JOBS,
        columns: DEFAULT_COLUMNS,
        palette: "harvest",
        theme: "light",
        view: "board",
    };
}

export function saveState(state) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (e) { console.warn("Sprout: localStorage write failed", e); }
}

export function isBannerDismissed() {
    return localStorage.getItem(DISMISSED_BANNER_KEY) === "1";
}

export function dismissBanner() {
    localStorage.setItem(DISMISSED_BANNER_KEY, "1");
}

export function exportData(state) {
    const blob = new Blob(
        [JSON.stringify({ ...state, exportedAt: new Date().toISOString(), version: 2 }, null, 2)],
        { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sprout-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

export function importData(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (!data.jobs || !Array.isArray(data.jobs)) throw new Error("Invalid backup file.");
                resolve(data);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error("Could not read file."));
        reader.readAsText(file);
    });
}

// ============ other HELPER FUNCTIONS ===============================
export const genId = () => `j_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

export const fmtDate = (ts) =>
    new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export const fmtDateShort = (ts) =>
    new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export function getInitials(name = "") {
    return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

export function columnById(columns, id) {
    return columns.find((c) => c.id === id) ?? columns[0];
}


// ===================== DEFAULT FILTER STATES ====================================
export const DEFAULT_FILTERS = {
    columns:      [],   // status column ids
    workModes:    [],
    jobTypes:     [],
    industries:   [],
    stages:       [],
    requirements: [],
    tags:         [],
    dateRange:    "all",
    dateFrom:     "",
    dateTo:       "",
    sortBy:       "createdAt",
    sortDir:      "desc",
    groupBy:      "status",
};

export const DATE_RANGES = [
    { id: "all",    label: "Any time"      },
    { id: "7d",     label: "Last 7 days"   },
    { id: "30d",    label: "Last 30 days"  },
    { id: "90d",    label: "Last 90 days"  },
    { id: "custom", label: "Custom range"  },
];

export const SORT_OPTIONS = [
    { id: "createdAt",   label: "Date added"    },
    { id: "company",     label: "Company"       },
    { id: "role",        label: "Role"          },
    { id: "salary",      label: "Salary"        },
];

export const GROUP_OPTIONS = [
    { id: "status",    label: "Status"    },
    { id: "industry",  label: "Industry"  },
    { id: "workMode",  label: "Work mode" },
    { id: "jobType",   label: "Job type"  },
    { id: "none",      label: "No grouping" },
];


// =============== apply filters + sort to a jobs array ======================

export function applyFilters(jobs, filters) {
    let out = [...jobs];

    if (filters.columns?.length)
        out = out.filter(j => filters.columns.includes(j.column));

    if (filters.workModes?.length)
        out = out.filter(j => filters.workModes.includes(j.workMode));

    if (filters.jobTypes?.length)
        out = out.filter(j => filters.jobTypes.includes(j.jobType));

    if (filters.industries?.length)
        out = out.filter(j => filters.industries.includes(j.industry));

    if (filters.stages?.length)
        out = out.filter(j => filters.stages.includes(j.interviewStage));

    if (filters.requirements?.length)
        out = out.filter(j => filters.requirements.every(r => (j.requirements ?? []).includes(r)));

    if (filters.tags?.length)
        out = out.filter(j => filters.tags.some(t => (j.tags ?? []).includes(t)));


    // date filtering
    if (filters.dateRange && filters.dateRange !== "all") {
        const now = Date.now();
        const MS = { "7d": 7, "30d": 30, "90d": 90 };
        if (filters.dateRange === "custom") {
            const from = filters.dateFrom ? new Date(filters.dateFrom).getTime() : 0;
            const to   = filters.dateTo   ? new Date(filters.dateTo).getTime() + 86399999 : now;
            out = out.filter(j => j.createdAt >= from && j.createdAt <= to);
        } else {
            const cutoff = now - MS[filters.dateRange] * 86400000;
            out = out.filter(j => j.createdAt >= cutoff);
        }
    }

    // sort
    const key = filters.sortBy ?? "createdAt";
    const dir = filters.sortDir === "asc" ? 1 : -1;
    out.sort((a, b) => {
        const av = a[key] ?? "";
        const bv = b[key] ?? "";
        return typeof av === "number"
            ? (av - bv) * dir
            : String(av).localeCompare(String(bv), undefined, { sensitivity: "base" }) * dir;
    });

    return out;
}


// =============== COUNT ACTIVE FILTERS ================================================
export function activeFilterCount(filters) {
    return (
        (filters.columns?.length      ?? 0) +
        (filters.workModes?.length    ?? 0) +
        (filters.jobTypes?.length     ?? 0) +
        (filters.industries?.length   ?? 0) +
        (filters.stages?.length       ?? 0) +
        (filters.requirements?.length ?? 0) +
        (filters.tags?.length         ?? 0) +
        (filters.dateRange !== "all"  ? 1 : 0)
    );
}

// ======== GROUP BY FUNCTION: default status ===========================================
export function groupJobs(jobs, groupBy, columns) {
    if (!groupBy || groupBy === "none") return [{ key: "all", label: "All", jobs }];
    if (groupBy === "status") {
        return columns.map(col => ({ key: col.id, label: col.label, col, jobs: jobs.filter(j => j.column === col.id) }));
    }
    const fieldMap = { industry: "industry", workMode: "workMode", jobType: "jobType" };
    const field = fieldMap[groupBy] ?? groupBy;
    const groups = {};
    jobs.forEach(j => {
        const val = j[field] || "Unspecified";
        if (!groups[val]) groups[val] = [];
        groups[val].push(j);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([key, jobs]) => ({ key, label: key, jobs }));
}

export function btnStyle(variant = "outline") {
    const base = {
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "6px 10px", borderRadius: 8, fontSize: 13, fontWeight: 500,
        cursor: "pointer", transition: "background 0.15s, color 0.15s, border-color 0.15s",
        lineHeight: 1.4, whiteSpace: "nowrap",
    };
    if (variant === "primary") return { ...base, background: "var(--accent)", color: "#fff", border: "none" };
    if (variant === "outline") return { ...base, background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-default)" };
    if (variant === "ghost")     return { ...base, background: "transparent", color: "var(--text-secondary)", border: "none" };
    if (variant === "danger")    return { ...base, background: "var(--danger-bg)", color: "var(--danger)", border: "1px solid var(--danger)" };
    return base;
}