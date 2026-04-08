import { useMemo } from "react";
import { fmtDateShort } from "../store.js";

// ================================================================================================
// PALETTES
const CHART_COLORS = ["#ffc592", "#7dbbf4", "#7ef5ac", "#82f4dd", "#ceaefc", "#fb9292", "#d3f88e"];
const STAGE_PALETTE = {
    "Phone Screen":     "#3d8bf2",
    "Recruiter Call":   "#48de5c",
    "Hiring Manager":   "#f2f52d",
    "Technical Screen": "#5552f9",
    "Take-Home":        "#f2404f",
    "Panel":            "#cc44e1",
    "Final Round":      "#fa8f23",
    "Reference Check":  "#f954de",
};

//  =========================================================================================
// SALARY PARSER HELPER: returns { min, max, mid } in thousands, or null
function parseSalary(str) {
    if (!str) return null;
    const nums = [];
    const re = /[\$£€]?([\d,]+)\s*[kK]?/g;
    let m;
    while ((m = re.exec(str)) !== null) {
        let n = parseFloat(m[1].replace(/,/g, ""));
        // treat bare numbers > 1000 as dollars, < 1000 as already-k
        if (/[kK]/.test(str.slice(m.index, m.index + m[0].length + 1))) n = n;
        else if (n > 1000) n = n / 1000;
        if (n > 0 && n < 1000) nums.push(n);
    }
    if (!nums.length) return null;
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    return { min, max, mid: (min + max) / 2 };
}


//
export default function Stats({ jobs, allJobs, columns, hasFilters, onFilterChange, onViewChange }) {
    const s = useMemo(() => compute(jobs, columns), [jobs, columns]);

    // click-to-filter: set a filter and jump to Board view
    const filterTo = (key, value) => {
        if (!onFilterChange || !onViewChange) return;
        onFilterChange(f => ({ ...f, [key]: [value] }));
        onViewChange("board");
    };
    const filterToIndustry  = industry  => filterTo("industries", industry);
    const filterToWorkMode  = workMode  => filterTo("workModes",  workMode);
    const filterToColumn    = colId     => filterTo("columns",    colId);
    const filterToStage     = stage     => filterTo("stages",     stage);

    return (
        <div
            role="region"
            aria-label="Application statistics dashboard"
            style={{ flex: 1, overflowY: "auto", padding: "20px", background: "var(--bg-page)" }}
        >
            <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

                {/* FILTERS NOTICE */}
                {hasFilters && (
                    <div style={{ background: "var(--accent-light)", border: "1px solid var(--border-default)", borderRadius: 10, padding: "9px 14px", fontSize: 12, color: "var(--accent-text)", display: "flex", alignItems: "center", gap: 6 }} role="status">
                        <span aria-hidden="true">⚡</span>
                        Stats show filtered results — {jobs.length} of {allJobs.length} jobs. Remove filters to see your full picture.
                    </div>
                )}

                {/* SUMMARY STATS / METRIC CARDS */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
                    {[
                        { label: "Total tracked",       val: s.total, colorIndex: 1 },
                        { label: "Applications",        val: s.applied, colorIndex: 0 },
                        { label: "Interviews",          val: s.interviews, colorIndex: 2 },
                        { label: "Offers",              val: s.offers, colorIndex: 3 },
                        { label: "Rejected",            val: s.rejected, colorIndex: 5 },
                        { label: "Response rate",       val: `${s.responseRate}%`, colorIndex: 4 },
                        { label: "Avg. days to reply",  val: s.avgDaysToResponse !== null ? `${s.avgDaysToResponse}d` : "—", title: "Average days from adding a job to reaching Interviewing", colorIndex: 6 },
                        { label: "Active this week",    val: s.activeThisWeek, colorIndex: 2 },
                    ].map(m => (
                        <MetricCard key={m.label} label={m.label} value={m.val} title={m.title} colorIndex={m.colorIndex} />
                    ))}
                </div>

                {/* ROW 1: PIPELINE OVERVIEW + INTEVRIEW STAGES BREAKDOWN */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <ChartCard title="Pipeline" description="Jobs at each stage — click to filter">
                        <FunnelChart columns={columns} jobs={jobs} onClickCol={filterToColumn} />
                    </ChartCard>
                    <ChartCard title="Interview stages" description="Breakdown of active interviews — click to filter">
                        {s.stageCounts.length === 0
                            ? <EmptyState text="No interviews yet" />
                            : <HorizontalBars
                                data={s.stageCounts}
                                palette={STAGE_PALETTE}
                                maxVal={Math.max(...s.stageCounts.map(d => d.count))}
                                onClickRow={filterToStage}
                            />}
                    </ChartCard>
                </div>

                {/* ROW 2: INDUSTRIES BREAKDOWN + WORK MODE */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <ChartCard title="Industries" description="Applications by sector — click to filter">
                        {s.industries.length === 0
                            ? <EmptyState text="No industry data" />
                            : <HorizontalBars
                                data={s.industries}
                                maxVal={s.industries[0]?.count ?? 1}
                                onClickRow={filterToIndustry}
                            />}
                    </ChartCard>
                    <ChartCard title="Work mode" description="Remote vs. hybrid vs. on-site — click to filter">
                        {s.workModes.length === 0
                            ? <EmptyState text="No work mode data" />
                            : <DonutChart data={s.workModes} onClickSegment={filterToWorkMode} />}
                    </ChartCard>
                </div>

                {/* ROW 3: Salary Distribution + Response Timeframe Histogram */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <ChartCard title="Salary ranges" description="Parsed min-max from salary field">
                        {s.salaryRanges.length === 0
                            ? <EmptyState text="Add salary info to jobs to see distribution" />
                            : <SalaryChart data={s.salaryRanges} />}
                    </ChartCard>
                    <ChartCard title="Days to first interview" description="How long before hearing back">
                        {s.daysToResponseBuckets.every(b => b.count === 0)
                            ? <EmptyState text="No interview data yet" />
                            : <BucketBars data={s.daysToResponseBuckets} />}
                    </ChartCard>
                </div>

                {/* ROW 4: APPLICATION ACTIVITY / TIMELINE + Rejection Rate by Industry */}
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
                    <ChartCard title="Activity" description="Jobs added over time">
                        {s.timeline.length < 2
                            ? <EmptyState text="Add more jobs to see trends" />
                            : <TimelineChart data={s.timeline} trend={s.timelineTrend} />}
                    </ChartCard>
                    <ChartCard title="Rejection rate" description="By industry (min. 2 jobs)">
                        {s.rejectionByIndustry.length === 0
                            ? <EmptyState text="Not enough data yet" />
                            : <RejectionChart data={s.rejectionByIndustry} onClickRow={filterToIndustry} />}
                    </ChartCard>
                </div>

                {/* ROW 5: Frequency of Requirements + TOP TAGS */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <ChartCard title="Requirements" description="Most requested application materials">
                        {s.requirementFreq.length === 0
                            ? <EmptyState text="No requirements data" />
                            : <HorizontalBars
                                data={s.requirementFreq}
                                maxVal={s.requirementFreq[0]?.count ?? 1}
                            />}
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
                            )}
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
                                        {["Company", "Role", "Status", "Added"].map(h => (
                                            <th key={h} scope="col" style={{ padding: "6px 8px", fontSize: 10, fontWeight: 600, color: "var(--text-tertiary)", textAlign: "left", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--border-subtle)" }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {s.recent.map(j => {
                                        const col = columns.find(c => c.id === j.column);
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
                        )}
                </ChartCard>

            </div>
        </div>
    );
}



// shared wrappers
function MetricCard({ label, value, title, colorIndex }) {
    const subtleBg = colorIndex !== undefined 
        ? `linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.4) 100%), rgba(${parseInt(CHART_COLORS[colorIndex].slice(1), 16)}, ${parseInt(CHART_COLORS[colorIndex].slice(3,5), 16)}, ${parseInt(CHART_COLORS[colorIndex].slice(5,7), 16)}, 0.25)` 
        : "var(--bg-surface)";
    return (
        <div
            title={title}
            style={{ background: subtleBg, border: "1px solid var(--border-default)", borderRadius: 10, padding: "14px 16px" }}
        >
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

function EmptyState({ text }) {
    return <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: "16px 0", textAlign: "center" }}>{text}</p>;
}

// pipeline funnel
function FunnelChart({ columns, jobs, onClickCol }) {
    const max = Math.max(...columns.map(c => jobs.filter(j => j.column === c.id).length), 1);
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {columns.map(col => {
                const count = jobs.filter(j => j.column === col.id).length;
                const pct   = Math.round((count / max) * 100);
                return (
                    <button
                        key={col.id}
                        onClick={() => onClickCol?.(col.id)}
                        disabled={!onClickCol || count === 0}
                        style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", padding: "2px 0", cursor: onClickCol && count > 0 ? "pointer" : "default", borderRadius: 4, width: "100%", textAlign: "left" }}
                        title={onClickCol && count > 0 ? `Filter to ${col.label}` : undefined}
                    >
                        <div style={{ width: 5, height: 5, borderRadius: "50%", background: col.color, flexShrink: 0 }} aria-hidden="true" />
                        <span style={{ width: 88, fontSize: 12, color: "var(--text-secondary)", flexShrink: 0, fontWeight: 500 }}>{col.label}</span>
                        <div style={{ flex: 1, height: 6, background: "var(--bg-subtle)", borderRadius: 3, overflow: "hidden" }} role="progressbar" aria-valuenow={count} aria-valuemax={max} aria-label={`${col.label}: ${count} jobs`}>
                            <div style={{ width: `${pct}%`, height: "100%", background: col.color, borderRadius: 3, opacity: 0.75, transition: "width 0.4s ease" }} />
                        </div>
                        <span style={{ width: 20, fontSize: 12, color: "var(--text-tertiary)", textAlign: "right", flexShrink: 0 }}>{count}</span>
                    </button>
                );
            })}
        </div>
    );
}

// horizontal bars (for industries, stages, requirements)
function HorizontalBars({ data, maxVal, palette, onClickRow }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.map(({ label, count }, i) => {
                const pct   = Math.round((count / maxVal) * 100);
                const color = palette?.[label] ?? CHART_COLORS[i % CHART_COLORS.length];
                const clickable = onClickRow && count > 0;
                return (
                    <button
                        key={label}
                        onClick={() => onClickRow?.(label)}
                        disabled={!clickable}
                        style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", padding: "2px 0", cursor: clickable ? "pointer" : "default", borderRadius: 4, width: "100%", textAlign: "left" }}
                        title={clickable ? `Filter to ${label}` : undefined}
                    >
                        <span style={{ width: 110, fontSize: 11, color: "var(--text-secondary)", flexShrink: 0 }} className="truncate">{label}</span>
                        <div style={{ flex: 1, height: 6, background: "var(--bg-subtle)", borderRadius: 3, overflow: "hidden" }} role="progressbar" aria-valuenow={count} aria-valuemax={maxVal} aria-label={`${label}: ${count}`}>
                            <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.4s ease" }} />
                        </div>
                        <span style={{ width: 20, fontSize: 11, color: "var(--text-tertiary)", textAlign: "right", flexShrink: 0 }}>{count}</span>
                    </button>
                );
            })}
        </div>
    );
}

// donut chart (work mode)
function DonutChart({ data, onClickSegment }) {
    const total = data.reduce((s, d) => s + d.count, 0);
    let offset  = 0;
    const r = 36, cx = 48, cy = 48, circ = 2 * Math.PI * r;
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <svg width={96} height={96} role="img" aria-label="Work mode donut chart" style={{ flexShrink: 0 }}>
                <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border-subtle)" strokeWidth={10} />
                {data.map(({ label, count }, i) => {
                    const pct  = count / total;
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
                            style={{ cursor: onClickSegment ? "pointer" : "default" }}
                            onClick={() => onClickSegment?.(label)}
                        />
                    );
                    offset += dash;
                    return seg;
                })}
                <text x={cx} y={cy + 5} textAnchor="middle" style={{ fontSize: 14, fontWeight: 700, fill: "var(--text-primary)" }}>{total}</text>
            </svg>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {data.map(({ label, count }, i) => (
                    <button
                        key={label}
                        onClick={() => onClickSegment?.(label)}
                        disabled={!onClickSegment}
                        style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", padding: "2px 4px", borderRadius: 4, cursor: onClickSegment ? "pointer" : "default", textAlign: "left" }}
                        title={onClickSegment ? `Filter to ${label}` : undefined}
                    >
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: CHART_COLORS[i % CHART_COLORS.length], flexShrink: 0 }} aria-hidden="true" />
                        <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{label}</span>
                        <span style={{ fontSize: 11, color: "var(--text-tertiary)", marginLeft: 4 }}>{count}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}

// salary range bars (min-max range bar & company/role label)
function SalaryChart({ data }) {
    const absMax = Math.max(...data.map(d => d.max), 1);
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {data.slice(0, 8).map((d, i) => {
                const leftPct  = Math.round((d.min / absMax) * 100);
                const widthPct = Math.max(Math.round(((d.max - d.min) / absMax) * 100), 2);
                return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ width: 110, fontSize: 11, color: "var(--text-secondary)", flexShrink: 0 }} className="truncate" title={d.label}>{d.label}</span>
                        <div style={{ flex: 1, height: 6, background: "var(--bg-subtle)", borderRadius: 3, position: "relative" }} aria-label={`${d.label}: $${d.min}k-$${d.max}k`}>
                            <div style={{
                                position: "absolute",
                                left: `${leftPct}%`,
                                width: `${widthPct}%`,
                                height: "100%",
                                background: CHART_COLORS[2],
                                borderRadius: 3,
                                opacity: 0.8,
                            }} />
                        </div>
                        <span style={{ width: 64, fontSize: 10, color: "var(--text-tertiary)", textAlign: "right", flexShrink: 0, whiteSpace: "nowrap" }}>
                            {d.min === d.max ? `$${d.mid}k` : `$${d.min}k-$${d.max}k`}
                        </span>
                    </div>
                );
            })}
            {data.length > 8 && (
                <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--text-tertiary)" }}>+{data.length - 8} more</p>
            )}
        </div>
    );
}

// days until response histogram
function BucketBars({ data }) {
    const max = Math.max(...data.map(d => d.count), 1);
    return (
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 72, paddingBottom: 20, position: "relative" }}>
            {data.map((d, i) => {
                const pct = Math.round((d.count / max) * 100);
                return (
                    <div key={d.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%" }}>
                        <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end" }}>
                            <div
                                style={{ width: "100%", height: `${pct}%`, minHeight: d.count > 0 ? 4 : 0, background: CHART_COLORS[i % CHART_COLORS.length], borderRadius: "3px 3px 0 0", transition: "height 0.4s ease", opacity: 0.8 }}
                                role="img"
                                aria-label={`${d.label}: ${d.count} jobs`}
                                title={`${d.label}: ${d.count} job${d.count !== 1 ? "s" : ""}`}
                            />
                        </div>
                        <span style={{ fontSize: 9, color: "var(--text-tertiary)", textAlign: "center", lineHeight: 1.2, position: "absolute", bottom: 0 }}>{d.label}</span>
                    </div>
                );
            })}
        </div>
    );
}

// rejection rate by industry
function RejectionChart({ data, onClickRow }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.map(({ label, rate, total }) => {
                const pct       = Math.round(rate * 100);
                const clickable = onClickRow;
                // colour shifts red as rejection rate increases
                const hue   = Math.round(10 + (1 - rate) * 30); // 10 (reddish) -> 40 (amber)
                const color = `hsl(${hue}, 55%, 55%)`;
                return (
                    <button
                        key={label}
                        onClick={() => onClickRow?.(label)}
                        disabled={!clickable}
                        style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", padding: "2px 0", cursor: clickable ? "pointer" : "default", borderRadius: 4, width: "100%", textAlign: "left" }}
                        title={clickable ? `Filter to ${label} (${pct}% rejected, ${total} jobs)` : undefined}
                    >
                        <span style={{ width: 90, fontSize: 11, color: "var(--text-secondary)", flexShrink: 0 }} className="truncate">{label}</span>
                        <div style={{ flex: 1, height: 6, background: "var(--bg-subtle)", borderRadius: 3, overflow: "hidden" }}>
                            <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.4s ease" }} aria-label={`${label}: ${pct}% rejection rate`} />
                        </div>
                        <span style={{ width: 32, fontSize: 11, color: "var(--text-tertiary)", textAlign: "right", flexShrink: 0 }}>{pct}%</span>
                    </button>
                );
            })}
        </div>
    );
}

// activity timeline: 4-week moving average
function TimelineChart({ data, trend }) {
    const max = Math.max(...data.map(d => d.count), 1);
    const H   = 80;
    const pts = data.map((d, i) => {
        const x = (i / (data.length - 1)) * 100;
        const y = H - Math.round((d.count / max) * (H - 10));
        return { x, y, ...d };
    });
    // trend line points (4-week moving average, same coordinate space)
    const trendPts = trend.map((val, i) => {
        const x = (i / (data.length - 1)) * 100;
        const y = H - Math.round((val / max) * (H - 10));
        return `${x} ${y}`;
    }).join(" ");

    return (
        <div>
            <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: H, display: "block", overflow: "visible" }} role="img" aria-label="Jobs added over time">
                {/* trendine (4-week moving average) */}
                {trend.some(v => v > 0) && (
                    <polyline
                        points={trendPts}
                        fill="none"
                        stroke="var(--accent)"
                        strokeWidth="1"
                        strokeDasharray="2 2"
                        opacity="0.4"
                        vectorEffect="non-scaling-stroke"
                    />
                )}
                {/* actual line */}
                <polyline
                    points={pts.map(p => `${p.x} ${p.y}`).join(" ")}
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.7"
                    vectorEffect="non-scaling-stroke"
                />
                {/* dots */}
                {pts.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r="2" fill="var(--accent)" opacity="0.85" vectorEffect="non-scaling-stroke">
                        <title>{`${p.label}: ${p.count} job${p.count !== 1 ? "s" : ""}`}</title>
                    </circle>
                ))}
            </svg>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                {data.filter((_, i) => i === 0 || i === data.length - 1 || i === Math.floor(data.length / 2)).map(d => (
                    <span key={d.label} style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{d.label}</span>
                ))}
            </div>
            <p style={{ margin: "4px 0 0", fontSize: 10, color: "var(--text-tertiary)" }}>
                Dashed line = 4-week moving average
            </p>
        </div>
    );
}

const tdStyle = { padding: "7px 8px", fontSize: 12, color: "var(--text-secondary)", borderBottom: "1px solid var(--border-subtle)" };


// =========== DATA COMPUTATION ================================================================
function compute(jobs, columns) {
    const now    = Date.now();
    const total  = jobs.length;
    const applied    = jobs.filter(j => j.column !== "watchlist").length;
    const interviews = jobs.filter(j => j.column === "interviewing").length;
    const offers     = jobs.filter(j => j.column === "offer").length;
    const rejected   = jobs.filter(j => j.column === "rejected").length;
    const responseRate = applied > 0
        ? Math.round((jobs.filter(j => ["interviewing", "offer"].includes(j.column)).length / applied) * 100)
        : 0;

    // active this week
    const weekAgo = now - 7 * 86400000;
    const activeThisWeek = jobs.filter(j => j.createdAt >= weekAgo).length;

    // average num days to first interview (ref: createdAt)
    // TODO: more accurate version would be to store a status-change timestamp
    const interviewedJobs = jobs.filter(j => ["interviewing", "offer"].includes(j.column) && j.createdAt);
    const avgDaysToResponse = interviewedJobs.length > 0
        ? Math.round(interviewedJobs.reduce((sum, j) => sum + (now - j.createdAt) / 86400000, 0) / interviewedJobs.length)
        : null;

    // INTERVIEW STAGES
    const stageCounts = Object.entries(
        jobs.filter(j => j.column === "interviewing" && j.interviewStage)
            .reduce((acc, j) => ({ ...acc, [j.interviewStage]: (acc[j.interviewStage] ?? 0) + 1 }), {})
    ).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);

    // INDUSTRIES
    const industries = Object.entries(
        jobs.filter(j => j.industry)
            .reduce((acc, j) => ({ ...acc, [j.industry]: (acc[j.industry] ?? 0) + 1 }), {})
    ).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, 8);

    // WORK MODES
    const workModes = Object.entries(
        jobs.filter(j => j.workMode)
            .reduce((acc, j) => ({ ...acc, [j.workMode]: (acc[j.workMode] ?? 0) + 1 }), {})
    ).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);

    // TAGS
    const tagMap = {};
    jobs.forEach(j => (j.tags ?? []).forEach(t => { tagMap[t] = (tagMap[t] ?? 0) + 1; }));
    const tags = Object.entries(tagMap).map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count);

    // 8-week TIMELINE + 4-week moving average
    const MS_WEEK = 7 * 86400000;
    const timeline = Array.from({ length: 8 }, (_, i) => {
        const weekStart = now - (7 - i) * MS_WEEK;
        const weekEnd   = weekStart + MS_WEEK;
        const count = jobs.filter(j => j.createdAt >= weekStart && j.createdAt < weekEnd).length;
        const label = new Date(weekStart).toLocaleDateString("en-US", { month: "short", day: "numeric" });
        return { label, count };
    });
    // 4-week moving average (window of 4, computed for each week)
    const timelineTrend = timeline.map((_, i) => {
        const window = timeline.slice(Math.max(0, i - 3), i + 1);
        return Math.round((window.reduce((s, w) => s + w.count, 0) / window.length) * 10) / 10;
    });

    // SALARY RANGES COMPARISON
    const salaryRanges = jobs
        .map(j => {
            const parsed = parseSalary(j.salary);
            if (!parsed) return null;
            return { label: j.company ? `${j.company}` : j.role, ...parsed };
        })
        .filter(Boolean)
        .sort((a, b) => a.mid - b.mid);

    // HOW LONG BEFORE HEARING BACK HISTOGRAM
    const bucketLabels = ["0-7d", "8-14d", "15-30d", "30+d"];
    const bucketEdges  = [7, 14, 30, Infinity];
    const daysToResponseBuckets = bucketLabels.map((label, i) => ({
        label,
        count: interviewedJobs.filter(j => {
            const days = (now - j.createdAt) / 86400000;
            const lo   = i === 0 ? 0 : bucketEdges[i - 1];
            const hi   = bucketEdges[i];
            return days > lo && days <= hi;
        }).length,
    }));

    // REJECTION RATE BY INDUSTRY
    const rejectionByIndustry = Object.entries(
        jobs.filter(j => j.industry).reduce((acc, j) => {
            if (!acc[j.industry]) acc[j.industry] = { total: 0, rejected: 0 };
            acc[j.industry].total++;
            if (j.column === "rejected") acc[j.industry].rejected++;
            return acc;
        }, {})
    )
        .filter(([, v]) => v.total >= 2)
        .map(([label, v]) => ({ label, rate: v.rejected / v.total, total: v.total }))
        .sort((a, b) => b.rate - a.rate)
        .slice(0, 8);

    // REQUIREMENTS FREQUENCY
    const reqMap = {};
    jobs.forEach(j => (j.requirements ?? []).forEach(r => { reqMap[r] = (reqMap[r] ?? 0) + 1; }));
    const requirementFreq = Object.entries(reqMap)
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

    // RECENT
    const recent = [...jobs].sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);

    return {
        total, applied, interviews, offers, rejected, responseRate,
        activeThisWeek, avgDaysToResponse,
        stageCounts, industries, workModes, tags,
        timeline, timelineTrend,
        salaryRanges, daysToResponseBuckets,
        rejectionByIndustry, requirementFreq,
        recent,
    };
}