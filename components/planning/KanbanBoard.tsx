"use client";
// components/planning/KanbanBoard.tsx — Kanban-Ansicht der Features eines Epics
// Spalten nach Status, mit nativem HTML5 Drag & Drop zum Verschieben zwischen Spalten.

import { useState, useRef } from "react";
import { FeatureModal } from "./modals/FeatureModal";
import type { PlanningFeature, TicketStatus } from "@/types/planning";

// ─── Konstanten ───────────────────────────────────────────────────────────────

const COLUMNS: {
  status: TicketStatus;
  label: string;
  dot: string;
  bg: string;
  border: string;
  dragOver: string;
}[] = [
  {
    status: "BACKLOG",
    label: "Backlog",
    dot: "bg-zinc-400",
    bg: "bg-zinc-900/40",
    border: "border-zinc-800",
    dragOver: "border-zinc-500 bg-zinc-800/60",
  },
  {
    status: "TODO",
    label: "Todo",
    dot: "bg-blue-400",
    bg: "bg-blue-950/20",
    border: "border-blue-900/60",
    dragOver: "border-blue-500 bg-blue-950/40",
  },
  {
    status: "IN_PROGRESS",
    label: "In Progress",
    dot: "bg-amber-400",
    bg: "bg-amber-950/20",
    border: "border-amber-900/60",
    dragOver: "border-amber-500 bg-amber-950/40",
  },
  {
    status: "IN_REVIEW",
    label: "In Review",
    dot: "bg-violet-400",
    bg: "bg-violet-950/20",
    border: "border-violet-900/60",
    dragOver: "border-violet-500 bg-violet-950/40",
  },
  {
    status: "DONE",
    label: "Done",
    dot: "bg-emerald-500",
    bg: "bg-emerald-950/20",
    border: "border-emerald-900/60",
    dragOver: "border-emerald-500 bg-emerald-950/40",
  },
  {
    status: "CANCELLED",
    label: "Cancelled",
    dot: "bg-red-400",
    bg: "bg-red-950/20",
    border: "border-red-900/60",
    dragOver: "border-red-500 bg-red-950/40",
  },
];

// ─── Feature Card ─────────────────────────────────────────────────────────────

interface KanbanCardProps {
  feature: PlanningFeature;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent, feature: PlanningFeature) => void;
  onDragEnd: () => void;
  onClick: () => void;
}

function KanbanCard({
  feature,
  isDragging,
  onDragStart,
  onDragEnd,
  onClick,
}: KanbanCardProps) {
  const taskCount = feature.tasks.length;
  const doneCount = feature.tasks.filter((t) => t.status === "DONE").length;
  const isAgent =
    feature.assignee?.toLowerCase().includes("agent") ||
    feature.assignee?.startsWith("@");

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, feature)}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`
        px-3 py-3 rounded-lg cursor-grab active:cursor-grabbing
        bg-white dark:bg-zinc-900
        border border-[0.5px] border-zinc-200 dark:border-zinc-800
        shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-md
        transition-all duration-100 select-none
        ${isDragging ? "opacity-40 scale-[0.98]" : ""}
      `}
    >
      {/* Title */}
      <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100 leading-snug line-clamp-2">
        {feature.title}
      </p>

      {/* Description */}
      {feature.description && (
        <p className="mt-1 text-[11px] text-zinc-500 leading-relaxed line-clamp-2">
          {feature.description}
        </p>
      )}

      {/* Footer */}
      <div className="mt-2.5 flex items-center gap-2 flex-wrap">
        {taskCount > 0 && (
          <span className="flex items-center gap-1 text-[10px] text-zinc-400 dark:text-zinc-500">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            {doneCount}/{taskCount}
          </span>
        )}

        {feature.assignee && (
          <span className={`
            text-[10px] font-medium px-1.5 py-0.5 rounded border border-[0.5px]
            ${isAgent
              ? "bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800"
              : "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800"
            }
          `}>
            {isAgent ? "⚡ " : "👤 "}
            {feature.assignee}
          </span>
        )}

        {feature.diffRef && (
          <span className="ml-auto font-mono text-[10px] text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-[0.5px] border-zinc-200 dark:border-zinc-700">
            {feature.diffRef.slice(0, 7)}
          </span>
        )}
      </div>

      {taskCount > 0 && (
        <div className="mt-2 h-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all"
            style={{ width: `${Math.round((doneCount / taskCount) * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Kanban-Spalte ────────────────────────────────────────────────────────────

interface KanbanColumnProps {
  status: TicketStatus;
  label: string;
  dot: string;
  bg: string;
  border: string;
  dragOverClass: string;
  features: PlanningFeature[];
  isDragTarget: boolean;
  draggingId: string | null;
  onDragOver: (e: React.DragEvent, status: TicketStatus) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, status: TicketStatus) => void;
  onDragStart: (e: React.DragEvent, feature: PlanningFeature) => void;
  onDragEnd: () => void;
  onCardClick: (feature: PlanningFeature) => void;
  onAddClick: () => void;
}

function KanbanColumn({
  status,
  label,
  dot,
  bg,
  border,
  dragOverClass,
  features,
  isDragTarget,
  draggingId,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragStart,
  onDragEnd,
  onCardClick,
  onAddClick,
}: KanbanColumnProps) {
  return (
    <div className="flex flex-col w-64 shrink-0">
      {/* Header */}
      <div className="flex items-center gap-2 px-1 mb-3">
        <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
        <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
          {label}
        </span>
        <span className="ml-auto text-[10px] text-zinc-400 dark:text-zinc-600 font-medium tabular-nums">
          {features.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => onDragOver(e, status)}
        onDragLeave={onDragLeave}
        onDrop={(e) => onDrop(e, status)}
        className={`
          flex-1 rounded-xl p-2 space-y-2 min-h-[120px]
          border border-[0.5px] transition-colors duration-100
          ${isDragTarget ? dragOverClass : `${border} ${bg}`}
        `}
      >
        {features.map((feature) => (
          <KanbanCard
            key={feature.id}
            feature={feature}
            isDragging={draggingId === feature.id}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onClick={() => onCardClick(feature)}
          />
        ))}

        <button
          onClick={onAddClick}
          className="w-full flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] text-zinc-500 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Feature hinzufügen
        </button>
      </div>
    </div>
  );
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

interface KanbanBoardProps {
  features: PlanningFeature[];
  projectId: string;
  epicId: string;
  onMutated: () => void;
}

export function KanbanBoard({
  features,
  projectId,
  epicId,
  onMutated,
}: KanbanBoardProps) {
  const [featureModalOpen, setFeatureModalOpen] = useState(false);
  const [editingFeature, setEditingFeature] = useState<PlanningFeature | undefined>(undefined);
  const [preselectedStatus, setPreselectedStatus] = useState<TicketStatus | undefined>(undefined);

  // Drag & Drop state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragTargetStatus, setDragTargetStatus] = useState<TicketStatus | null>(null);
  const draggingFeatureRef = useRef<PlanningFeature | null>(null);

  function openEdit(feature: PlanningFeature) {
    setEditingFeature(feature);
    setPreselectedStatus(undefined);
    setFeatureModalOpen(true);
  }

  function openCreate(status: TicketStatus) {
    setEditingFeature(undefined);
    setPreselectedStatus(status);
    setFeatureModalOpen(true);
  }

  function handleClose() {
    setFeatureModalOpen(false);
    setEditingFeature(undefined);
    setPreselectedStatus(undefined);
  }

  // ── Drag handlers ──────────────────────────────────────────────────────────

  function handleDragStart(e: React.DragEvent, feature: PlanningFeature) {
    draggingFeatureRef.current = feature;
    setDraggingId(feature.id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", feature.id);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDragTargetStatus(null);
    draggingFeatureRef.current = null;
  }

  function handleDragOver(e: React.DragEvent, status: TicketStatus) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragTargetStatus(status);
  }

  function handleDragLeave() {
    setDragTargetStatus(null);
  }

  async function handleDrop(e: React.DragEvent, newStatus: TicketStatus) {
    e.preventDefault();
    setDragTargetStatus(null);

    const feature = draggingFeatureRef.current;
    if (!feature || feature.status === newStatus) {
      setDraggingId(null);
      draggingFeatureRef.current = null;
      return;
    }

    setDraggingId(null);
    draggingFeatureRef.current = null;

    try {
      const res = await fetch(
        `/api/projects/${projectId}/epics/${epicId}/features/${feature.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        }
      );
      if (!res.ok) throw new Error(`Fehler ${res.status}`);
      onMutated();
    } catch {
      // Bei Fehler trotzdem refreshen — zeigt den alten Zustand
      onMutated();
    }
  }

  // ── Spalten befüllen ───────────────────────────────────────────────────────

  const byStatus = new Map<TicketStatus, PlanningFeature[]>(
    COLUMNS.map((col) => [col.status, []])
  );
  for (const feature of features) {
    byStatus.get(feature.status)?.push(feature);
  }

  return (
    <>
      <div className="h-full overflow-x-auto">
        <div className="flex gap-4 p-6 h-full items-start min-w-max">
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col.status}
              status={col.status}
              label={col.label}
              dot={col.dot}
              bg={col.bg}
              border={col.border}
              dragOverClass={col.dragOver}
              features={byStatus.get(col.status) ?? []}
              isDragTarget={dragTargetStatus === col.status}
              draggingId={draggingId}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onCardClick={openEdit}
              onAddClick={() => openCreate(col.status)}
            />
          ))}
        </div>
      </div>

      <FeatureModal
        isOpen={featureModalOpen}
        onClose={handleClose}
        projectId={projectId}
        epicId={epicId}
        feature={editingFeature}
        preselectedStatus={preselectedStatus}
        onSuccess={() => {
          handleClose();
          onMutated();
        }}
      />
    </>
  );
}
