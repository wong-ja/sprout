import { useState, useRef, useEffect } from "react";
import { PALETTES } from "../store.js";
import { btnStyle } from "../App.jsx";

export default function Settings({
    palette, theme, columns,
    onPaletteChange, onThemeChange,
    onAddColumn, onRenameColumn, onDeleteColumn, onReorderColumns,
    onClose, onExport, onImport,
}) {
    const panelRef = useRef();

    // close on outside click
    useEffect(() => {
        const handler = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [onClose]);

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 150,
                display: "flex",
                justifyContent: "flex-end",
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Settings"
        >
            {/* background */}
            <div
                onClick={onClose}
                style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.2)" }}
                aria-hidden="true"
            />

            {/* panel */}
            <div
                ref={panelRef}
                style={{
                    position: "relative",
                    width: 360,
                    maxWidth: "100%",
                    height: "100%",
                    background: "var(--bg-surface)",
                    borderLeft: "1px solid var(--border-default)",
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    boxShadow: "var(--shadow-lg)",
                }}
            >
                {/* HEADER */}
                <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-default)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Settings</h2>
                    <button onClick={onClose} style={{ ...btnStyle("ghost"), fontSize: 20, padding: "2px 8px" }} aria-label="Close settings">×</button>
                </div>

                <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 28 }}>

                    {/* THEME: LIGHT/DARK */}
                    <Section title="Appearance">
                        <div style={{ display: "flex", gap: 8 }}>
                            {["light", "dark"].map((t) => (
                                <button
                                    key={t}
                                    onClick={() => onThemeChange(t)}
                                    aria-pressed={theme === t}
                                    style={{
                                        flex: 1, padding: "8px", borderRadius: 8, cursor: "pointer",
                                        border: `2px solid ${theme === t ? "var(--accent)" : "var(--border-default)"}`,
                                        background: theme === t ? "var(--accent-light)" : "transparent",
                                        color: theme === t ? "var(--accent-text)" : "var(--text-secondary)",
                                        fontWeight: theme === t ? 700 : 400,
                                        fontSize: 13,
                                        transition: "all 0.12s",
                                        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                                    }}
                                >
                                    <span aria-hidden="true">{t === "light" ? "☀︎" : "☽"}</span>
                                    {t.charAt(0).toUpperCase() + t.slice(1)}
                                </button>
                            ))}
                        </div>
                    </Section>

                    {/* COLOR PALETTE PRESETES */}
                    <Section title="Color palette">
                        <div style={{ 
                            display: "grid", 
                            gridTemplateColumns: "repeat(2, 1fr)", 
                            gridTemplateRows: "auto 1fr", 
                            gap: 8 
                        }}>
                            {PALETTES.map((p) => (
                                <button
                                    key={p.id}
                                    onClick={() => onPaletteChange(p.id)}
                                    aria-pressed={palette === p.id}
                                    aria-label={`${p.label} palette - ${p.description}${palette === p.id ? ", selected" : ""}`}
                                    style={{
                                        padding: "10px 10px",
                                        borderRadius: 10,
                                        border: `2px solid ${palette === p.id ? p.swatch : "var(--border-default)"}`,
                                        background: palette === p.id ? "var(--bg-subtle)" : "transparent",
                                        cursor: "pointer",
                                        display: "flex", alignItems: "center", gap: 10,
                                        transition: "all 0.15s",
                                        textAlign: "left",
                                    }}
                                >
                                    <div
                                        aria-hidden="true"
                                        style={{
                                            width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                                            background: p.swatch,
                                            boxShadow: palette === p.id ? `0 0 0 3px ${p.swatch}30` : "none",
                                        }}
                                    />
                                    <div>
                                        <p style={{ margin: 0, fontSize: 12, fontWeight: palette === p.id ? 700 : 500, color: "var(--text-primary)", lineHeight: 1.2 }}>{p.label}</p>
                                        <p style={{ margin: 0, fontSize: 10, color: "var(--text-tertiary)", lineHeight: 1.3, marginTop: 1 }}>{p.description}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </Section>

                    {/* CUSTOM ? */}
                    <Section title="Columns">
                        <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: "0 0 12px" }}>
                            Add custom columns to your board. Default columns can be renamed but not deleted.
                        </p>
                        <ColumnManager
                            columns={columns}
                            onAdd={onAddColumn}
                            onRename={onRenameColumn}
                            onDelete={onDeleteColumn}
                        />
                    </Section>

                    {/* DATA: IMPORT/EXPORT */}
                    <Section title="Your data">
                        <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: "0 0 12px", lineHeight: 1.6 }}>
                            All your data is stored locally in your browser. Export a JSON backup to keep it safe.
                            Re-import at any time to restore everything.
                        </p>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button onClick={onExport} style={btnStyle("outline")} aria-label="Download data backup as JSON">
                                Export backup
                            </button>
                            <button onClick={onImport} style={btnStyle("outline")} aria-label="Import data from backup file">
                                Import backup
                            </button>
                        </div>
                    </Section>

                    {/* ABOUT SPROUT SECTION */}
                    <Section title="About Sprout">
                        <p style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.7, margin: 0 }}>
                            Sprout is a private, local-first job and application tracking board.
                            No account required. Your data never leaves your device unless you choose to export it.
                            Built for everyone - any role, any industry, any stage of your journey.
                        </p>
                    </Section>
                </div>
            </div>
        </div>
    );
}


function Section({ title, children }) {
    return (
        <section aria-label={title}>
            <h3 style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {title}
            </h3>
            {children}
        </section>
    );
}


function ColumnManager({ columns, onAdd, onRename, onDelete }) {
    const [newLabel, setNewLabel] = useState("");
    const [editingId, setEditingId] = useState(null);
    const [editLabel, setEditLabel] = useState("");

    const startEdit = (col) => { setEditingId(col.id); setEditLabel(col.label); };
    const saveEdit = () => {
        if (editLabel.trim()) onRename(editingId, editLabel.trim());
        setEditingId(null);
    };

    const addCol = () => {
        const trimmed = newLabel.trim();
        if (trimmed) { onAdd(trimmed); setNewLabel(""); }
    };

    return (
        <div>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                {columns.map((col) => (
                    <li
                        key={col.id}
                        style={{
                            display: "flex", alignItems: "center", gap: 8,
                            padding: "8px 10px",
                            background: "var(--bg-subtle)",
                            borderRadius: 8,
                            border: "1px solid var(--border-subtle)",
                        }}
                    >
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: col.color, flexShrink: 0 }} aria-hidden="true" />
                        {editingId === col.id ? (
                            <>
                                <input
                                    value={editLabel}
                                    onChange={(e) => setEditLabel(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditingId(null); }}
                                    autoFocus
                                    aria-label={`Rename column ${col.label}`}
                                    style={{ flex: 1, fontSize: 13, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--accent)", background: "var(--bg-surface)", color: "var(--text-primary)", outline: "none" }}
                                />
                                <button onClick={saveEdit} style={{ ...btnStyle("primary"), padding: "4px 10px", fontSize: 12 }} aria-label="Save column name">Save</button>
                                <button onClick={() => setEditingId(null)} style={{ ...btnStyle("ghost"), padding: "4px 8px", fontSize: 12 }} aria-label="Cancel rename">Cancel</button>
                            </>
                        ) : (
                            <>
                                <span style={{ flex: 1, fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{col.label}</span>
                                <button
                                    onClick={() => startEdit(col)}
                                    style={{ ...btnStyle("ghost"), padding: "3px 8px", fontSize: 11 }}
                                    aria-label={`Rename ${col.label} column`}
                                >
                                    Rename
                                </button>
                                {!col.locked && (
                                    <button
                                        onClick={() => {
                                            if (window.confirm(`Delete "${col.label}"? Jobs in this column will move to Watchlist.`)) {
                                                onDelete(col.id);
                                            }
                                        }}
                                        style={{ ...btnStyle("ghost"), padding: "3px 8px", fontSize: 11, color: "var(--danger)" }}
                                        aria-label={`Delete ${col.label} column`}
                                    >
                                        Delete
                                    </button>
                                )}
                                {col.locked && (
                                    <span style={{ fontSize: 10, color: "var(--text-tertiary)", padding: "3px 6px" }}>default</span>
                                )}
                            </>
                        )}
                    </li>
                ))}
            </ul>

            {/* add column (eg. Watchlist, Applied, etc.) */}
            <div style={{ display: "flex", gap: 8 }}>
                <input
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") addCol(); }}
                    placeholder="New column name…"
                    aria-label="New column name"
                    style={{ flex: 1, fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border-default)", background: "var(--bg-subtle)", color: "var(--text-primary)", outline: "none" }}
                />
                <button
                    onClick={addCol}
                    disabled={!newLabel.trim()}
                    style={{ ...btnStyle("primary"), opacity: newLabel.trim() ? 1 : 0.5 }}
                    aria-label="Add new column"
                >
                    Add
                </button>
            </div>
        </div>
    );
}