import { useState, useEffect, useCallback, useRef } from "react";
import {
    loadState, saveState, exportData, importData,
    isBannerDismissed, dismissBanner, genId, columnById, PALETTES,
    DEFAULT_FILTERS, applyFilters, activeFilterCount, btnStyle,
} from "./store.js";
import FilterBar from "./components/FilterBar.jsx";
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

    // quick ctrl+v paste text outside job modal
    useEffect(() => {
        const handler = async e => {
            const tag = document.activeElement?.tagName?.toLowerCase();
            const isEditable = tag === "input" || tag === "textarea" || tag === "select"
                || document.activeElement?.isContentEditable;
            if (modal || isEditable) return;
            if (!(e.ctrlKey || e.metaKey) || e.key !== "v") return;
            try {
                const text = await navigator.clipboard.readText();
                if (!text?.trim()) return;
                // detect URL vs plain text
                const isUrl = /^https?:\/\//i.test(text.trim());
                setModal({
                    mode: "add",
                    column: "watchlist",
                    prefilled: text.trim(),
                    prefilledIsUrl: isUrl,
                });
            } catch {
                // clipboard permission denied - ignore
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [modal]);

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

            {/* skip-to-content link (accessibility - keyboard/screen reader users) */}
            <a
                href="#main-content"
                className="skip-link"
                style={{
                    position: "absolute", top: -999, left: 8, zIndex: 9999,
                    padding: "8px 16px", borderRadius: 6, fontSize: 13, fontWeight: 600,
                    background: "var(--accent)", color: "#fff",
                    textDecoration: "none",
                }}
                onFocus={e => { e.currentTarget.style.top = "8px"; }}
                onBlur={e => { e.currentTarget.style.top = "-999px"; }}
            >
                Skip to main content
            </a>

            {/* banner - notif on data privacy & local storage */}
            {!bannerDismissed && (
                <div role="status" aria-live="polite" style={{ background: "var(--bg-subtle)", borderBottom: "1px solid var(--border-default)", padding: "10px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, fontSize: 13, color: "var(--text-secondary)" }}>
                    <span>
                        <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>Your data stays on your device.</strong>
                        {" "}Sprout saves to your browser's local storage — nothing is sent to any server. Export a backup anytime to keep your data safe.
                    </span>
                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                        <button onClick={handleExport} style={btnStyle("outline")} aria-label="Export data backup">Export backup</button>
                        <button onClick={() => { setBannerDismissed(true); dismissBanner(); }} aria-label="Dismiss notice" style={{ ...btnStyle("ghost"), fontWeight: 500, fontSize: 18, padding: "2px 8px", lineHeight: 1 }}>ⓧ</button>
                    </div>
                </div>
            )}

            {/* header */}
            <header
                style={{
                    background: "var(--bg-surface)",
                    borderBottom: "1px solid var(--border-default)",
                    padding: "0 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    height: 54,
                    position: "sticky",
                    top: 0,
                    zIndex: 50,
                    overflowX: "hidden",
                    flexWrap: "nowrap",
                }}
            >
                {/* logo + wordmark - wordmark hidden below 768px */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <div aria-hidden="true" style={{ width: 30, height: 30, borderRadius: 9, background: "var(--accent-light)", border: "1.5px solid var(--border-default)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <img src="/favicon2.png" alt="" width={14} />
                    </div>
                    {/* sr-only brand name always available to screen readers */}
                    <span className="sr-only">Sprout</span>
                    {/* <span className="sprout-wordmark wordmark-desktop" style={{ fontSize: 16 }} aria-hidden="true">Sprout</span> */}
                </div>

                {/* nav - text labels collapse to icons below 640px */}
                <nav aria-label="Main navigation" style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                    {NAV.map(n => (
                        <button key={n.id} onClick={() => setView(n.id)} aria-current={view === n.id ? "page" : undefined}
                            aria-label={n.label}
                            style={{ padding: "5px 10px", borderRadius: 7, border: "none", background: view === n.id ? "var(--accent-light)" : "transparent", color: view === n.id ? "var(--accent-text)" : "var(--text-secondary)", fontWeight: view === n.id ? 600 : 400, fontSize: 13, cursor: "pointer", transition: "background 0.15s, color 0.15s", display: "flex", alignItems: "center", gap: 5 }}>
                            {/* icon always visible */}
                            <span aria-hidden="true" style={{ display: "flex", alignItems: "center" }}>
                                {n.id === "board" && <NavIconBoard />}
                                {n.id === "table" && <NavIconTable />}
                                {n.id === "stats" && <NavIconStats />}
                            </span>
                            {/* label hidden below 640px */}
                            <span className="btn-text">{n.label}</span>
                        </button>
                    ))}
                </nav>

                {/* STATS */}
                <div className="stats-desktop" style={{ position: "relative" }}>
                    <span style={{ fontSize: 12, color: "var(--text-tertiary)", whiteSpace: "nowrap" }} aria-label={`${totalTracked} tracked, ${activeCount} active`}>
                        {totalTracked} tracked · {activeCount} active
                        {filterCount > 0 && <span style={{ color: "var(--accent-text)" }}> · {filteredJobs.length} shown</span>}
                    </span>
                </div>

                <div style={{ flex: 1 }} />

                {/* search */}
                <div style={{ position: "relative", flex: "0 1 220px", minWidth: 90 }}>
                    <label htmlFor="global-search" className="sr-only">Search jobs</label>
                    <input
                        id="global-search" type="search" placeholder="Search..." value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{ width: "100%", padding: "6px 10px 6px 28px", borderRadius: 8, border: "1px solid var(--border-default)", background: "var(--bg-subtle)", color: "var(--text-primary)", fontSize: 12, outline: "none" }}
                        aria-label="Search jobs by company, role, location, or tag"
                    />
                    <IconSearch />
                </div>

                {/* Import - icon below 640px */}
                <button onClick={handleImportClick} style={btnStyle("ghost")} aria-label="Import backup file">
                    <span className="btn-icon" aria-hidden="true"><IconImport /></span>
                    <span className="btn-text">Import</span>
                </button>

                {/* Export - icon below 640px */}
                <button onClick={handleExport} style={btnStyle("ghost")} aria-label="Export backup">
                    <span className="btn-icon" aria-hidden="true"><IconExport /></span>
                    <span className="btn-text">Export</span>
                </button>

                <input ref={fileRef} type="file" accept=".json" onChange={handleImportFile} style={{ display: "none" }} aria-hidden="true" />

                {/* Settings - icon below 640px */}
                <button onClick={() => setShowSettings(v => !v)} style={btnStyle("ghost")} aria-label="Open settings" aria-expanded={showSettings}>
                    <span className="btn-icon" aria-hidden="true"><IconSettings /></span>
                    <span className="btn-text">Settings</span>
                </button>

                {/* Quick add column - icon below 640px */}
                <div ref={addColRef} style={{ position: "relative", flexShrink: 0 }}>
                    <button
                        onClick={() => setShowAddCol(v => !v)}
                        aria-label="Add new column"
                        aria-expanded={showAddCol}
                        title="Add column"
                        style={{ ...btnStyle("outline"), padding: "6px 10px", fontSize: 13 }}
                    >
                        <span className="btn-icon" aria-hidden="true">
                            < IconAddCol />
                        </span>
                        <span className="btn-text">+ Col</span>
                    </button>
                    {showAddCol && (
                        <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 200, background: "var(--bg-raised)", border: "1px solid var(--border-default)", borderRadius: 12, boxShadow: "var(--shadow-lg)", padding: 12, minWidth: 220, display: "flex", flexDirection: "column", gap: 8 }}>
                            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>New column</p>
                            <input
                                autoFocus
                                value={newColLabel}
                                onChange={e => setNewColLabel(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter") submitAddCol(); if (e.key === "Escape") setShowAddCol(false); }}
                                placeholder="Column name..."
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

                {/* add job - icon below 640px */}
                <button onClick={() => setModal({ mode: "add", column: "watchlist" })} style={btnStyle("primary")} aria-label="Add a new job">
                    <span className="btn-icon" aria-hidden="true">
                        < IconAddJob />
                    </span>
                    <span className="btn-text">+ Job</span>
                </button>
            </header>

            {importError && (
                <div role="alert" style={{ background: "var(--danger-bg)", color: "var(--danger)", padding: "8px 24px", fontSize: 13, borderBottom: "1px solid var(--danger)" }}>
                    Import failed: {importError}
                    <button onClick={() => setImportError("")} style={{ marginLeft: 12, ...btnStyle("ghost") }}>Dismiss</button>
                </div>
            )}

            {/* filters */}
            <FilterBar filters={filters} onChange={setFilters} columns={columns} allJobs={jobs} />

            {/* main content -- kanban board, table view, stats dashboard */}
            <main id="main-content" style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }} tabIndex={-1}>
                {view === "board" && (
                    <Board
                        jobs={filteredJobs}
                        allJobs={jobs}
                        columns={columns}
                        groupBy={filters.groupBy}
                        onAddJob={col => setModal({ mode: "add", column: col })}
                        onOpenJob={job => setModal({ mode: "view", job })}
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
                    onEdit={job => setModal({ mode: "edit", job })}
                />
            )}

            {/* settings */}
            {showSettings && (
                <Settings
                    palette={palette}
                    theme={theme}
                    columns={columns}
                    onPaletteChange={p => patch({ palette: p })}
                    onThemeChange={t => patch({ theme: t })}
                    onAddColumn={addColumn}
                    onRenameColumn={renameColumn}
                    onDeleteColumn={deleteColumn}
                    onReorderColumns={reorderColumns}
                    onUpdateColumnColor={updateColumnColor}
                    onClose={() => setShowSettings(false)}
                    onExport={handleExport}
                    onImport={handleImportClick}
                />
            )}
        </div>
    );
}

// =================================== NAVBAR ICONS =====================================
function NavIconBoard() {
    return (
        // <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
        //     <path d="M10.5 19.9V4.1C10.5 2.6 9.86 2 8.27 2H4.23C2.64 2 2 2.6 2 4.1V19.9C2 21.4 2.64 22 4.23 22H8.27C9.86 22 10.5 21.4 10.5 19.9Z" stroke="#292D32" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path> 
        //     <path d="M22 12.9V4.1C22 2.6 21.36 2 19.77 2H15.73C14.14 2 13.5 2.6 13.5 4.1V12.9C13.5 14.4 14.14 15 15.73 15H19.77C21.36 15 22 14.4 22 12.9Z" stroke="#292D32" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path> 
        // </svg>
        <svg width="18" height="18"  fill="currentColor" viewBox="0 0 24 24">
            <path d="M5.3783 2C5.3905 2 5.40273 2 5.415 2L7.62171 2C8.01734 1.99998 8.37336 1.99996 8.66942 2.02454C8.98657 2.05088 9.32336 2.11052 9.65244 2.28147C10.109 2.51866 10.4813 2.89096 10.7185 3.34757C10.8895 3.67665 10.9491 4.01343 10.9755 4.33059C11 4.62664 11 4.98265 11 5.37828V9.62172C11 10.0174 11 10.3734 10.9755 10.6694C10.9491 10.9866 10.8895 11.3234 10.7185 11.6524C10.4813 12.109 10.109 12.4813 9.65244 12.7185C9.32336 12.8895 8.98657 12.9491 8.66942 12.9755C8.37337 13 8.01735 13 7.62172 13H5.37828C4.98265 13 4.62664 13 4.33059 12.9755C4.01344 12.9491 3.67665 12.8895 3.34757 12.7185C2.89096 12.4813 2.51866 12.109 2.28147 11.6524C2.11052 11.3234 2.05088 10.9866 2.02454 10.6694C1.99996 10.3734 1.99998 10.0173 2 9.62171L2 5.415C2 5.40273 2 5.3905 2 5.3783C1.99998 4.98266 1.99996 4.62664 2.02454 4.33059C2.05088 4.01343 2.11052 3.67665 2.28147 3.34757C2.51866 2.89096 2.89096 2.51866 3.34757 2.28147C3.67665 2.11052 4.01343 2.05088 4.33059 2.02454C4.62664 1.99996 4.98266 1.99998 5.3783 2ZM4.27752 4.05297C4.27226 4.05488 4.27001 4.05604 4.26952 4.0563C4.17819 4.10373 4.10373 4.17819 4.0563 4.26952C4.05604 4.27001 4.05488 4.27226 4.05297 4.27752C4.05098 4.28299 4.04767 4.29312 4.04372 4.30961C4.03541 4.34427 4.02554 4.40145 4.01768 4.49611C4.00081 4.69932 4 4.9711 4 5.415V9.585C4 10.0289 4.00081 10.3007 4.01768 10.5039C4.02554 10.5986 4.03541 10.6557 4.04372 10.6904C4.04767 10.7069 4.05098 10.717 4.05297 10.7225C4.05488 10.7277 4.05604 10.73 4.0563 10.7305C4.10373 10.8218 4.17819 10.8963 4.26952 10.9437C4.27001 10.944 4.27226 10.9451 4.27752 10.947C4.28299 10.949 4.29312 10.9523 4.30961 10.9563C4.34427 10.9646 4.40145 10.9745 4.49611 10.9823C4.69932 10.9992 4.9711 11 5.415 11H7.585C8.02891 11 8.30068 10.9992 8.5039 10.9823C8.59855 10.9745 8.65574 10.9646 8.6904 10.9563C8.70688 10.9523 8.71701 10.949 8.72249 10.947C8.72775 10.9451 8.72999 10.944 8.73049 10.9437C8.82181 10.8963 8.89627 10.8218 8.94371 10.7305C8.94397 10.73 8.94513 10.7277 8.94704 10.7225C8.94903 10.717 8.95234 10.7069 8.95629 10.6904C8.96459 10.6557 8.97446 10.5986 8.98232 10.5039C8.9992 10.3007 9 10.0289 9 9.585V5.415C9 4.9711 8.9992 4.69932 8.98232 4.49611C8.97446 4.40145 8.96459 4.34427 8.95629 4.30961C8.95234 4.29312 8.94903 4.28299 8.94704 4.27752C8.94513 4.27226 8.94397 4.27001 8.94371 4.26952C8.89627 4.17819 8.82181 4.10373 8.73049 4.0563C8.72999 4.05604 8.72775 4.05488 8.72249 4.05297C8.71701 4.05098 8.70688 4.04767 8.6904 4.04372C8.65574 4.03541 8.59855 4.02554 8.5039 4.01768C8.30068 4.00081 8.02891 4 7.585 4H5.415C4.9711 4 4.69932 4.00081 4.49611 4.01768C4.40145 4.02554 4.34427 4.03541 4.30961 4.04372C4.29312 4.04767 4.28299 4.05098 4.27752 4.05297ZM16.3783 2H18.6217C19.0173 1.99998 19.3734 1.99996 19.6694 2.02454C19.9866 2.05088 20.3234 2.11052 20.6524 2.28147C21.109 2.51866 21.4813 2.89096 21.7185 3.34757C21.8895 3.67665 21.9491 4.01343 21.9755 4.33059C22 4.62665 22 4.98267 22 5.37832V5.62168C22 6.01733 22 6.37336 21.9755 6.66942C21.9491 6.98657 21.8895 7.32336 21.7185 7.65244C21.4813 8.10905 21.109 8.48135 20.6524 8.71854C20.3234 8.88948 19.9866 8.94912 19.6694 8.97546C19.3734 9.00005 19.0173 9.00003 18.6217 9H16.3783C15.9827 9.00003 15.6266 9.00005 15.3306 8.97546C15.0134 8.94912 14.6766 8.88948 14.3476 8.71854C13.891 8.48135 13.5187 8.10905 13.2815 7.65244C13.1105 7.32336 13.0509 6.98657 13.0245 6.66942C13 6.37337 13 6.01735 13 5.62172V5.37828C13 4.98265 13 4.62664 13.0245 4.33059C13.0509 4.01344 13.1105 3.67665 13.2815 3.34757C13.5187 2.89096 13.891 2.51866 14.3476 2.28147C14.6766 2.11052 15.0134 2.05088 15.3306 2.02454C15.6266 1.99996 15.9827 1.99998 16.3783 2ZM15.2775 4.05297C15.2723 4.05488 15.27 4.05604 15.2695 4.0563C15.1782 4.10373 15.1037 4.17819 15.0563 4.26952C15.056 4.27001 15.0549 4.27226 15.053 4.27752C15.051 4.28299 15.0477 4.29312 15.0437 4.30961C15.0354 4.34427 15.0255 4.40145 15.0177 4.49611C15.0008 4.69932 15 4.9711 15 5.415V5.585C15 6.02891 15.0008 6.30068 15.0177 6.5039C15.0255 6.59855 15.0354 6.65574 15.0437 6.6904C15.0477 6.70688 15.051 6.71701 15.053 6.72249C15.0549 6.72775 15.056 6.72999 15.0563 6.73049C15.1037 6.82181 15.1782 6.89627 15.2695 6.94371C15.27 6.94397 15.2723 6.94512 15.2775 6.94704C15.283 6.94903 15.2931 6.95234 15.3096 6.95629C15.3443 6.96459 15.4015 6.97446 15.4961 6.98232C15.6993 6.9992 15.9711 7 16.415 7H18.585C19.0289 7 19.3007 6.9992 19.5039 6.98232C19.5986 6.97446 19.6557 6.96459 19.6904 6.95629C19.7069 6.95234 19.717 6.94903 19.7225 6.94704C19.7277 6.94512 19.73 6.94397 19.7305 6.94371C19.8218 6.89627 19.8963 6.82181 19.9437 6.73049C19.944 6.72999 19.9451 6.72775 19.947 6.72249C19.949 6.71701 19.9523 6.70688 19.9563 6.6904C19.9646 6.65573 19.9745 6.59855 19.9823 6.5039C19.9992 6.30068 20 6.02891 20 5.585V5.415C20 4.9711 19.9992 4.69932 19.9823 4.49611C19.9745 4.40145 19.9646 4.34427 19.9563 4.30961C19.9523 4.29312 19.949 4.28299 19.947 4.27752C19.9451 4.27226 19.944 4.27001 19.9437 4.26952C19.8963 4.17819 19.8218 4.10373 19.7305 4.0563C19.73 4.05604 19.7277 4.05488 19.7225 4.05297C19.717 4.05098 19.7069 4.04767 19.6904 4.04372C19.6557 4.03541 19.5986 4.02554 19.5039 4.01768C19.3007 4.00081 19.0289 4 18.585 4H16.415C15.9711 4 15.6993 4.00081 15.4961 4.01768C15.4015 4.02554 15.3443 4.03541 15.3096 4.04372C15.2931 4.04767 15.283 4.05098 15.2775 4.05297ZM16.3783 11H18.6217C19.0173 11 19.3734 11 19.6694 11.0245C19.9866 11.0509 20.3234 11.1105 20.6524 11.2815C21.109 11.5187 21.4813 11.891 21.7185 12.3476C21.8895 12.6766 21.9491 13.0134 21.9755 13.3306C22 13.6266 22 13.9827 22 14.3783V18.6217C22 19.0173 22 19.3734 21.9755 19.6694C21.9491 19.9866 21.8895 20.3234 21.7185 20.6524C21.4813 21.109 21.109 21.4813 20.6524 21.7185C20.3234 21.8895 19.9866 21.9491 19.6694 21.9755C19.3734 22 19.0173 22 18.6217 22H16.3783C15.9827 22 15.6266 22 15.3306 21.9755C15.0134 21.9491 14.6766 21.8895 14.3476 21.7185C13.891 21.4813 13.5187 21.109 13.2815 20.6524C13.1105 20.3234 13.0509 19.9866 13.0245 19.6694C13 19.3734 13 19.0174 13 18.6217V14.3783C13 13.9827 13 13.6266 13.0245 13.3306C13.0509 13.0134 13.1105 12.6766 13.2815 12.3476C13.5187 11.891 13.891 11.5187 14.3476 11.2815C14.6766 11.1105 15.0134 11.0509 15.3306 11.0245C15.6266 11 15.9827 11 16.3783 11ZM15.2775 13.053C15.2723 13.0549 15.27 13.056 15.2695 13.0563C15.1782 13.1037 15.1037 13.1782 15.0563 13.2695C15.056 13.27 15.0549 13.2723 15.053 13.2775C15.051 13.283 15.0477 13.2931 15.0437 13.3096C15.0354 13.3443 15.0255 13.4015 15.0177 13.4961C15.0008 13.6993 15 13.9711 15 14.415V18.585C15 19.0289 15.0008 19.3007 15.0177 19.5039C15.0255 19.5986 15.0354 19.6557 15.0437 19.6904C15.0477 19.7069 15.051 19.717 15.053 19.7225C15.0549 19.7277 15.056 19.73 15.0563 19.7305C15.1037 19.8218 15.1782 19.8963 15.2695 19.9437C15.27 19.944 15.2723 19.9451 15.2775 19.947C15.283 19.949 15.2931 19.9523 15.3096 19.9563C15.3443 19.9646 15.4015 19.9745 15.4961 19.9823C15.6993 19.9992 15.9711 20 16.415 20H18.585C19.0289 20 19.3007 19.9992 19.5039 19.9823C19.5986 19.9745 19.6557 19.9646 19.6904 19.9563C19.7069 19.9523 19.717 19.949 19.7225 19.947C19.7277 19.9451 19.73 19.944 19.7305 19.9437C19.8218 19.8963 19.8963 19.8218 19.9437 19.7305C19.944 19.73 19.9451 19.7277 19.947 19.7225C19.949 19.717 19.9523 19.7069 19.9563 19.6904C19.9646 19.6557 19.9745 19.5986 19.9823 19.5039C19.9992 19.3007 20 19.0289 20 18.585V14.415C20 13.9711 19.9992 13.6993 19.9823 13.4961C19.9745 13.4015 19.9646 13.3443 19.9563 13.3096C19.9523 13.2931 19.949 13.283 19.947 13.2775C19.9451 13.2723 19.944 13.27 19.9437 13.2695C19.8963 13.1782 19.8218 13.1037 19.7305 13.0563C19.73 13.056 19.7277 13.0549 19.7225 13.053C19.717 13.051 19.7069 13.0477 19.6904 13.0437C19.6557 13.0354 19.5986 13.0255 19.5039 13.0177C19.3007 13.0008 19.0289 13 18.585 13H16.415C15.9711 13 15.6993 13.0008 15.4961 13.0177C15.4015 13.0255 15.3443 13.0354 15.3096 13.0437C15.2931 13.0477 15.283 13.051 15.2775 13.053ZM5.37828 15H7.62172C8.01735 15 8.37337 15 8.66942 15.0245C8.98657 15.0509 9.32336 15.1105 9.65244 15.2815C10.109 15.5187 10.4813 15.891 10.7185 16.3476C10.8895 16.6766 10.9491 17.0134 10.9755 17.3306C11 17.6266 11 17.9827 11 18.3783V18.6217C11 19.0174 11 19.3734 10.9755 19.6694C10.9491 19.9866 10.8895 20.3234 10.7185 20.6524C10.4813 21.109 10.109 21.4813 9.65244 21.7185C9.32336 21.8895 8.98657 21.9491 8.66942 21.9755C8.37336 22 8.01733 22 7.62168 22H5.37832C4.98267 22 4.62665 22 4.33059 21.9755C4.01343 21.9491 3.67665 21.8895 3.34757 21.7185C2.89096 21.4813 2.51866 21.109 2.28147 20.6524C2.11052 20.3234 2.05088 19.9866 2.02454 19.6694C1.99996 19.3734 1.99998 19.0173 2 18.6217V18.3783C1.99998 17.9827 1.99996 17.6266 2.02454 17.3306C2.05088 17.0134 2.11052 16.6766 2.28147 16.3476C2.51866 15.891 2.89096 15.5187 3.34757 15.2815C3.67665 15.1105 4.01344 15.0509 4.33059 15.0245C4.62664 15 4.98265 15 5.37828 15ZM4.27752 17.053C4.27226 17.0549 4.27001 17.056 4.26952 17.0563C4.17819 17.1037 4.10373 17.1782 4.0563 17.2695C4.05604 17.27 4.05488 17.2723 4.05297 17.2775C4.05098 17.283 4.04767 17.2931 4.04372 17.3096C4.03541 17.3443 4.02554 17.4015 4.01768 17.4961C4.00081 17.6993 4 17.9711 4 18.415V18.585C4 19.0289 4.00081 19.3007 4.01768 19.5039C4.02554 19.5986 4.03541 19.6557 4.04372 19.6904C4.04767 19.7069 4.05098 19.717 4.05297 19.7225C4.05488 19.7277 4.05604 19.73 4.0563 19.7305C4.10373 19.8218 4.17819 19.8963 4.26952 19.9437C4.27001 19.944 4.27226 19.9451 4.27752 19.947C4.28299 19.949 4.29312 19.9523 4.30961 19.9563C4.34427 19.9646 4.40145 19.9745 4.49611 19.9823C4.69932 19.9992 4.9711 20 5.415 20H7.585C8.02891 20 8.30068 19.9992 8.5039 19.9823C8.59855 19.9745 8.65573 19.9646 8.6904 19.9563C8.70688 19.9523 8.71701 19.949 8.72249 19.947C8.72775 19.9451 8.72999 19.944 8.73049 19.9437C8.82181 19.8963 8.89627 19.8218 8.94371 19.7305C8.94397 19.73 8.94513 19.7277 8.94704 19.7225C8.94903 19.717 8.95234 19.7069 8.95629 19.6904C8.96459 19.6557 8.97446 19.5986 8.98232 19.5039C8.9992 19.3007 9 19.0289 9 18.585V18.415C9 17.9711 8.9992 17.6993 8.98232 17.4961C8.97446 17.4015 8.96459 17.3443 8.95629 17.3096C8.95234 17.2931 8.94903 17.283 8.94704 17.2775C8.94513 17.2723 8.94397 17.27 8.94371 17.2695C8.89627 17.1782 8.82181 17.1037 8.73049 17.0563C8.72999 17.056 8.72775 17.0549 8.72249 17.053C8.71701 17.051 8.70688 17.0477 8.6904 17.0437C8.65574 17.0354 8.59855 17.0255 8.5039 17.0177C8.30068 17.0008 8.02891 17 7.585 17H5.415C4.9711 17 4.69932 17.0008 4.49611 17.0177C4.40145 17.0255 4.34427 17.0354 4.30961 17.0437C4.29312 17.0477 4.28299 17.051 4.27752 17.053Z" ></path> 
        </svg>
    );
}

function NavIconTable() {
    return (
        // <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        //     <rect x="3" y="3" width="18" height="18" rx="1"></rect>
        //     <path d="M3 9h18M3 15h18"></path>
        // </svg>
        <svg viewBox="0 0 48 48" width="18" height="18" fill="currentColor">
            <rect width="48" height="48" fill="none"></rect>
            <path d="M42,4H6A2,2,0,0,0,4,6V42a2,2,0,0,0,2,2H42a2,2,0,0,0,2-2V6A2,2,0,0,0,42,4ZM40,8v8H8V8Zm0,12v8H8V20ZM8,40V32H40v8Z"></path> 
        </svg>
    );
}

function NavIconStats() {
    return (
        // <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
        //     <rect x="1"   y="4" width="3.5" height="10" rx="1" fill="currentColor" opacity="0.9" />
        //     <rect x="5.8" y="1" width="3.5" height="13" rx="1" fill="currentColor" opacity="0.9" />
        //     <rect x="10.5" y="6" width="3.5" height="8" rx="1" fill="currentColor" opacity="0.9" />
        // </svg>
        <svg width="15" height="15" viewBox="-1 0 24 24"  fill="currentColor">
            <path d="M1520,264a3,3,0,0,1-3-3V243a3,3,0,0,1,6,0v18A3,3,0,0,1,1520,264Zm1-22h-2v20h2V242Zm-9,22a3,3,0,0,1-3-3V250a3,3,0,0,1,6,0v11A3,3,0,0,1,1512,264Zm1-15h-2v13h2V249Zm-9,15a3,3,0,0,1-3-3v-4a3,3,0,0,1,6,0v4A3,3,0,0,1,1504,264Zm1-8h-2v6h2v-6Z" transform="translate(-1501 -240)"></path> 
        </svg>
    );
}

function IconSearch () {
    return (
        <svg aria-hidden="true" width="12" height="12" viewBox="0 0 14 14" fill="none" style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", opacity: 0.4, pointerEvents: "none" }}>
            <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.5" />
            <line x1="9.2" y1="9.2" x2="12.5" y2="12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
}

function IconImport() {
    return (
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M7.5 1v8M4.5 6l3 3 3-3" />
            <path d="M2 11v1.5A1.5 1.5 0 003.5 14h8a1.5 1.5 0 001.5-1.5V11" />
        </svg>
    );
}

function IconExport() {
    return (
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M7.5 9V1M4.5 4l3-3 3 3" />
            <path d="M2 11v1.5A1.5 1.5 0 003.5 14h8a1.5 1.5 0 001.5-1.5V11" />
        </svg>
    );
}

function IconSettings() {
    return (
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
            <circle cx="7.5" cy="7.5" r="2" />
            <path d="M7.5 1v1.5M7.5 12.5V14M1 7.5h1.5M12.5 7.5H14M2.9 2.9l1.1 1.1M11 11l1.1 1.1M2.9 12.1L4 11M11 4l1.1-1.1" />
        </svg>
    );
}

function IconAddCol() {
    return (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <rect x="1" y="1" width="5" height="12" rx="1" />
            <line x1="10.5" y1="4" x2="11" y2="10" />
            <line x1="8" y1="7" x2="14" y2="7" />
        </svg>
    );
}

function IconAddJob() {
    return (
        // <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        //     <line x1="6.5" y1="1" x2="6.5" y2="12" />
        //     <line x1="1" y1="6.5" x2="12" y2="6.5" />
        // </svg>
        <svg height="15px" width="15px" viewBox="0 0 246 471.1">
            <path d="M168.1,279.8c63.1-56-7-95.6-69.5-127.9C12.9,107.7,14,38.8,86.2,26.4c53.4-9.2,25.3,35.7,42.3,71 c8,16.5,76,7.5,73-2.6c-2.5-8.3-32.6-6.5-42.3-18.6c-6.5-8-1.6-25.4-4.9-37.6C138.2-20.2,35.8-7,9.8,45.9 c-31.2,63.4,17.6,100.1,68.4,128.9C131.2,204.9,156.7,227.5,168.1,279.8z"></path> 
            <path d="M106,228.8c-22.8,12.9-44.8,35-62.2,77C2.1,406.7,64.5,468.9,128,471.1l-0.4-0.1l0.4-2 c3.2-16,13.7-72.6,14.1-130.5c0.4-53.4-8-85.5-24.2-100.6C114.4,234.6,110.4,231.6,106,228.8z"></path> 
            <path d="M214.7,244.1c5.1,6.5-13,51.7-41.7,67.2c-0.8,66.9-18.7,137.3-25.3,159.4c43.1-3.3,88.5-35.4,96.7-106.7 C250.7,308.9,238.1,269.3,214.7,244.1z"></path> 
        </svg>
    );
}

// others akternatives: 
// - kanban board: https://www.svgrepo.com/svg/532955/grid-plus
// - board: https://www.svgrepo.com/svg/506211/grid-4
// - table: https://www.svgrepo.com/svg/506210/grid-2-horizontal
// - stats: https://www.svgrepo.com/svg/506209/grid-2-vertical