import { useState } from "react";
import {
    DndContext, DragOverlay, PointerSensor, KeyboardSensor,
    useSensor, useSensors, closestCorners,
} from "@dnd-kit/core";
import {
    SortableContext, verticalListSortingStrategy,
    useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { getInitials, fmtDateShort, INTERVIEW_STAGES } from "../store.js";
import { groupJobs } from "./FilterBar.jsx";


// ======= INTERVIEW STAGES =====================================================
const STAGE_COLORS = {
    "Phone Screen":    { bg: "#f0f0f0", color: "#555", dot: "#888" },
    "Recruiter Call":  { bg: "#f0f0f0", color: "#555", dot: "#888" },
    "Hiring Manager":  { bg: "#fdf3e3", color: "#a05a10", dot: "#d97706" },
    "Technical Screen":{ bg: "#eff6ff", color: "#1d4ed8", dot: "#3b82f6" },
    "Take-Home":       { bg: "#fdf4ff", color: "#7e22ce", dot: "#a855f7" },
    "Panel":           { bg: "#f0fdf4", color: "#15803d", dot: "#22c55e" },
    "Final Round":     { bg: "#fff7ed", color: "#c2410c", dot: "#f97316" },
    "Reference Check": { bg: "#f0f9ff", color: "#0369a1", dot: "#0ea5e9" },
};

// ============= KANBAN BOARD ====================================================================
export default function Board({ jobs, columns, groupBy, onAddJob, onOpenJob, onMoveJob, onReorderJobs, allJobs }) {
    const [activeJob, setActiveJob] = useState(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor)
    );

  // when grouping by non-status, show read-only grouped columns
    const isStatusGrouped = !groupBy || groupBy === "status";
    const groups = isStatusGrouped
        ? columns.map(col => ({ key: col.id, label: col.label, col, jobs: jobs.filter(j => j.column === col.id) }))
        : groupJobs(jobs, groupBy, columns);

    const handleDragStart = ({ active }) => {
        setActiveJob(allJobs.find((j) => j.id === active.id) ?? null);
    };

    const handleDragEnd = ({ active, over }) => {
        setActiveJob(null);
        if (!over || !isStatusGrouped) return;
        const activeJob = allJobs.find((j) => j.id === active.id);
        if (!activeJob) return;
        if (columns.find((c) => c.id === over.id)) {
            if (activeJob.column !== over.id) onMoveJob(activeJob.id, over.id);
            return;
        }
        const overJob = allJobs.find((j) => j.id === over.id);
        if (!overJob) return;
        if (activeJob.column !== overJob.column) {
            onMoveJob(activeJob.id, overJob.column);
        } else {
            const colJobs = allJobs.filter((j) => j.column === activeJob.column);
            const oldIdx = colJobs.findIndex((j) => j.id === activeJob.id);
            const newIdx = colJobs.findIndex((j) => j.id === overJob.id);
            if (oldIdx !== newIdx) {
                const reordered = arrayMove(colJobs, oldIdx, newIdx);
                onReorderJobs([...allJobs.filter((j) => j.column !== activeJob.column), ...reordered]);
            }
        }
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div
                role="region"
                aria-label="Job tracking board"
                style={{
                    display: "flex",
                    gap: 12,
                    padding: "16px 20px 24px",
                    overflowX: "auto",
                    flex: 1,
                    alignItems: "flex-start",
                }}
            >
                {/* empty state */}
                {jobs.length === 0 && (
                    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)", fontSize: 14, padding: 40 }}>
                        No jobs match the current filters.
                    </div>
                )}

                {groups.map((group) => {
                    const col = group.col ?? columns.find(c => c.id === "watchlist");
                    return (
                        <Column
                            key={group.key}
                            col={col ?? { id: group.key, label: group.label, color: "var(--accent)", bg: "var(--accent-light)", textColor: "var(--accent-text)" }}
                            label={group.label}
                            jobs={group.jobs}
                            allCount={isStatusGrouped ? allJobs.filter(j => j.column === group.key).length : group.jobs.length}
                            onAddJob={isStatusGrouped ? () => onAddJob(group.key) : null}
                            onOpenJob={onOpenJob}
                            isDndEnabled={isStatusGrouped}
                        />
                    );
                })}
            </div>

            <DragOverlay>
                {activeJob ? (
                    <JobCard
                        job={activeJob}
                        col={columns.find((c) => c.id === activeJob.column)}
                        onOpen={() => {}}
                        isOverlay
                    />
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}

// ============== COLUMN GROUPS ======================================================
function Column({ col, label, jobs, allCount, onAddJob, onOpenJob, isDndEnabled }) {
    return (
        <section
            aria-label={`${col.label} column, ${allCount} jobs`}
            style={{
                    minWidth: 240,
                    width: 260,
                    flexShrink: 0,
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-default)",
                    borderRadius: 12,
                    display: "flex",
                    flexDirection: "column",
                    maxHeight: "calc(100vh - 120px)",
            }}
        >
            {/* columns header */}
            <div
                style={{
                    padding: "12px 12px 8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderBottom: "1px solid var(--border-subtle)",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div
                        aria-hidden="true"
                        style={{ width: 8, height: 8, borderRadius: "50%", background: col.color, flexShrink: 0 }}
                    />
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{label ?? col.label}</span>
                        <span
                            aria-label={`${allCount} jobs`}
                            style={{
                                fontSize: 11,
                                color: "var(--text-tertiary)",
                                background: "var(--bg-subtle)",
                                borderRadius: 10,
                                padding: "1px 7px",
                                border: "1px solid var(--border-subtle)",
                                fontWeight: 500,
                            }}
                        >
                            {allCount}
                        </span>
                    </div>
                    {onAddJob && (
                        <button
                            onClick={onAddJob}
                            aria-label={`Add job to ${label ?? col.label}`}
                            style={{
                                    width: 24, height: 24, borderRadius: 6,
                                    border: "1px solid var(--border-default)",
                                    background: "transparent",
                                    color: "var(--text-tertiary)",
                                    cursor: "pointer", fontSize: 16,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    lineHeight: 1, transition: "background 0.1s",
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
                            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                        >+</button>
                    )}
                </div>

                {/* kanban cards */}
                <div
                    style={{
                        padding: "8px",
                        flex: 1,
                        overflowY: "auto",
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                    }}
                >
                <SortableContext items={jobs.map((j) => j.id)} strategy={verticalListSortingStrategy}>
                    {jobs.map((job) => (
                        <SortableCard key={job.id} job={job} col={col} onOpen={onOpenJob} />
                    ))}
                </SortableContext>

                {jobs.length === 0 && (
                    <button
                        onClick={onAddJob}
                        aria-label={`Add first job to ${col.label}`}
                        style={{
                            border: "2px dashed var(--border-default)",
                            borderRadius: 10,
                            padding: "20px 12px",
                            textAlign: "center",
                            color: "var(--text-tertiary)",
                            fontSize: 12,
                            cursor: "pointer",
                            background: "transparent",
                            width: "100%",
                            transition: "border-color 0.15s, color 0.15s",
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = "var(--border-strong)";
                            e.currentTarget.style.color = "var(--text-secondary)";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = "var(--border-default)";
                            e.currentTarget.style.color = "var(--text-tertiary)";
                        }}
                    >
                        Add a job
                    </button>
                )}
            </div>
        </section>
    );
}

function SortableCard({ job, col, onOpen }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: job.id });
    return (
        <div
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
            {...attributes}
            {...listeners}
        >
            <JobCard job={job} col={col} onOpen={onOpen} />
        </div>
    );
}

// ======== KANBAN CARDS =========================================================================
function JobCard({ job, col, onOpen, isOverlay = false }) {
    const stage = job.column === "interviewing" && job.interviewStage ? job.interviewStage : null;
    const stageStyle = stage ? (STAGE_COLORS[stage] ?? STAGE_COLORS["Phone Screen"]) : null;
    const initials = getInitials(job.company);

    return (
        <article
            role="button"
            tabIndex={0}
            onClick={() => onOpen(job)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(job); } }}
            aria-label={`${job.company}, ${job.role}${job.location ? `, ${job.location}` : ""}. Press Enter to view details.`}
            style={{
                background: "var(--bg-raised)",
                border: `1px solid ${isOverlay ? "var(--accent)" : "var(--border-default)"}`,
                borderRadius: 10,
                padding: "11px 12px",
                cursor: "pointer",
                userSelect: "none",
                boxShadow: isOverlay ? "var(--shadow-lg)" : "var(--shadow-sm)",
                transition: "border-color 0.12s, box-shadow 0.12s",
                outline: "none",
            }}
            onMouseEnter={(e) => {
                if (!isOverlay) {
                    e.currentTarget.style.borderColor = "var(--border-strong)";
                    e.currentTarget.style.boxShadow = "var(--shadow-md)";
                }
            }}
            onMouseLeave={(e) => {
                if (!isOverlay) {
                    e.currentTarget.style.borderColor = "var(--border-default)";
                    e.currentTarget.style.boxShadow = "var(--shadow-sm)";
                }
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-default)"; }}
        >

            {/* top row */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 5 }}>
                <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: "var(--text-primary)", lineHeight: 1.3 }} className="truncate">
                        {job.company}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-secondary)" }} className="truncate">
                        {job.role}
                    </p>
                </div>
                {/* company initials -- can change to rand image? */}
                <div
                    aria-hidden="true"
                    style={{
                        width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                        background: col?.bg ?? "var(--bg-subtle)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontWeight: 700,
                        color: col?.color ?? "var(--text-secondary)",
                    }}
                >
                    {initials}
                </div>
            </div>

            {/* meta info */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 8px", marginBottom: 5 }}>
                {job.location && (
                    <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{job.location}</span>
                )}
                {job.workMode && (
                    <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{job.workMode}</span>
                )}
                {job.salary && (
                    <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 500 }}>{job.salary}</span>
                )}
            </div>

            {/* interview sub-stage badge */}
            {stage && (
                <div style={{ marginBottom: 5 }}>
                    <span
                        style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            fontSize: 10, fontWeight: 600, padding: "2px 8px",
                            borderRadius: 99,
                            background: stageStyle.bg,
                            color: stageStyle.color,
                        }}
                        aria-label={`Interview stage: ${stage}`}
                    >
                        <span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: "50%", background: stageStyle.dot, display: "inline-block" }} />
                        {stage}
                    </span>
                </div>
            )}

            {/* requirements chips */}
            {job.requirements?.length > 0 && (
                <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginBottom: 5 }} aria-label="Required documents">
                    {job.requirements.slice(0, 3).map((r) => (
                        <span
                            key={r}
                            title={r}
                            style={{
                                fontSize: 9, padding: "2px 6px",
                                borderRadius: 4,
                                background: "var(--bg-subtle)",
                                color: "var(--text-tertiary)",
                                border: "1px solid var(--border-subtle)",
                                maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            }}
                        >
                            {r.split("/")[0].trim()}
                        </span>
                    ))}
                    {job.requirements.length > 3 && (
                        <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: "var(--bg-subtle)", color: "var(--text-tertiary)", border: "1px solid var(--border-subtle)" }}>
                            +{job.requirements.length - 3}
                        </span>
                    )}
                </div>
            )}

            {/* tags */}
            {job.tags?.length > 0 && (
                <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginBottom: 4 }}>
                    {job.tags.slice(0, 3).map((t) => (
                        <span key={t} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 99, background: "var(--accent-light)", color: "var(--accent-text)", fontWeight: 500 }}>
                            {t}
                        </span>
                    ))}
                </div>
            )}

            {/* footer */}
            <p style={{ margin: "6px 0 0", fontSize: 10, color: "var(--text-tertiary)" }}>
                {fmtDateShort(job.createdAt)}
            </p>
        </article>
    );
}