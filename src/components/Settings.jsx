import { useState, useRef, useEffect } from "react";
import { PALETTES, btnStyle } from "../store.js";

const DOT_PRESETS = [
    "#ef4444","#f97316","#eab308","#22c55e","#10b981",
    "#06b6d4","#3b82f6","#6366f1","#8b5cf6","#ec4899",
    "#94a3b8","#78716c","#1d4ed8","#065f46","#9d174d",
];

export default function Settings({
    palette, theme, columns,
    onPaletteChange, onThemeChange,
    onAddColumn, onRenameColumn, onDeleteColumn, onReorderColumns,
    onUpdateColumnColor,
    onClose, onExport, onImport,
}) {
    const panelRef = useRef();

    useEffect(() => {
        const handler = e => {
            if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [onClose]);

    return (
        <div
            style={{ position: "fixed", inset: 0, zIndex: 150, display: "flex", justifyContent: "flex-end" }}
            role="dialog"
            aria-modal="true"
            aria-label="Settings"
        >
            <div
                onClick={onClose}
                style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.2)" }}
                aria-hidden="true"
            />
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
                <div style={{
                    padding: "14px 20px",
                    borderBottom: "1px solid var(--border-default)",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    flexShrink: 0,
                }}>
                    <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Settings</h2>
                    <button onClick={onClose} style={{ ...btnStyle("ghost"), fontSize: 20, padding: "2px 8px" }} aria-label="Close settings">×</button>
                </div>

                <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 28 }}>

                    {/* LIGHT/DARK */}
                    <Section title="Appearance">
                        <div style={{ display: "flex", gap: 8 }}>
                            {["light", "dark"].map(t => (
                                <button
                                    key={t}
                                    onClick={() => onThemeChange(t)}
                                    aria-pressed={theme === t}
                                    style={{
                                        flex: 1, padding: "8px", borderRadius: 8, cursor: "pointer",
                                        border: `2px solid ${theme === t ? "var(--accent)" : "var(--border-default)"}`,
                                        background: theme === t ? "var(--accent-light)" : "transparent",
                                        color: theme === t ? "var(--accent-text)" : "var(--text-secondary)",
                                        fontWeight: theme === t ? 700 : 400, fontSize: 13,
                                        transition: "all 0.12s",
                                        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                                        fontFamily: "var(--font-sans)",
                                    }}
                                >
                                    <span aria-hidden="true">{t === "light" ? "☀︎" : "☽"}</span>
                                    {t.charAt(0).toUpperCase() + t.slice(1)}
                                </button>
                            ))}
                        </div>
                    </Section>

                    {/* COLOR PALETTES */}
                    <Section title="Color palette">
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                            {PALETTES.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => onPaletteChange(p.id)}
                                    aria-pressed={palette === p.id}
                                    aria-label={`${p.label} palette${p.description ? " — " + p.description : ""}${palette === p.id ? ", selected" : ""}`}
                                    style={{
                                        padding: "10px",
                                        borderRadius: 10,
                                        border: `2px solid ${palette === p.id ? p.swatch : "var(--border-default)"}`,
                                        background: palette === p.id ? "var(--bg-subtle)" : "transparent",
                                        cursor: "pointer",
                                        display: "flex", alignItems: "center", gap: 10,
                                        transition: "all 0.15s", textAlign: "left",
                                        fontFamily: "var(--font-sans)",
                                    }}
                                >
                                    <div
                                        aria-hidden="true"
                                        style={{
                                            width: 15, height: 15, borderRadius: "50%", flexShrink: 0,
                                            background: p.swatch,
                                            boxShadow: palette === p.id ? `0 0 0 3px ${p.swatch}30` : "none",
                                        }}
                                    />
                                    <div>
                                        <p style={{ margin: 0, fontSize: 12, fontWeight: palette === p.id ? 700 : 500, color: "var(--text-primary)", lineHeight: 1.2 }}>{p.label}</p>
                                        {p.description && <p style={{ margin: 0, fontSize: 10, color: "var(--text-tertiary)", lineHeight: 1.3, marginTop: 1 }}>{p.description}</p>}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </Section>

                    {/* KANBAN BOARD COLUMNS */}
                    <Section title="Columns">
                        <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: "0 0 12px", lineHeight: 1.5 }}>
                            Drag to reorder. Click the dot to change its color. Default columns can be renamed but not deleted.
                        </p>
                        <ColumnManager
                            columns={columns}
                            onAdd={onAddColumn}
                            onRename={onRenameColumn}
                            onDelete={onDeleteColumn}
                            onReorder={onReorderColumns}
                            onUpdateColor={onUpdateColumnColor}
                        />
                    </Section>

                    {/* AI AUTOFILL KEYS */}
                    <Section title="AI autofill">
                        <ApiKeyManager />
                    </Section>

                    {/* DATA NOTICE */}
                    <Section title="Your data">
                        <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: "0 0 12px", lineHeight: 1.6 }}>
                            All your data is stored locally in your browser. Export a JSON backup to keep it safe across devices. Re-import at any time to restore everything.
                        </p>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button onClick={onExport} style={btnStyle("outline")} aria-label="Export data backup">Export backup</button>
                            <button onClick={onImport} style={btnStyle("outline")} aria-label="Import data from backup">Import backup</button>
                        </div>
                    </Section>

                    {/* ABOUT */}
                    <Section title="About Sprout">
                        <p style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.7, margin: 0 }}>
                            Sprout is a private, local-first job and application tracking board.
                            No account required. Your data never leaves your device.
                            Built for everyone — any role, any industry, any stage of your journey.
                        </p>
                    </Section>

                </div>
            </div>
        </div>
    );
}


// 
function Section({ title, children }) {
    return (
        <section aria-label={title}>
            <h3 style={{
                margin: "0 0 12px",
                fontSize: 11, fontWeight: 700,
                color: "var(--text-tertiary)",
                textTransform: "uppercase", letterSpacing: "0.06em",
            }}>
                {title}
            </h3>
            {children}
        </section>
    );
}


//  API key MANAGER 
function ApiKeyManager() {
    const [orKey,     setOrKey]     = useState(() => localStorage.getItem("sprout_or_key")      ?? "");
    const [gemKey,    setGemKey]    = useState(() => localStorage.getItem("sprout_gemini_key")  ?? "");
    const [showOr,    setShowOr]    = useState(false);
    const [showGem,   setShowGem]   = useState(false);
    const [saved,     setSaved]     = useState(false);

    const save = () => {
        if (orKey.trim())  localStorage.setItem("sprout_or_key", orKey.trim());
        else               localStorage.removeItem("sprout_or_key");
        if (gemKey.trim()) localStorage.setItem("sprout_gemini_key", gemKey.trim());
        else               localStorage.removeItem("sprout_gemini_key");
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const clearOr  = () => { setOrKey("");  localStorage.removeItem("sprout_or_key"); };
    const clearGem = () => { setGemKey(""); localStorage.removeItem("sprout_gemini_key"); };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <p style={{ margin: 0, fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.6 }}>
                Sprout can use AI to extract job details from URLs or pasted text.
                Add a free API key below to enable this.
            </p>

            {/* OpenRouter */}
            <KeyField
                id="settings-or-key"
                label="OpenRouter key"
                badge="Recommended — 200 req/day free"
                placeholder="sk-or-v1-…"
                helpUrl="https://openrouter.ai/keys"
                helpLabel="openrouter.ai/keys"
                value={orKey}
                show={showOr}
                onChange={setOrKey}
                onToggleShow={() => setShowOr(v => !v)}
                onClear={clearOr}
            />

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, height: 1, background: "var(--border-subtle)" }} />
                <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>or</span>
                <div style={{ flex: 1, height: 1, background: "var(--border-subtle)" }} />
            </div>

            {/* Gemini */}
            <KeyField
                id="settings-gem-key"
                label="Gemini key"
                badge="Fallback — 20 req/day free"
                placeholder="AIza…"
                helpUrl="https://aistudio.google.com/apikey"
                helpLabel="aistudio.google.com"
                value={gemKey}
                show={showGem}
                onChange={setGemKey}
                onToggleShow={() => setShowGem(v => !v)}
                onClear={clearGem}
            />

            {/* SAVE */}
            <button
                onClick={save}
                style={{ ...btnStyle("primary"), width: "100%", justifyContent: "center" }}
                aria-label="Save API keys"
            >
                {saved ? "✓ Saved" : "Save keys"}
            </button>

            {/* SECURITY NOTICE */}
            <div style={{
                padding: "10px 12px",
                borderRadius: 8,
                background: "var(--bg-subtle)",
                border: "1px solid var(--border-subtle)",
                fontSize: 12,
                color: "var(--text-tertiary)",
                lineHeight: 1.6,
            }}>
                <strong style={{ color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>🔒 Security & privacy</strong>
                Your keys are stored only in <strong>this browser's localStorage</strong> — never on any server.
                They are sent only to OpenRouter or Google when you click "Autofill".{" "}
                <strong>We recommend using a free-tier key with no credits attached</strong>, or rotating your key regularly.
                If you share this device, clear your keys here before others use it.
            </div>
        </div>
    );
}


// key field
function KeyField({ id, label, badge, placeholder, helpUrl, helpLabel, value, show, onChange, onToggleShow, onClear }) {
    const hasValue = !!value.trim();
    return (
        <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <label htmlFor={id} style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", fontFamily: "var(--font-sans)" }}>
                    {label}
                </label>
                {/* <span style={{
                    fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 99,
                    background: hasValue ? "var(--success-bg)" : "var(--bg-subtle)",
                    color: hasValue ? "var(--success)" : "var(--text-tertiary)",
                    border: `1px solid ${hasValue ? "var(--success)" : "var(--border-subtle)"}`,
                }}>
                    {hasValue ? "✓ key saved" : badge}
                </span> */}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
                <input
                    id={id}
                    type={show ? "text" : "password"}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder={placeholder}
                    aria-label={label}
                    style={{
                        flex: 1, fontSize: 12, padding: "7px 10px",
                        borderRadius: 8, border: "1px solid var(--border-default)",
                        background: "var(--bg-subtle)", color: "var(--text-primary)",
                        outline: "none", fontFamily: "var(--font-mono)",
                    }}
                />
                <button
                    type="button"
                    onClick={onToggleShow}
                    style={{ ...btnStyle("outline"), padding: "6px 10px", fontSize: 11, flexShrink: 0 }}
                    aria-label={show ? `Hide ${label}` : `Show ${label}`}
                >
                    {show ? "Hide" : "Show"}
                </button>
                {hasValue && (
                    <button
                        type="button"
                        onClick={onClear}
                        style={{ ...btnStyle("ghost"), padding: "6px 10px", fontSize: 11, color: "var(--danger)", flexShrink: 0 }}
                        aria-label={`Clear ${label}`}
                    >
                        Clear
                    </button>
                )}
            </div>
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--text-tertiary)", lineHeight: 1.5 }}>
                Free at{" "}
                <a href={helpUrl} target="_blank" rel="noopener noreferrer">{helpLabel}</a>
                {" "}— no credit card required.
            </p>
        </div>
    );
}


// columns manager
function ColumnManager({ columns, onAdd, onRename, onDelete, onReorder, onUpdateColor }) {
    const [newLabel,    setNewLabel]    = useState("");
    const [editingId,   setEditingId]   = useState(null);
    const [editLabel,   setEditLabel]   = useState("");
    const [colorPickId, setColorPickId] = useState(null);
    const [dragOver,    setDragOver]    = useState(null);
    const [dragId,      setDragId]      = useState(null);

    const startEdit = col => { setEditingId(col.id); setEditLabel(col.label); };
    const saveEdit  = () => { if (editLabel.trim()) onRename(editingId, editLabel.trim()); setEditingId(null); };
    const addCol    = () => { const t = newLabel.trim(); if (t) { onAdd(t); setNewLabel(""); } };

    const handleDragStart = (e, id) => { setDragId(id); e.dataTransfer.effectAllowed = "move"; };
    const handleDragOver  = (e, id) => { e.preventDefault(); setDragOver(id); };
    const handleDrop      = (e, id) => {
        e.preventDefault();
        if (!dragId || dragId === id) { setDragId(null); setDragOver(null); return; }
        const from = columns.findIndex(c => c.id === dragId);
        const to   = columns.findIndex(c => c.id === id);
        if (from !== -1 && to !== -1) {
            const next = [...columns];
            const [moved] = next.splice(from, 1);
            next.splice(to, 0, moved);
            onReorder(next);
        }
        setDragId(null); setDragOver(null);
    };
    const handleDragEnd = () => { setDragId(null); setDragOver(null); };

    return (
        <div>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                {columns.map(col => (
                    <li
                        key={col.id}
                        draggable
                        onDragStart={e => handleDragStart(e, col.id)}
                        onDragOver={e => handleDragOver(e, col.id)}
                        onDrop={e => handleDrop(e, col.id)}
                        onDragEnd={handleDragEnd}
                        style={{
                            display: "flex", alignItems: "center", gap: 8,
                            padding: "8px 10px",
                            background: dragOver === col.id ? "var(--accent-light)" : "var(--bg-subtle)",
                            borderRadius: 8,
                            border: `1px solid ${dragOver === col.id ? "var(--accent)" : "var(--border-subtle)"}`,
                            cursor: "grab", transition: "background 0.1s, border-color 0.1s",
                            opacity: dragId === col.id ? 0.4 : 1,
                        }}
                    >
                        <span aria-hidden="true" style={{ color: "var(--text-tertiary)", fontSize: 12, cursor: "grab", userSelect: "none", flexShrink: 0 }}>⠿</span>

                        {/* COLOR DOT PICKER */}
                        <div style={{ position: "relative", flexShrink: 0 }}>
                            <button
                                onClick={() => setColorPickId(colorPickId === col.id ? null : col.id)}
                                aria-label={`Change color for ${col.label} column`}
                                title="Change column color"
                                style={{ width: 14, height: 14, borderRadius: "50%", background: col.color, border: "2px solid var(--border-default)", cursor: "pointer", padding: 0 }}
                            />
                            {colorPickId === col.id && (
                                <div style={{
                                    position: "absolute", top: 20, left: 0, zIndex: 300,
                                    background: "var(--bg-raised)", border: "1px solid var(--border-default)",
                                    borderRadius: 10, boxShadow: "var(--shadow-lg)",
                                    padding: 10, display: "flex", flexWrap: "wrap", gap: 6, width: 168,
                                }}>
                                    {DOT_PRESETS.map(hex => (
                                        <button
                                            key={hex}
                                            onClick={() => { onUpdateColor(col.id, hex); setColorPickId(null); }}
                                            aria-label={`Set color ${hex}`}
                                            style={{
                                                width: 20, height: 20, borderRadius: "50%", background: hex,
                                                border: col.color === hex ? "3px solid var(--text-primary)" : "2px solid transparent",
                                                cursor: "pointer", padding: 0, transition: "transform 0.1s",
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.transform = "scale(1.2)"}
                                            onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
                                        />
                                    ))}
                                    <input
                                        type="color"
                                        defaultValue={col.color?.startsWith("#") ? col.color : "#8b5cf6"}
                                        onChange={e => onUpdateColor(col.id, e.target.value)}
                                        aria-label="Custom color"
                                        title="Custom color"
                                        style={{ width: 20, height: 20, borderRadius: "50%", border: "none", padding: 0, cursor: "pointer", background: "none" }}
                                    />
                                </div>
                            )}
                        </div>

                        {editingId === col.id ? (
                            <>
                                <input
                                    value={editLabel}
                                    onChange={e => setEditLabel(e.target.value)}
                                    onKeyDown={e => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditingId(null); }}
                                    autoFocus
                                    aria-label={`Rename column ${col.label}`}
                                    style={{ flex: 1, fontSize: 13, padding: "4px 8px", width: "125px", borderRadius: 6, border: "1px solid var(--accent)", background: "var(--bg-surface)", color: "var(--text-primary)", outline: "none", fontFamily: "var(--font-sans)" }}
                                />
                                <button onClick={saveEdit} style={{ ...btnStyle("primary"), padding: "4px 10px", fontSize: 11 }}>Save</button>
                                <button onClick={() => setEditingId(null)} style={{ ...btnStyle("ghost"), padding: "4px 8px", fontSize: 11 }}>Cancel</button>
                            </>
                        ) : (
                            <>
                                <span style={{ flex: 1, fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{col.label}</span>
                                <button onClick={() => startEdit(col)} style={{ ...btnStyle("ghost"), padding: "3px 8px", fontSize: 11 }} aria-label={`Rename ${col.label}`}>Rename</button>
                                {!col.locked
                                    ? <button
                                        onClick={() => { if (window.confirm(`Delete "${col.label}"? Jobs will move to Watchlist.`)) onDelete(col.id); }}
                                        style={{ ...btnStyle("ghost"), padding: "3px 8px", fontSize: 11, color: "var(--danger)" }}
                                        aria-label={`Delete ${col.label}`}
                                      >Delete</button>
                                    : <span style={{ fontSize: 11, color: "var(--text-tertiary)", padding: "3px 6px" }}>default</span>
                                }
                            </>
                        )}
                    </li>
                ))}
            </ul>

            {/* ADD COLUMN */}
            <div style={{ display: "flex", gap: 8 }}>
                <input
                    value={newLabel}
                    onChange={e => setNewLabel(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") addCol(); }}
                    placeholder="New column name…"
                    aria-label="New column name"
                    style={{ flex: 1, fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border-default)", background: "var(--bg-subtle)", color: "var(--text-primary)", outline: "none", fontFamily: "var(--font-sans)" }}
                />
                <button
                    onClick={addCol}
                    disabled={!newLabel.trim()}
                    style={{ ...btnStyle("primary"), opacity: newLabel.trim() ? 1 : 0.5 }}
                    aria-label="Add column"
                >
                    Add
                </button>
            </div>
        </div>
    );
}