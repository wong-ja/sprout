import { useState, useRef, useEffect, useCallback } from "react";
import {
    WORK_MODES, JOB_TYPES, INDUSTRIES, INTERVIEW_STAGES, APPLICATION_REQUIREMENTS,
    DEFAULT_FILTERS, DATE_RANGES, SORT_OPTIONS, GROUP_OPTIONS,
    activeFilterCount,
} from "../store.js";

// ============ FILTER BAR =================================================================
export default function FilterBar({ filters, onChange, columns, allJobs }) {
    const activeCount = activeFilterCount(filters);
    const hasFilters = activeCount > 0;

    const reset = () => onChange(DEFAULT_FILTERS);
    const set = useCallback((key, val) => onChange(f => ({ ...f, [key]: val })), [onChange]);
    const toggleArr = useCallback((key, val) => onChange(f => {
        const arr = f[key] ?? [];
        return { ...f, [key]: arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val] };
    }), [onChange]);

    // collect all unique tags from jobs
    const allTags = [...new Set(allJobs.flatMap(j => j.tags ?? []))].sort();

    return (
        <div
            role="search"
            aria-label="Filter and sort jobs"
            style={{
                background: "var(--bg-surface)",
                borderBottom: "1px solid var(--border-default)",
                padding: "8px 20px",
                display: "flex",
                alignItems: "center",
                gap: 6,
                flexWrap: "wrap",
                position: "sticky",
                top: 54,
                zIndex: 40,
            }}
        >
            {/* FILTER CHIPS */}
            <FilterDropdown
                label="Status"
                count={filters.columns?.length}
                options={columns.map(c => ({ id: c.id, label: c.label, dot: c.color }))}
                selected={filters.columns ?? []}
                onToggle={val => toggleArr("columns", val)}
                onClear={() => set("columns", [])}
                dot
            />
            <FilterDropdown
                label="Work mode"
                count={filters.workModes?.length}
                options={WORK_MODES.map(m => ({ id: m, label: m }))}
                selected={filters.workModes ?? []}
                onToggle={val => toggleArr("workModes", val)}
                onClear={() => set("workModes", [])}
            />
            <FilterDropdown
                label="Job type"
                count={filters.jobTypes?.length}
                options={JOB_TYPES.map(t => ({ id: t, label: t }))}
                selected={filters.jobTypes ?? []}
                onToggle={val => toggleArr("jobTypes", val)}
                onClear={() => set("jobTypes", [])}
            />
            <FilterDropdown
                label="Industry"
                count={filters.industries?.length}
                options={INDUSTRIES.map(i => ({ id: i, label: i }))}
                selected={filters.industries ?? []}
                onToggle={val => toggleArr("industries", val)}
                onClear={() => set("industries", [])}
            />
            <FilterDropdown
                label="Interview stage"
                count={filters.stages?.length}
                options={INTERVIEW_STAGES.map(s => ({ id: s, label: s }))}
                selected={filters.stages ?? []}
                onToggle={val => toggleArr("stages", val)}
                onClear={() => set("stages", [])}
            />
            <FilterDropdown
                label="Requirements"
                count={filters.requirements?.length}
                options={APPLICATION_REQUIREMENTS.map(r => ({ id: r, label: r }))}
                selected={filters.requirements ?? []}
                onToggle={val => toggleArr("requirements", val)}
                onClear={() => set("requirements", [])}
            />
            {allTags.length > 0 && (
                <FilterDropdown
                    label="Tags"
                    count={filters.tags?.length}
                    options={allTags.map(t => ({ id: t, label: t }))}
                    selected={filters.tags ?? []}
                    onToggle={val => toggleArr("tags", val)}
                    onClear={() => set("tags", [])}
                />
            )}
            <DateFilter filters={filters} set={set} />

            <div style={{ width: 1, height: 20, background: "var(--border-default)", margin: "0 2px", flexShrink: 0 }} aria-hidden="true" />

            {/* SORTING */}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 600, whiteSpace: "nowrap" }}>Sort</span>
                <select
                    value={filters.sortBy}
                    onChange={e => set("sortBy", e.target.value)}
                    aria-label="Sort by"
                    style={selectStyle}
                >
                    {SORT_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
                <button
                    onClick={() => set("sortDir", filters.sortDir === "asc" ? "desc" : "asc")}
                    aria-label={`Sort direction: ${filters.sortDir === "asc" ? "ascending" : "descending"}`}
                    title={filters.sortDir === "asc" ? "Ascending" : "Descending"}
                    style={{
                        ...chipBase,
                        padding: "4px 7px",
                        fontWeight: 700,
                        fontSize: 12,
                        background: "var(--bg-subtle)",
                        border: "1px solid var(--border-default)",
                        color: "var(--text-secondary)",
                    }}
                >
                    {filters.sortDir === "asc" ? "↑" : "↓"}
                </button>
            </div>

            {/* GROUP BY */}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 600, whiteSpace: "nowrap" }}>Group</span>
                <select
                    value={filters.groupBy}
                    onChange={e => set("groupBy", e.target.value)}
                    aria-label="Group by"
                    style={selectStyle}
                >
                    {GROUP_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
            </div>

            <div style={{ flex: 1 }} />

            {/* results & reset */}
            {hasFilters && (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{
                        fontSize: 11, color: "var(--accent-text)", fontWeight: 600,
                        background: "var(--accent-light)", borderRadius: 99,
                        padding: "2px 8px", border: "1px solid var(--border-default)",
                    }}>
                        {activeCount} filter{activeCount !== 1 ? "s" : ""} active
                    </span>
                    <button
                        onClick={reset}
                        aria-label="Reset all filters"
                        style={{
                            ...chipBase,
                            fontSize: 11, fontWeight: 600,
                            color: "var(--danger)",
                            background: "var(--danger-bg)",
                            border: "1px solid var(--danger)",
                            padding: "4px 10px",
                        }}
                    >
                        Reset
                    </button>
                </div>
            )}
        </div>
    );
}

// =============== DROPDOWN FILTERS ============================================================
function FilterDropdown({ label, count, options, selected, onToggle, onClear, dot }) {
    const [open, setOpen] = useState(false);
    const ref = useRef();

    useEffect(() => {
        if (!open) return;
        const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    const isActive = count > 0;

    return (
        <div ref={ref} style={{ position: "relative" }}>
            <button
                onClick={() => setOpen(v => !v)}
                aria-expanded={open}
                aria-haspopup="listbox"
                aria-label={`Filter by ${label}${isActive ? `, ${count} selected` : ""}`}
                style={{
                    ...chipBase,
                    background: isActive ? "var(--accent-light)" : "var(--bg-subtle)",
                    border: `1px solid ${isActive ? "var(--accent)" : "var(--border-default)"}`,
                    color: isActive ? "var(--accent-text)" : "var(--text-secondary)",
                    fontWeight: isActive ? 700 : 400,
                    gap: 5,
                }}
            >
                {label}
                {isActive && (
                    <span style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        width: 16, height: 16, borderRadius: 99,
                        background: "var(--accent)", color: "#fff",
                        fontSize: 9, fontWeight: 800, lineHeight: 1,
                    }} aria-hidden="true">{count}</span>
                )}
                <span aria-hidden="true" style={{ fontSize: 9, opacity: 0.5, marginLeft: 1 }}>▾</span>
            </button>

            {open && (
                <div
                    role="listbox"
                    aria-multiselectable="true"
                    aria-label={`${label} options`}
                    style={{
                        position: "absolute",
                        top: "calc(100% + 6px)",
                        left: 0,
                        zIndex: 200,
                        background: "var(--bg-raised)",
                        border: "1px solid var(--border-default)",
                        borderRadius: 12,
                        boxShadow: "var(--shadow-lg)",
                        minWidth: 190,
                        maxWidth: 240,
                        maxHeight: 280,
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                    }}
                >
                    {/* header */}
                    <div style={{
                        padding: "8px 12px 6px",
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        borderBottom: "1px solid var(--border-subtle)",
                        flexShrink: 0,
                    }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            {label}
                        </span>
                        {selected.length > 0 && (
                            <button
                                onClick={() => { onClear(); }}
                                style={{ fontSize: 11, color: "var(--danger)", background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 600 }}
                                aria-label={`Clear ${label} filter`}
                            >
                                Clear
                            </button>
                        )}
                    </div>

                    {/* options */}
                    <div style={{ overflowY: "auto", padding: "4px 0" }}>
                        {options.map(opt => {
                            const checked = selected.includes(opt.id);
                            return (
                                <button
                                    key={opt.id}
                                    role="option"
                                    aria-selected={checked}
                                    onClick={() => onToggle(opt.id)}
                                    style={{
                                        width: "100%", textAlign: "left",
                                        padding: "7px 12px",
                                        background: checked ? "var(--accent-light)" : "transparent",
                                        border: "none",
                                        color: checked ? "var(--accent-text)" : "var(--text-primary)",
                                        fontSize: 13,
                                        cursor: "pointer",
                                        display: "flex", alignItems: "center", gap: 8,
                                        transition: "background 0.1s",
                                    }}
                                    onMouseEnter={e => { if (!checked) e.currentTarget.style.background = "var(--bg-hover)"; }}
                                    onMouseLeave={e => { if (!checked) e.currentTarget.style.background = "transparent"; }}
                                >
                                    {/* checkbox */}
                                    <span
                                        aria-hidden="true"
                                        style={{
                                            width: 14, height: 14, borderRadius: 4, flexShrink: 0,
                                            border: `1.5px solid ${checked ? "var(--accent)" : "var(--border-strong)"}`,
                                            background: checked ? "var(--accent)" : "transparent",
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                        }}
                                    >
                                        {checked && <span style={{ color: "#fff", fontSize: 9, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                                    </span>
                                    {/* status dot */}
                                    {dot && opt.dot && (
                                        <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: "50%", background: opt.dot, flexShrink: 0 }} />
                                    )}
                                    <span className="truncate" style={{ flex: 1 }}>{opt.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

// ========== DATE, CUSTOM/RANGE - FILTER ============================================================
function DateFilter({ filters, set }) {
    const [open, setOpen] = useState(false);
    const ref = useRef();
    const isActive = filters.dateRange !== "all";

    useEffect(() => {
        if (!open) return;
        const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    const currentLabel = DATE_RANGES.find(d => d.id === filters.dateRange)?.label ?? "Any time";


    return (
        <div ref={ref} style={{ position: "relative" }}>
            <button
                onClick={() => setOpen(v => !v)}
                aria-expanded={open}
                aria-haspopup="dialog"
                aria-label={`Filter by date: ${currentLabel}`}
                style={{
                    ...chipBase,
                    background: isActive ? "var(--accent-light)" : "var(--bg-subtle)",
                    border: `1px solid ${isActive ? "var(--accent)" : "var(--border-default)"}`,
                    color: isActive ? "var(--accent-text)" : "var(--text-secondary)",
                    fontWeight: isActive ? 700 : 400,
                }}
            >
                {isActive ? currentLabel : "Date added"}
                <span aria-hidden="true" style={{ fontSize: 9, opacity: 0.5, marginLeft: 1 }}>▾</span>
            </button>

            {open && (
                <div
                    role="dialog"
                    aria-label="Date filter"
                    style={{
                        position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 200,
                        background: "var(--bg-raised)",
                        border: "1px solid var(--border-default)",
                        borderRadius: 12, boxShadow: "var(--shadow-lg)",
                        minWidth: 200, padding: "8px 0",
                    }}
                >
                    {DATE_RANGES.map(dr => (
                        <button
                            key={dr.id}
                            onClick={() => { set("dateRange", dr.id); if (dr.id !== "custom") setOpen(false); }}
                            style={{
                                width: "100%", textAlign: "left",
                                padding: "7px 14px", border: "none",
                                background: filters.dateRange === dr.id ? "var(--accent-light)" : "transparent",
                                color: filters.dateRange === dr.id ? "var(--accent-text)" : "var(--text-primary)",
                                fontSize: 13, cursor: "pointer",
                                fontWeight: filters.dateRange === dr.id ? 700 : 400,
                                display: "flex", alignItems: "center", gap: 8,
                                transition: "background 0.1s",
                            }}
                            onMouseEnter={e => { if (filters.dateRange !== dr.id) e.currentTarget.style.background = "var(--bg-hover)"; }}
                            onMouseLeave={e => { if (filters.dateRange !== dr.id) e.currentTarget.style.background = "transparent"; }}
                        >
                            {filters.dateRange === dr.id && <span aria-hidden="true" style={{ color: "var(--accent)", fontSize: 10 }}>✓</span>}
                            {dr.label}
                        </button>
                    ))}

                    {filters.dateRange === "custom" && (
                        <div style={{ padding: "8px 14px 4px", display: "flex", flexDirection: "column", gap: 6, borderTop: "1px solid var(--border-subtle)", marginTop: 4 }}>
                            <label style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 600 }}>
                                From
                                <input type="date" value={filters.dateFrom} onChange={e => set("dateFrom", e.target.value)}
                                    style={{ display: "block", marginTop: 3, fontSize: 12, padding: "5px 8px", borderRadius: 7, border: "1px solid var(--border-default)", background: "var(--bg-subtle)", color: "var(--text-primary)", width: "100%" }} />
                            </label>
                            <label style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 600 }}>
                                To
                                <input type="date" value={filters.dateTo} onChange={e => set("dateTo", e.target.value)}
                                    style={{ display: "block", marginTop: 3, fontSize: 12, padding: "5px 8px", borderRadius: 7, border: "1px solid var(--border-default)", background: "var(--bg-subtle)", color: "var(--text-primary)", width: "100%" }} />
                            </label>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ========= CHIP, SELECT STYLES =================================
const chipBase = {
    display: "inline-flex", alignItems: "center", gap: 4,
    padding: "5px 10px", borderRadius: 99,
    fontSize: 12, cursor: "pointer",
    transition: "all 0.12s",
    whiteSpace: "nowrap", lineHeight: 1.4,
    fontFamily: "inherit",
};

const selectStyle = {
    fontSize: 12, padding: "5px 9px",
    borderRadius: 8,
    border: "1.5px solid var(--border-strong)",
    background: "var(--bg-raised)",
    color: "var(--text-primary)",
    cursor: "pointer", outline: "none",
    fontFamily: "inherit", fontWeight: 500,
};