import { useState } from "react";
import { fmtDateShort, columnById } from "../store.js";
import { groupJobs } from "./FilterBar.jsx";

const COLS = [
    { key: "company",    label: "Company",    width: 140 },
    { key: "role",       label: "Role",       width: 160 },
    { key: "location",   label: "Location",   width: 120 },
    { key: "workMode",   label: "Mode",       width: 90  },
    { key: "industry",   label: "Industry",   width: 130 },
    { key: "salary",     label: "Salary",     width: 130 },
    { key: "column",     label: "Status",     width: 130 },
    { key: "interviewStage", label: "Stage",  width: 130 },
    { key: "createdAt",  label: "Added",      width: 100 },
];

export default function Table({ jobs, columns, groupBy, onOpenJob, onAddJob, onMoveJob }) {
    const [sortKey, setSortKey] = useState("createdAt");
    const [sortDir, setSortDir] = useState("desc");
    const [hovered, setHovered] = useState(null);

    // Note: applyFilters already sorted; Table has its own secondary sort via column headers
    const handleSort = (key) => {
        if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
        else { setSortKey(key); setSortDir("asc"); }
    };

    const sorted = [...jobs].sort((a, b) => {
        const av = a[sortKey] ?? "";
        const bv = b[sortKey] ?? "";
        const cmp = typeof av === "number"
            ? av - bv
            : String(av).localeCompare(String(bv), undefined, { sensitivity: "base" });
        return sortDir === "asc" ? cmp : -cmp;
    });

    const groups = groupJobs(sorted, groupBy, columns);
    const isGrouped = groupBy && groupBy !== "none" && groups.length > 1;

    const thStyle = (key) => ({
        padding: "8px 12px",
        textAlign: "left",
        fontSize: 11,
        fontWeight: 600,
        color: sortKey === key ? "var(--accent)" : "var(--text-tertiary)",
        background: "var(--bg-subtle)",
        cursor: "pointer",
        userSelect: "none",
        whiteSpace: "nowrap",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        borderBottom: "1px solid var(--border-default)",
        position: "sticky",
        top: 0,
    });

    const tdStyle = {
        padding: "9px 12px",
        fontSize: 13,
        color: "var(--text-secondary)",
        borderBottom: "1px solid var(--border-subtle)",
        whiteSpace: "nowrap",
        maxWidth: 200,
        overflow: "hidden",
        textOverflow: "ellipsis",
        verticalAlign: "middle",
    };

  return (
    <div style={{ flex: 1, overflow: "auto", padding: "16px 20px" }}>
        <div
            style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-default)",
                borderRadius: 12,
                overflow: "hidden",
            }}
        >
            {/* TOOLBAR */}
            <div
                style={{
                    padding: "10px 16px",
                    borderBottom: "1px solid var(--border-default)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "var(--bg-surface)",
                }}
            >
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                    {jobs.length} {jobs.length === 1 ? "job" : "jobs"}
                </span>
                <button
                    onClick={onAddJob}
                    style={{
                        fontSize: 12, padding: "5px 12px", borderRadius: 7,
                        border: "1px solid var(--border-default)",
                        background: "transparent", color: "var(--text-secondary)", cursor: "pointer",
                    }}
                    aria-label="Add new job"
                >
                    + Add job
                </button>
            </div>

        {/* TABLE */}
        <div style={{ overflowX: "auto" }}>
          <table
            role="grid"
            aria-label="Jobs table"
            style={{ width: "100%", borderCollapse: "collapse", tableLayout: "auto" }}
          >
            <thead>
              <tr>
                {COLS.map((c) => (
                  <th
                    key={c.key}
                    scope="col"
                    style={{ ...thStyle(c.key), minWidth: c.width }}
                    onClick={() => handleSort(c.key)}
                    aria-sort={sortKey === c.key ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                  >
                    {c.label}
                    {sortKey === c.key && (
                      <span aria-hidden="true" style={{ marginLeft: 4, opacity: 0.6 }}>
                        {sortDir === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={COLS.length} style={{ ...tdStyle, textAlign: "center", padding: "32px", color: "var(--text-tertiary)" }}>
                    No jobs match the current filters. <button onClick={onAddJob} style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontSize: 13 }}>Add one →</button>
                  </td>
                </tr>
              ) : groups.map(group => (
                <>
                  {isGrouped && (
                    <tr key={`group-${group.key}`} aria-label={`Group: ${group.label}`}>
                      <td colSpan={COLS.length} style={{
                        padding: "10px 12px 6px",
                        fontSize: 11, fontWeight: 700,
                        color: "var(--text-tertiary)",
                        textTransform: "uppercase", letterSpacing: "0.06em",
                        background: "var(--bg-subtle)",
                        borderBottom: "1px solid var(--border-subtle)",
                        borderTop: "1px solid var(--border-default)",
                      }}>
                        {group.label}
                        <span style={{ marginLeft: 8, fontWeight: 400, opacity: 0.6 }}>({group.jobs.length})</span>
                      </td>
                    </tr>
                  )}
                  {group.jobs.map((job) => {
                    const col = columnById(columns, job.column);
                    return (
                      <tr
                        key={job.id}
                        role="row"
                        tabIndex={0}
                        onClick={() => onOpenJob(job)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenJob(job); } }}
                        onMouseEnter={() => setHovered(job.id)}
                        onMouseLeave={() => setHovered(null)}
                        aria-label={`${job.company}, ${job.role}. Press Enter to open.`}
                        style={{
                          cursor: "pointer",
                          background: hovered === job.id ? "var(--bg-hover)" : "transparent",
                          outline: "none",
                          transition: "background 0.1s",
                        }}
                      >
                        <td style={{ ...tdStyle, color: "var(--text-primary)", fontWeight: 600 }}>{job.company}</td>
                        <td style={tdStyle}>{job.role}</td>
                        <td style={tdStyle}>{job.location || "—"}</td>
                        <td style={tdStyle}>{job.workMode ? <WorkModeBadge mode={job.workMode} /> : "—"}</td>
                        <td style={tdStyle}>{job.industry || "—"}</td>
                        <td style={tdStyle}>{job.salary || "—"}</td>
                        <td style={tdStyle}><StatusBadge col={col} /></td>
                        <td style={tdStyle}>{job.column === "interviewing" && job.interviewStage ? <StagePill stage={job.interviewStage} /> : "—"}</td>
                        <td style={{ ...tdStyle, color: "var(--text-tertiary)", fontSize: 12 }}>{fmtDateShort(job.createdAt)}</td>
                      </tr>
                    );
                  })}
                </>
              ))}
            </tbody>
          </table>

        </div>
      </div>
    </div>
  );
}


// ===============================================================================================
function StatusBadge({ col }) {
    if (!col) return null;
    return (
        <span
            style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                fontSize: 11, fontWeight: 600, padding: "3px 9px",
                borderRadius: 99, background: col.bg, color: col.textColor,
            }}
        >
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: col.color, display: "inline-block" }} aria-hidden="true" />
            {col.label}
        </span>
    );
}

function StagePill({ stage }) {
    const MUTED = { bg: "#f3f4f6", color: "#374151", dot: "#9ca3af" };
    const COLORS = {
        "Technical Screen": { bg: "#eff6ff", color: "#1d4ed8", dot: "#3b82f6" },
        "Final Round": { bg: "#fff7ed", color: "#c2410c", dot: "#f97316" },
        "Panel": { bg: "#f0fdf4", color: "#15803d", dot: "#22c55e" },
        "Take-Home": { bg: "#fdf4ff", color: "#7e22ce", dot: "#a855f7" },
    };
    const s = COLORS[stage] ?? MUTED;
    return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 99, background: s.bg, color: s.color }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: s.dot, display: "inline-block" }} aria-hidden="true" />
            {stage}
        </span>
    );
}

function WorkModeBadge({ mode }) {
    const c = { Remote: "#059669", Hybrid: "#d97706", "On-site": "#6366f1", Flexible: "#0ea5e9" };
    return (
        <span style={{ fontSize: 11, fontWeight: 500, color: c[mode] ?? "var(--text-secondary)" }}>
            {mode}
        </span>
    );
}