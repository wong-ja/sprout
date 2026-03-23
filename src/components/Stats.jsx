import { useMemo } from "react";
import { fmtDateShort } from "../store.js";

// ================================================================================================
const CHART_COLORS = ["#a8b5c8", "#8fa8c0", "#7a9ab8", "#6388ab", "#4d769e", "#3a6491", "#2a5480"];
const STAGE_PALETTE = {
    "Phone Screen":     "#c8cfd8",
    "Recruiter Call":   "#c8cfd8",
    "Hiring Manager":   "#d4c4a8",
    "Technical Screen": "#a8b8d0",
    "Take-Home":        "#c0b0d0",
    "Panel":            "#a8ccb8",
    "Final Round":      "#d0b8a0",
    "Reference Check":  "#a8c8d4",
};

//  =========================================================================================
export default function Stats({ jobs, allJobs, columns, hasFilters }) {
    const s = useMemo(() => compute(jobs, columns), [jobs, columns]);

    return (
        <div
            role="region"
            aria-label="Application statistics dashboard"
            style={{ flex: 1, overflowY: "auto", padding: "20px", background: "var(--bg-page)" }}
        >
        <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

            {/* FILTERS NOTICE */}
            {hasFilters && (
                <div style={{
                    background: "var(--accent-light)",
                    border: "1px solid var(--border-default)",
                    borderRadius: 10, padding: "9px 14px",
                    fontSize: 12, color: "var(--accent-text)",
                    display: "flex", alignItems: "center", gap: 6,
                }} role="status">
                    <span aria-hidden="true">⚡</span>
                    Stats are showing filtered results — {jobs.length} of {allJobs.length} jobs.
                    Remove filters to see your full picture.
                </div>
            )}

            {/* SUMMARY STATS */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
                {[
                    { label: "Total tracked",  val: s.total },
                    { label: "Applications",   val: s.applied },
                    { label: "Interviews",     val: s.interviews },
                    { label: "Offers",         val: s.offers },
                    { label: "Rejected",       val: s.rejected },
                    { label: "Response rate",  val: `${s.responseRate}%` },
                ].map((m) => (
                    <MetricCard key={m.label} label={m.label} value={m.val} />
                ))}
            </div>

            {/* PIPELINE OVERVIEW + INTEVRIEW STAGES BREAKDOWN */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <ChartCard title="Pipeline" description="Jobs at each stage">
                    <FunnelChart columns={columns} jobs={jobs} />
                </ChartCard>
                <ChartCard title="Interview stages" description="Breakdown of active interviews">
                    {s.stageCounts.length === 0
                        ? <EmptyState text="No interviews yet" />
                        : <HorizontalBars data={s.stageCounts} palette={STAGE_PALETTE} maxVal={Math.max(...s.stageCounts.map(d => d.count))} />}
                </ChartCard>
            </div>

            {/* INDUSTRIES BREAKDOWN + WORK MODE */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <ChartCard title="Industries" description="Applications by sector">
                    {s.industries.length === 0
                        ? <EmptyState text="No industry data" />
                        : <HorizontalBars data={s.industries} maxVal={s.industries[0]?.count ?? 1} />}
                </ChartCard>
                <ChartCard title="Work mode" description="Remote vs. hybrid vs. on-site">
                    {s.workModes.length === 0
                        ? <EmptyState text="No work mode data" />
                        : <DonutChart data={s.workModes} />}
                </ChartCard>
            </div>

            {/* APPLICATION ACTIVITY / TIMELINE + TOP TAGS */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
                <ChartCard title="Activity" description="Jobs added over time">
                    {s.timeline.length < 2
                        ? <EmptyState text="Add more jobs to see trends" />
                        : <TimelineChart data={s.timeline} />}
                </ChartCard>
                <ChartCard title="Top tags" description="Most used keywords">
                    {s.tags.length === 0
                        ? <EmptyState text="No tags yet" />
                        : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {s.tags.slice(0, 8).map(({ tag, count }) => (
                                    <div key={tag} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                                        <span style={{ fontSize: 12, color: "var(--text-secondary)", flex: 1 }} className="truncate">{tag}</span>
                                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                            <div style={{ width: 60, height: 4, borderRadius: 2, background: "var(--border-default)", overflow: "hidden" }}>
                                            <div style={{ width: `${Math.round((count / s.tags[0].count) * 100)}%`, height: "100%", background: "var(--accent)", borderRadius: 2 }} />
                                            </div>
                                            <span style={{ fontSize: 11, color: "var(--text-tertiary)", minWidth: 16, textAlign: "right" }}>{count}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    }
                </ChartCard>
            </div>

            {/* RECENTLY ADDED JOBS / ACTIVITY */}
            <ChartCard title="Recently added" description="Last 8 jobs">
                {s.recent.length === 0
                    ? <EmptyState text="No jobs yet" />
                    : (
                        <table style={{ width: "100%", borderCollapse: "collapse" }} aria-label="Recently added jobs">
                            <thead>
                                <tr>
                                    {["Company", "Role", "Status", "Added"].map((h) => (
                                        <th key={h} scope="col" style={{ padding: "6px 8px", fontSize: 10, fontWeight: 600, color: "var(--text-tertiary)", textAlign: "left", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--border-subtle)" }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {s.recent.map((j) => {
                                    const col = columns.find((c) => c.id === j.column);
                                    return (
                                        <tr key={j.id}>
                                            <td style={tdStyle}><span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{j.company}</span></td>
                                            <td style={tdStyle}>{j.role}</td>
                                            <td style={tdStyle}>
                                                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, padding: "2px 8px", borderRadius: 99, background: col?.bg, color: col?.textColor ?? col?.color, fontWeight: 600 }}>
                                                    {col?.label}
                                                </span>
                                            </td>
                                            <td style={{ ...tdStyle, color: "var(--text-tertiary)", fontSize: 11 }}>{fmtDateShort(j.createdAt)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )
                }
            </ChartCard>
        </div>
        </div>
    );
}


//  =========================================================================================
function MetricCard({ label, value }) {
    return (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 10, padding: "14px 16px" }}>
            <p style={{ margin: "0 0 4px", fontSize: 10, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
            <p style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>{value}</p>
        </div>
    );
}

function ChartCard({ title, description, children }) {
    return (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ marginBottom: 14 }}>
                <p style={{ margin: "0 0 2px", fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>{title}</p>
                <p style={{ margin: 0, fontSize: 11, color: "var(--text-tertiary)" }}>{description}</p>
            </div>
            {children}
        </div>
    );
}

//  =========================================================================================
function EmptyState({ text }) {
    return <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: "16px 0", textAlign: "center" }}>{text}</p>;
}

//  =========================================================================================
function FunnelChart({ columns, jobs }) {
    const max = Math.max(...columns.map((c) => jobs.filter((j) => j.column === c.id).length), 1);
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {columns.map((col) => {
                const count = jobs.filter((j) => j.column === col.id).length;
                const pct = Math.round((count / max) * 100);
                return (
                    <div key={col.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 5, height: 5, borderRadius: "50%", background: col.color, flexShrink: 0 }} aria-hidden="true" />
                        <span style={{ width: 88, fontSize: 12, color: "var(--text-secondary)", flexShrink: 0, fontWeight: 500 }}>{col.label}</span>
                        <div style={{ flex: 1, height: 6, background: "var(--bg-subtle)", borderRadius: 3, overflow: "hidden" }} role="progressbar" aria-valuenow={count} aria-valuemax={max} aria-label={`${col.label}: ${count} jobs`}>
                            <div style={{ width: `${pct}%`, height: "100%", background: col.color, borderRadius: 3, opacity: 0.7, transition: "width 0.4s ease" }} />
                        </div>
                        <span style={{ width: 20, fontSize: 12, color: "var(--text-tertiary)", textAlign: "right", flexShrink: 0 }}>{count}</span>
                    </div>
                );
            })}
        </div>
    );
}

//  =========================================================================================
function HorizontalBars({ data, maxVal, palette }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.map(({ label, count }, i) => {
                const pct = Math.round((count / maxVal) * 100);
                const color = palette?.[label] ?? CHART_COLORS[i % CHART_COLORS.length];
                return (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ width: 110, fontSize: 11, color: "var(--text-secondary)", flexShrink: 0 }} className="truncate">{label}</span>
                        <div style={{ flex: 1, height: 6, background: "var(--bg-subtle)", borderRadius: 3, overflow: "hidden" }} role="progressbar" aria-valuenow={count} aria-valuemax={maxVal} aria-label={`${label}: ${count}`}>
                            <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.4s ease" }} />
                        </div>
                        <span style={{ width: 20, fontSize: 11, color: "var(--text-tertiary)", textAlign: "right", flexShrink: 0 }}>{count}</span>
                    </div>
                );
            })}
        </div>
    );
}

//  =========================================================================================
function DonutChart({ data }) {
    const total = data.reduce((s, d) => s + d.count, 0);
    let offset = 0;
    const r = 36, cx = 48, cy = 48, circ = 2 * Math.PI * r;

    return (
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <svg width={96} height={96} role="img" aria-label="Work mode donut chart" style={{ flexShrink: 0 }}>
                <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border-subtle)" strokeWidth={10} />
                {data.map(({ label, count }, i) => {
                    const pct = count / total;
                    const dash = pct * circ;
                    const seg = (
                        <circle
                            key={label}
                            cx={cx} cy={cy} r={r}
                            fill="none"
                            stroke={CHART_COLORS[i % CHART_COLORS.length]}
                            strokeWidth={10}
                            strokeDasharray={`${dash} ${circ - dash}`}
                            strokeDashoffset={-offset}
                            strokeLinecap="round"
                            transform={`rotate(-90 ${cx} ${cy})`}
                            aria-label={`${label}: ${count}`}
                        />
                    );
                    offset += dash;
                    return seg;
                })}
                <text x={cx} y={cy + 5} textAnchor="middle" style={{ fontSize: 14, fontWeight: 700, fill: "var(--text-primary)" }}>{total}</text>
            </svg>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {data.map(({ label, count }, i) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: CHART_COLORS[i % CHART_COLORS.length], flexShrink: 0 }} aria-hidden="true" />
                        <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{label}</span>
                        <span style={{ fontSize: 11, color: "var(--text-tertiary)", marginLeft: 4 }}>{count}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

//  =========================================================================================
function TimelineChart({ data }) {
    const max = Math.max(...data.map((d) => d.count), 1);
    const H = 80, W = "100%";
    const pts = data.map((d, i) => {
        const x = (i / (data.length - 1)) * 100;
        const y = H - Math.round((d.count / max) * (H - 10));
        return `${x}%,${y}`;
    });

    return (
        <div>
            <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" style={{ width: W, height: H, display: "block", overflow: "visible" }} role="img" aria-label="Jobs added over time">
                <polyline
                    points={pts.map((p, i) => {
                        const [x, y] = p.split(",");
                        return `${x} ${y}`;
                    }).join(" ")}
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.6"
                    vectorEffect="non-scaling-stroke"
                />
                {pts.map((p, i) => {
                    const [x, y] = p.split(",");
                    return (
                        <circle key={i} cx={x} cy={y} r="2" fill="var(--accent)" opacity="0.8" vectorEffect="non-scaling-stroke">
                            <title>{`${data[i].label}: ${data[i].count}`}</title>
                        </circle>
                    );
                })}
            </svg>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                {data.filter((_, i) => i === 0 || i === data.length - 1 || i === Math.floor(data.length / 2)).map((d) => (
                    <span key={d.label} style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{d.label}</span>
                ))}
            </div>
        </div>
    );
}

const tdStyle = { padding: "7px 8px", fontSize: 12, color: "var(--text-secondary)", borderBottom: "1px solid var(--border-subtle)" };


// =========== DATA COMPUTATION ================================================================
function compute(jobs, columns) {
    const total      = jobs.length;
    const applied    = jobs.filter((j) => j.column !== "watchlist").length;
    const interviews = jobs.filter((j) => j.column === "interviewing").length;
    const offers     = jobs.filter((j) => j.column === "offer").length;
    const rejected   = jobs.filter((j) => j.column === "rejected").length;
    const responseRate = applied > 0
        ? Math.round((jobs.filter((j) => ["interviewing", "offer"].includes(j.column)).length / applied) * 100)
        : 0;

    // INTERVIEW STAGES
    const stageCounts = Object.entries(
        jobs.filter((j) => j.column === "interviewing" && j.interviewStage)
            .reduce((acc, j) => ({ ...acc, [j.interviewStage]: (acc[j.interviewStage] ?? 0) + 1 }), {})
    ).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);

    // INDUSTRIES
    const industries = Object.entries(
        jobs.filter((j) => j.industry)
            .reduce((acc, j) => ({ ...acc, [j.industry]: (acc[j.industry] ?? 0) + 1 }), {})
    ).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, 8);

    // WORK MODES
    const workModes = Object.entries(
        jobs.filter((j) => j.workMode)
            .reduce((acc, j) => ({ ...acc, [j.workMode]: (acc[j.workMode] ?? 0) + 1 }), {})
    ).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);

    // TAGS
    const tagMap = {};
    jobs.forEach((j) => (j.tags ?? []).forEach((t) => { tagMap[t] = (tagMap[t] ?? 0) + 1; }));
    const tags = Object.entries(tagMap).map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count);

    // TIMELINE (last 8 weeks)
    const now = Date.now();
    const MS_WEEK = 7 * 24 * 60 * 60 * 1000;
    const timeline = Array.from({ length: 8 }, (_, i) => {
        const weekStart = now - (7 - i) * MS_WEEK;
        const weekEnd   = weekStart + MS_WEEK;
        const count = jobs.filter((j) => j.createdAt >= weekStart && j.createdAt < weekEnd).length;
        const d = new Date(weekStart);
        const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        return { label, count };
    });

    const recent = [...jobs].sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);

    return { total, applied, interviews, offers, rejected, responseRate, stageCounts, industries, workModes, tags, timeline, recent };
}