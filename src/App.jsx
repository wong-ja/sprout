import { useState, useEffect, useCallback, useRef } from "react";
import {
    loadState, saveState, exportData, importData,
    isBannerDismissed, dismissBanner, genId, columnById, PALETTES,
} from "./store.js";
import FilterBar, { DEFAULT_FILTERS, applyFilters, activeFilterCount } from "./components/FilterBar.jsx";
import Board from "./components/Board.jsx";
import Table from "./components/Table.jsx";
import JobModal from "./components/JobModal.jsx";
import Stats from "./components/Stats.jsx";
import Settings from "./components/Settings.jsx";

const NAV = [
    { id: "board", label: "Board" },
    { id: "table", label: "Table" },
    { id: "stats", label: "Stats" },
];

export default function App() {
    const [state, setState]               = useState(() => loadState());
    const [view, setView]                 = useState("board");
    const [filters, setFilters]           = useState(DEFAULT_FILTERS);
    const [modal, setModal]               = useState(null);
    const [showSettings, setShowSettings] = useState(false);
    const [showAddCol, setShowAddCol]     = useState(false);
    const [newColLabel, setNewColLabel]   = useState("");
    const [bannerDismissed, setBannerDismissed] = useState(isBannerDismissed);
    const [search, setSearch]             = useState("");
    const [importError, setImportError]   = useState("");
    const fileRef    = useRef();
    const addColRef  = useRef();

    const { jobs, columns, palette, theme } = state;

    // persist on every state change
    useEffect(() => { saveState(state); }, [state]);

    //palette + theme applied to <html>
    useEffect(() => {
        document.documentElement.setAttribute("data-palette", palette);
        document.documentElement.setAttribute("data-theme", theme);
    }, [palette, theme]);

    // keyboard accessibility, esc key on modals
    useEffect(() => {
        const handler = e => {
            if (e.key === "Escape") { setModal(null); setShowSettings(false); setShowAddCol(false); }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, []);

    useEffect(() => {
        if (!showAddCol) return;
        const handler = e => { if (addColRef.current && !addColRef.current.contains(e.target)) setShowAddCol(false); };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [showAddCol]);

    const patch = updates => setState(s => ({ ...s, ...updates }));

    const addJob = useCallback(data => {
        patch({ jobs: [{ ...data, id: genId(), createdAt: Date.now() }, ...jobs] });
        setModal(null);
    }, [jobs]);
    const updateJob = useCallback(data => {
        patch({ jobs: jobs.map(j => j.id === data.id ? { ...j, ...data } : j) });
        setModal(null);
    }, [jobs]);
    const deleteJob = useCallback(id => {
        patch({ jobs: jobs.filter(j => j.id !== id) });
        setModal(null);
    }, [jobs]);
    const moveJob = useCallback((id, colId) => {
        patch({ jobs: jobs.map(j => j.id === id ? { ...j, column: colId } : j) });
    }, [jobs]);
    const reorderJobs = useCallback(newJobs => { patch({ jobs: newJobs }); }, []);

    const addColumn = label => {
        const id = `col_${Date.now()}`;
        patch({
            columns: [...columns, {
                id, label,
                color: "#8b5cf6",
                bg: "var(--col-custom-bg)",
                textColor: "var(--col-custom-text)",
                locked: false,
            }],
        });
    };
    const renameColumn   = (id, label) => patch({ columns: columns.map(c => c.id === id ? { ...c, label } : c) });
    // delted column - jobs move back to 'watchlist'
    const deleteColumn   = id => patch({ columns: columns.filter(c => c.id !== id), jobs: jobs.map(j => j.column === id ? { ...j, column: "watchlist" } : j) });
    const reorderColumns = newCols => patch({ columns: newCols });
    const updateColumnColor = (id, color) => patch({ columns: columns.map(c => c.id === id ? { ...c, color } : c) });

    const handleExport      = () => exportData(state);
    const handleImportClick = () => fileRef.current?.click();
    const handleImportFile  = async e => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImportError("");
        try {
            const data = await importData(file);
            setState(s => ({ ...s, jobs: data.jobs ?? s.jobs, columns: data.columns ?? s.columns, palette: data.palette ?? s.palette, theme: data.theme ?? s.theme }));
        } catch (err) { setImportError(err.message); }
        e.target.value = "";
    };

    // combine search + filters
    const filteredJobs = applyFilters(
        search.trim()
            ? jobs.filter(j => [j.company, j.role, j.location, j.industry, ...(j.tags ?? [])].join(" ").toLowerCase().includes(search.toLowerCase()))
            : jobs,
        filters
    );

    // QUICK STATS
    const totalTracked = jobs.length;
    const activeCount  = jobs.filter(j => !["rejected", "watchlist"].includes(j.column)).length;
    const filterCount  = activeFilterCount(filters);

    const submitAddCol = () => {
        const trimmed = newColLabel.trim();
        if (trimmed) { addColumn(trimmed); setNewColLabel(""); setShowAddCol(false); }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "var(--bg-page)" }}>
            {/* banner - notif on data privacy & local storage */}
            {!bannerDismissed && (
                <div role="status" aria-live="polite" style={{ background: "var(--bg-subtle)", borderBottom: "1px solid var(--border-default)", padding: "10px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, fontSize: 13, color: "var(--text-secondary)" }}>
                    <span>
                        <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>Your data stays on your device.</strong>
                        {" "}Sprout saves to your browser's local storage — nothing is sent to any server. Export a backup anytime to keep your data safe.
                    </span>
                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                        <button
                            onClick={handleExport}
                            style={btnStyle("outline")}
                            aria-label="Export data backup"
                        >
                            Export backup
                        </button>
                        <button
                            onClick={() => { setBannerDismissed(true); dismissBanner(); }}
                            aria-label="Dismiss notice"
                            style={{ ...btnStyle("ghost"), fontWeight: 500, fontSize: 18, padding: "2px 8px", lineHeight: 1 }}
                        >
                            ⓧ
                        </button>
                    </div>
                </div>
            )}

            {/* header */}
            <header
                style={{
                    background: "var(--bg-surface)",
                    borderBottom: "1px solid var(--border-default)",
                    padding: "0 20px",
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    height: 54,
                    position: "sticky",
                    top: 0,
                    zIndex: 50,
                }}
            >
                {/* logo */}
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginRight: 8 }}>
                    <div
                        aria-hidden="true"
                        style={{
                            width: 32, height: 32, borderRadius: 10,
                            background: "var(--accent-light)",
                            border: "1.5px solid var(--border-default)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0,
                        }}
                    >
                        <img src="/favicon2.png" alt="logo" width={15} />
                    </div>
                    <div>
                        <span className="sprout-wordmark" style={{ fontSize: 17 }}>Sprout</span>
                    </div>
                </div>

                {/* Nav */}
                <nav aria-label="Main navigation" style={{ display: "flex", gap: 2 }}>
                    {NAV.map((n) => (
                        <button
                            key={n.id}
                            onClick={() => setView(n.id)}
                            aria-current={view === n.id ? "page" : undefined}
                            style={{
                                padding: "5px 12px",
                                borderRadius: 7,
                                border: "none",
                                background: view === n.id ? "var(--accent-light)" : "transparent",
                                color: view === n.id ? "var(--accent-text)" : "var(--text-secondary)",
                                fontWeight: view === n.id ? 600 : 400,
                                fontSize: 13,
                                cursor: "pointer",
                                transition: "background 0.15s, color 0.15s",
                            }}
                        >
                            {n.label}
                        </button>
                    ))}
                </nav>

                <div style={{ flex: 1 }} />

                {/* STATS */}
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", width: "100%", gap: 6 }} aria-label="dashboard stats">
                    <StatPill label="Tracked" value={totalTracked} />
                    <StatPill label="Active" value={activeCount} accent />
                    {filterCount > 0 && <StatPill label="Filtered" value={filteredJobs.length} muted />}
                </div>

                {/* search */}
                <div style={{ position: "relative" }}>
                    <label htmlFor="global-search" className="sr-only">Search jobs</label>
                    <input
                        id="global-search"
                        type="search"
                        placeholder="Search…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{
                            width: 180,
                            padding: "6px 10px 6px 30px",
                            borderRadius: 8,
                            border: "1px solid var(--border-default)",
                            background: "var(--bg-subtle)",
                            color: "var(--text-primary)",
                            fontSize: 13,
                            outline: "none",
                        }}
                        aria-label="Search jobs by company, role, location, or tag"
                    />
                    <svg
                        aria-hidden="true"
                        width="13" height="13" viewBox="0 0 14 14" fill="none"
                        style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", opacity: 0.4 }}
                    >
                        <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.5" />
                        <line x1="9.2" y1="9.2" x2="12.5" y2="12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                </div>

                {/* Import/Export */}
                <button onClick={handleImportClick} style={btnStyle("ghost")} aria-label="Import backup file">Import</button>
                <button onClick={handleExport} style={btnStyle("ghost")} aria-label="Export backup">Export</button>
                <input
                    ref={fileRef}
                    type="file"
                    accept=".json"
                    onChange={handleImportFile}
                    style={{ display: "none" }}
                    aria-hidden="true"
                />
                    {/* settings */}
                    <button
                        onClick={() => setShowSettings((v) => !v)}
                        style={btnStyle("ghost")}
                        aria-label="Open settings"
                        aria-expanded={showSettings}
                    >
                        Settings
                    </button>
                <div ref={addColRef} style={{ position: "relative" }}>
                    {/* add column */}
                    <button
                        onClick={() => setShowAddCol(v => !v)}
                        aria-label="Add new column"
                        aria-expanded={showAddCol}
                        title="Add column"
                        style={{ ...btnStyle("outline"), padding: "6px 10px", fontSize: 13 }}
                    >
                        + Add Col
                    </button>
                    {showAddCol && (
                        <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 200, background: "var(--bg-raised)", border: "1px solid var(--border-default)", borderRadius: 12, boxShadow: "var(--shadow-lg)", padding: 12, minWidth: 220, display: "flex", flexDirection: "column", gap: 8 }}>
                            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>New column</p>
                            <input
                                autoFocus
                                value={newColLabel}
                                onChange={e => setNewColLabel(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter") submitAddCol(); if (e.key === "Escape") setShowAddCol(false); }}
                                placeholder="Column name…"
                                aria-label="New column name"
                                style={{ fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border-default)", background: "var(--bg-subtle)", color: "var(--text-primary)", outline: "none" }}
                            />
                            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                                <button onClick={() => setShowAddCol(false)} style={{ ...btnStyle("ghost"), fontSize: 12 }}>Cancel</button>
                                <button onClick={submitAddCol} disabled={!newColLabel.trim()} style={{ ...btnStyle("primary"), fontSize: 12, opacity: newColLabel.trim() ? 1 : 0.5 }}>Add</button>
                            </div>
                        </div>
                    )}
                </div>
                {/* add job */}
                <button
                    onClick={() => setModal({ mode: "add", column: "watchlist" })}
                    style={btnStyle("primary")}
                    aria-label="Add a new job"
                >
                    + Add Job
                </button>
            </header>

            {importError && (
                <div role="alert" style={{ background: "var(--danger-bg)", color: "var(--danger)", padding: "8px 24px", fontSize: 13 }}>
                    Import failed: {importError}
                    <button onClick={() => setImportError("")} style={{ marginLeft: 12, ...btnStyle("ghost") }}>Dismiss</button>
                </div>
            )}

            {/* filters */}
            <FilterBar
                filters={filters}
                onChange={setFilters}
                columns={columns}
                allJobs={jobs}
            />

            {/* main content -- kanban board, table view, stats dashboard */}
            <main id="main-content" style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                {view === "board" && (
                    <Board
                        jobs={filteredJobs}
                        allJobs={jobs}
                        columns={columns}
                        groupBy={filters.groupBy}
                        onAddJob={(col) => setModal({ mode: "add", column: col })}
                        onOpenJob={(job) => setModal({ mode: "view", job })}
                        onMoveJob={moveJob}
                        onReorderJobs={reorderJobs}
                        onReorderColumns={reorderColumns}
                    />
                )}
                {view === "table" && (
                    <Table
                        jobs={filteredJobs}
                        columns={columns}
                        groupBy={filters.groupBy}
                        onOpenJob={(job) => setModal({ mode: "view", job })}
                        onAddJob={() => setModal({ mode: "add", column: "watchlist" })}
                        onMoveJob={moveJob}
                    />
                )}
                {view === "stats" && (
                    <Stats jobs={filteredJobs} allJobs={jobs} columns={columns} hasFilters={filteredJobs.length !== jobs.length} />
                )}
            </main>

            {/* job modal */}
            {modal && (
                <JobModal
                    modal={modal}
                    columns={columns}
                    onClose={() => setModal(null)}
                    onAdd={addJob}
                    onUpdate={updateJob}
                    onDelete={deleteJob}
                    onMove={moveJob}
                    onEdit={(job) => setModal({ mode: "edit", job })}
                />
            )}

            {/* settings */}
            {showSettings && (
                <Settings
                    palette={palette}
                    theme={theme}
                    columns={columns}
                    onPaletteChange={(p) => patch({ palette: p })}
                    onThemeChange={(t) => patch({ theme: t })}
                    onAddColumn={addColumn}
                    onRenameColumn={renameColumn}
                    onDeleteColumn={deleteColumn}
                    onReorderColumns={reorderColumns}
                    onClose={() => setShowSettings(false)}
                    onExport={handleExport}
                    onImport={handleImportClick}
                />
            )}
        </div>
    );
}

// STATS
function StatPill({ label, value, accent, muted }) {
    const valueColor = accent ? "var(--accent-text)" : "var(--text-primary)";
    return (
        <div style={{display: "inline-flex", justifyContent: "center", alignItems: "baseline", gap: 5, fontSize: 12, lineHeight: "1", whiteSpace: "nowrap", }}>
            <span style={{ color: "var(--text-tertiary)", fontWeight: 400 }}>{label}</span>
            <span style={{ color: valueColor, fontWeight: 700 }}>{value}</span>
        </div>
    );
}

// BUTTON STYLE
export function btnStyle(variant = "outline") {
    const base = {
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "6px 12px",
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 500,
        cursor: "pointer",
        transition: "background 0.15s, color 0.15s, border-color 0.15s",
        lineHeight: 1.4,
        whiteSpace: "nowrap",
    };
    if (variant === "primary") return { ...base, background: "var(--accent)", color: "#fff", border: "none" };
    if (variant === "outline") return { ...base, background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-default)" };
    if (variant === "ghost")   return { ...base, background: "transparent", color: "var(--text-secondary)", border: "none" };
    if (variant === "danger")  return { ...base, background: "var(--danger-bg)", color: "var(--danger)", border: "1px solid var(--danger)" };
    return base;
}