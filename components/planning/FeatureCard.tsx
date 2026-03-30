"use client";
// components/planning/FeatureCard.tsx — Feature-Karte mit Tasks, Chips, Diff-Zeile

import { useState } from "react";
import { DiffModal } from "./DiffModal";
import { FeatureModal } from "./modals/FeatureModal";
import { TaskModal } from "./modals/TaskModal";
import { AgentBadge } from "./AgentBadge";
import type { DelegateStatus } from "./AgentBadge";
import type { PlanningFeature, PlanningTask, TicketStatus } from "@/types/planning";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const STATUS_DOT: Record<TicketStatus, string> = {
  BACKLOG: "bg-zinc-400",
  TODO: "bg-blue-400",
  IN_PROGRESS: "bg-amber-400",
  IN_REVIEW: "bg-violet-400",
  DONE: "bg-emerald-500",
  CANCELLED: "bg-red-400",
};

const STATUS_LABEL: Record<TicketStatus, string> = {
  BACKLOG: "Backlog",
  TODO: "Todo",
  IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review",
  DONE: "Done",
  CANCELLED: "Cancelled",
};

// ─── ICON HELPERS ─────────────────────────────────────────────────────────────

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828A2 2 0 0110 16.414H8v-2a2 2 0 01.586-1.414z" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4h6v3M3 7h18" />
    </svg>
  );
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortSha(sha: string | null): string {
  if (!sha) return "";
  return sha.slice(0, 7);
}

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────

function FileChip({
  path,
  variant,
}: {
  path: string;
  variant: "context" | "changed";
}) {
  const fileName = path.split("/").pop() ?? path;
  return (
    <span
      title={path}
      className={`
        font-mono text-xs rounded px-2 py-0.5 max-w-[180px] truncate inline-block
        ${
          variant === "changed"
            ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-[0.5px] border-emerald-200 dark:border-emerald-800"
            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-[0.5px] border-zinc-200 dark:border-zinc-700"
        }
      `}
    >
      {variant === "changed" && (
        <span className="mr-1 opacity-60">✎</span>
      )}
      {fileName}
    </span>
  );
}

function AssigneeBadge({ assignee }: { assignee: string | null }) {
  if (!assignee) return null;
  const isAgent = assignee.toLowerCase().includes("agent") || assignee.startsWith("@");
  return (
    <span
      className={`
        text-[10px] font-medium px-1.5 py-0.5 rounded-md border border-[0.5px]
        ${
          isAgent
            ? "bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800"
            : "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800"
        }
      `}
    >
      {isAgent ? "⚡ " : "👤 "}
      {assignee}
    </span>
  );
}

function CommitBadge({ sha }: { sha: string }) {
  return (
    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-[0.5px] border-zinc-200 dark:border-zinc-700">
      {shortSha(sha)}
    </span>
  );
}

// ─── TASK ROW ─────────────────────────────────────────────────────────────────

function LightningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

const STATUS_ORDER: TicketStatus[] = [
  "BACKLOG",
  "TODO",
  "IN_PROGRESS",
  "IN_REVIEW",
  "DONE",
  "CANCELLED",
];

function TaskRow({
  task,
  projectId,
  epicId,
  featureId,
  onEdit,
  onDeleted,
  onImplement,
  isImplementing,
  onStatusChanged,
}: {
  task: PlanningTask;
  projectId: string;
  epicId: string;
  featureId: string;
  onEdit: (task: PlanningTask) => void;
  onDeleted: () => void;
  onImplement?: () => void;
  isImplementing?: boolean;
  onStatusChanged?: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusChanging, setStatusChanging] = useState(false);

  async function handleStatusChange(e: React.MouseEvent, newStatus: TicketStatus) {
    e.stopPropagation();
    setStatusOpen(false);
    if (newStatus === task.status) return;
    setStatusChanging(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/epics/${epicId}/features/${featureId}/tasks/${task.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        }
      );
      if (!res.ok) throw new Error(`Fehler ${res.status}`);
      onStatusChanged?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Status-Änderung fehlgeschlagen");
    } finally {
      setStatusChanging(false);
    }
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Task "${task.title}" wirklich löschen?`)) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/epics/${epicId}/features/${featureId}/tasks/${task.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error(`Fehler ${res.status}`);
      onDeleted();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Löschen fehlgeschlagen");
      setDeleting(false);
    }
  }

  return (
    <div
      className={`flex items-start gap-2.5 py-1.5 px-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group ${
        deleting ? "opacity-40 pointer-events-none" : ""
      }`}
    >
      {/* Status dot — klickbar für Schnellwechsel */}
      <div className="relative shrink-0 mt-1">
        <button
          onClick={(e) => { e.stopPropagation(); setStatusOpen((p) => !p); }}
          disabled={statusChanging}
          title={`Status: ${STATUS_LABEL[task.status]} — klicken zum Ändern`}
          className={`w-3 h-3 rounded-full border-2 border-transparent hover:scale-125 hover:border-white/20 transition-transform ${
            statusChanging ? "animate-pulse" : ""
          } ${STATUS_DOT[task.status]}`}
        />
        {statusOpen && (
          <>
            {/* Backdrop zum Schließen */}
            <div
              className="fixed inset-0 z-40"
              onClick={(e) => { e.stopPropagation(); setStatusOpen(false); }}
            />
            <div className="absolute left-0 top-5 z-50 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl py-1 min-w-[140px]">
              {STATUS_ORDER.map((s) => (
                <button
                  key={s}
                  onClick={(e) => handleStatusChange(e, s)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-zinc-800 transition-colors text-left ${
                    s === task.status ? "text-white font-medium" : "text-zinc-400"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[s]}`} />
                  {STATUS_LABEL[s]}
                  {s === task.status && (
                    <svg className="ml-auto w-3 h-3 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-zinc-700 dark:text-zinc-300 leading-snug">
            {task.title}
          </span>
          {task.delegateId && (
            <AgentBadge
              agentId={task.delegateId}
              agentName={task.delegateId}
              status={task.delegateStatus as DelegateStatus | null}
              size="sm"
            />
          )}
          {task.assignee && (
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
              — {task.assignee}
            </span>
          )}
          {task.diffRef && (
            <CommitBadge sha={task.diffRef} />
          )}
          {task.prUrl && (
            <a
              href={task.prUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="Pull Request ansehen"
              className="text-[10px] text-violet-400 hover:text-violet-300 font-mono bg-violet-950/40 px-1.5 py-0.5 rounded border border-[0.5px] border-violet-800 transition-colors"
            >
              PR →
            </a>
          )}
        </div>
        {task.changedFiles.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {task.changedFiles.slice(0, 4).map((f) => (
              <FileChip key={f} path={f} variant="changed" />
            ))}
            {task.changedFiles.length > 4 && (
              <span className="text-[10px] text-zinc-400">
                +{task.changedFiles.length - 4}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Action buttons — visible on row hover */}
      <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5">
        {task.status === "TODO" && (
          <button
            onClick={(e) => { e.stopPropagation(); onImplement?.(); }}
            disabled={isImplementing}
            title="Mit Claude implementieren"
            className="w-5 h-5 flex items-center justify-center rounded text-zinc-400 hover:text-violet-400 hover:bg-zinc-700 disabled:opacity-40 transition-colors"
          >
            {isImplementing ? (
              <SpinnerIcon className="w-3 h-3 animate-spin" />
            ) : (
              <LightningIcon className="w-3 h-3" />
            )}
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(task); }}
          title="Bearbeiten"
          className="w-5 h-5 flex items-center justify-center rounded text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
        >
          <PencilIcon className="w-3 h-3" />
        </button>
        <button
          onClick={handleDelete}
          title="Löschen"
          className="w-5 h-5 flex items-center justify-center rounded text-zinc-400 hover:text-red-400 hover:bg-zinc-700 transition-colors"
        >
          <TrashIcon className="w-3 h-3" />
        </button>
      </span>
    </div>
  );
}

// ─── FEATURE CARD ────────────────────────────────────────────────────────────

interface FeatureCardProps {
  feature: PlanningFeature;
  projectId: string;
  epicId: string;
  onMutated: () => void;
}

export function FeatureCard({ feature, projectId, epicId, onMutated }: FeatureCardProps) {
  const [tasksExpanded, setTasksExpanded] = useState(false);
  const [diffOpen, setDiffOpen] = useState(false);
  const [featureModalOpen, setFeatureModalOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<PlanningTask | undefined>(undefined);
  const [deletingFeature, setDeletingFeature] = useState(false);
  const [implementingTaskId, setImplementingTaskId] = useState<string | null>(null);

  const hasDiff = !!feature.diffRef;
  const hasChangedFiles = feature.changedFiles.length > 0;
  const hasContextFiles = feature.contextFiles.length > 0;
  const hasTasks = feature.tasks.length > 0;

  function openEditTask(task: PlanningTask) {
    setEditingTask(task);
    setTaskModalOpen(true);
  }

  function openNewTask() {
    setEditingTask(undefined);
    setTaskModalOpen(true);
  }

  async function handleImplementTask(task: PlanningTask) {
    if (!confirm(`"${task.title}" mit Claude implementieren?\n\nClaude liest die Context Files, schreibt den Code und erstellt einen GitHub Pull Request.`)) return;
    setImplementingTaskId(task.id);
    try {
      const res = await fetch(`/api/tasks/${task.id}/implement`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({})) as { error?: string; prUrl?: string };
      if (!res.ok) {
        throw new Error(data?.error ?? `Fehler ${res.status}`);
      }
      onMutated();
      if (data.prUrl) {
        window.open(data.prUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Implementierung fehlgeschlagen");
    } finally {
      setImplementingTaskId(null);
    }
  }

  async function handleDeleteFeature(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Feature "${feature.title}" wirklich löschen? Alle Tasks werden ebenfalls gelöscht.`)) return;
    setDeletingFeature(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/epics/${epicId}/features/${feature.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error(`Fehler ${res.status}`);
      onMutated();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Löschen fehlgeschlagen");
      setDeletingFeature(false);
    }
  }

  return (
    <>
      <article
        className={`bg-white dark:bg-zinc-900 rounded-xl border border-[0.5px] border-zinc-200 dark:border-zinc-800 overflow-hidden transition-opacity ${
          deletingFeature ? "opacity-40 pointer-events-none" : ""
        }`}
      >
        {/* ── Header ── */}
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-start gap-2.5">
            {/* Status dot */}
            <span
              className={`mt-[5px] w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[feature.status]}`}
              title={STATUS_LABEL[feature.status]}
            />

            <div className="flex-1 min-w-0">
              {/* Title + Assignee */}
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-snug">
                  {feature.title}
                </h2>
                <AssigneeBadge assignee={feature.assignee} />
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-500 border border-[0.5px] border-zinc-200 dark:border-zinc-700 uppercase tracking-wide">
                  {STATUS_LABEL[feature.status]}
                </span>
              </div>

              {/* Description */}
              {feature.description && (
                <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed line-clamp-2">
                  {feature.description}
                </p>
              )}
            </div>

            {/* Feature action buttons */}
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                onClick={() => setFeatureModalOpen(true)}
                title="Feature bearbeiten"
                className="w-6 h-6 flex items-center justify-center rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <PencilIcon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleDeleteFeature}
                title="Feature löschen"
                className="w-6 h-6 flex items-center justify-center rounded text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors"
              >
                <TrashIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Context Files ── */}
        {hasContextFiles && (
          <div className="px-4 pb-2">
            <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-1.5">
              Context Files
            </p>
            <div className="flex flex-wrap gap-1">
              {feature.contextFiles.map((f) => (
                <FileChip key={f} path={f} variant="context" />
              ))}
            </div>
          </div>
        )}

        {/* ── Changed Files ── */}
        {hasChangedFiles && (
          <div className="px-4 pb-2">
            <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-1.5">
              Changed Files
            </p>
            <div className="flex flex-wrap gap-1">
              {feature.changedFiles.map((f) => (
                <FileChip key={f} path={f} variant="changed" />
              ))}
            </div>
          </div>
        )}

        {/* ── Diff Line ── */}
        {hasDiff && (
          <div className="px-4 pb-3 flex items-center gap-2 flex-wrap">
            <CommitBadge sha={feature.diffRef!} />
            {feature.changedBy && (
              <span className="text-xs text-zinc-400 dark:text-zinc-500">
                by{" "}
                <span className="text-zinc-600 dark:text-zinc-300 font-medium">
                  {feature.changedBy}
                </span>
              </span>
            )}
            {feature.changedAt && (
              <span className="text-xs text-zinc-400 dark:text-zinc-500">
                {formatDate(feature.changedAt)}
              </span>
            )}
            <button
              onClick={() => setDiffOpen(true)}
              className="text-xs text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium underline underline-offset-2 transition-colors"
            >
              Diff ansehen →
            </button>
          </div>
        )}

        {/* ── Tasks section ── */}
        <div className="border-t border-[0.5px] border-zinc-100 dark:border-zinc-800">
          {/* Toggle header — only show if there are tasks */}
          {hasTasks && (
            <button
              onClick={() => setTasksExpanded((p) => !p)}
              className="w-full px-4 py-2 flex items-center gap-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
            >
              <svg
                className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-150 ${
                  tasksExpanded ? "rotate-90" : ""
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5l7 7-7 7"
                />
              </svg>
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {feature.tasks.length}{" "}
                {feature.tasks.length === 1 ? "Task" : "Tasks"}
              </span>
              {/* Done counter */}
              <span className="ml-auto text-[10px] text-zinc-400 dark:text-zinc-600">
                {feature.tasks.filter((t) => t.status === "DONE").length}/
                {feature.tasks.length} done
              </span>
            </button>
          )}

          {/* Task list */}
          {(tasksExpanded || !hasTasks) && hasTasks && (
            <div className="px-2 pb-1 space-y-0.5">
              {feature.tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  projectId={projectId}
                  epicId={epicId}
                  featureId={feature.id}
                  onEdit={openEditTask}
                  onDeleted={onMutated}
                  onImplement={() => handleImplementTask(task)}
                  isImplementing={implementingTaskId === task.id}
                  onStatusChanged={onMutated}
                />
              ))}
            </div>
          )}

          {/* Add Task button */}
          <div className="px-4 py-2">
            <button
              onClick={openNewTask}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-indigo-400 transition-colors"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Task hinzufügen
            </button>
          </div>
        </div>
      </article>

      {/* DiffModal */}
      {hasDiff && (
        <DiffModal
          isOpen={diffOpen}
          onClose={() => setDiffOpen(false)}
          projectId={projectId}
          diffRef={feature.diffRef!}
          files={
            hasChangedFiles ? feature.changedFiles : feature.contextFiles
          }
          title={feature.title}
        />
      )}

      {/* FeatureModal (edit) */}
      <FeatureModal
        isOpen={featureModalOpen}
        onClose={() => setFeatureModalOpen(false)}
        projectId={projectId}
        epicId={epicId}
        feature={feature}
        onSuccess={onMutated}
      />

      {/* TaskModal (create / edit) */}
      <TaskModal
        isOpen={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        projectId={projectId}
        epicId={epicId}
        featureId={feature.id}
        task={editingTask}
        onSuccess={() => {
          setEditingTask(undefined);
          onMutated();
        }}
      />
    </>
  );
}
