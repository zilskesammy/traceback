"use client";
// components/planning/modals/TaskModal.tsx — Create or Edit a Task

import { useState, useEffect, FormEvent } from "react";
import { TicketModal } from "./TicketModal";
import type { PlanningTask, TicketStatus } from "@/types/planning";
import { SessionViewer } from "../SessionViewer";
import { AgentDelegation } from "../AgentDelegation";
import type { DelegateStatus } from "../AgentBadge";

const STATUS_OPTIONS: { value: TicketStatus; label: string }[] = [
  { value: "BACKLOG", label: "Backlog" },
  { value: "TODO", label: "Todo" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "IN_REVIEW", label: "In Review" },
  { value: "DONE", label: "Done" },
  { value: "CANCELLED", label: "Cancelled" },
];

const STATUS_DOT: Record<TicketStatus, string> = {
  BACKLOG: "bg-zinc-400",
  TODO: "bg-blue-400",
  IN_PROGRESS: "bg-amber-400",
  IN_REVIEW: "bg-violet-400",
  DONE: "bg-emerald-500",
  CANCELLED: "bg-red-400",
};

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  epicId: string;
  featureId: string;
  task?: PlanningTask;
  onSuccess: () => void;
}

export function TaskModal({
  isOpen,
  onClose,
  projectId,
  epicId,
  featureId,
  task,
  onSuccess,
}: TaskModalProps) {
  const isEditing = !!task;

  const [title, setTitle] = useState("");
  const [instruction, setInstruction] = useState("");
  const [status, setStatus] = useState<TicketStatus>("BACKLOG");
  const [assignee, setAssignee] = useState("");
  const [contextFiles, setContextFiles] = useState("");
  const [loading, setLoading] = useState(false);
  const [implementing, setImplementing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"details" | "session">("details");

  useEffect(() => {
    if (isOpen) {
      setTitle(task?.title ?? "");
      setInstruction(task?.instruction ?? "");
      setStatus(task?.status ?? "BACKLOG");
      setAssignee(task?.assignee ?? "");
      setContextFiles((task?.contextFiles ?? []).join("\n"));
      setError(null);
      setActiveTab("details");
    }
  }, [isOpen, task]);

  async function handleImplement() {
    if (!task?.id) return;
    setImplementing(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${task.id}/implement`, { method: "POST" });
      const data = await res.json().catch(() => ({})) as { error?: string; prUrl?: string };
      if (!res.ok) {
        throw new Error(data?.error ?? `Fehler ${res.status}`);
      }
      onSuccess();
      onClose();
      if (data.prUrl) {
        window.open(data.prUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Implementierung fehlgeschlagen");
    } finally {
      setImplementing(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Titel ist erforderlich.");
      return;
    }

    setLoading(true);
    setError(null);

    const url = isEditing
      ? `/api/projects/${projectId}/epics/${epicId}/features/${featureId}/tasks/${task!.id}`
      : `/api/projects/${projectId}/epics/${epicId}/features/${featureId}/tasks`;

    const method = isEditing ? "PATCH" : "POST";

    const contextFilesArray = contextFiles
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          instruction: instruction.trim() || null,
          status,
          assignee: assignee.trim() || null,
          contextFiles: contextFilesArray,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `Fehler ${res.status}`);
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }

  return (
    <TicketModal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Task bearbeiten" : "Neuer Task"}
    >
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        {/* Tabs — nur im Edit-Modus */}
        {isEditing && (
          <div className="flex gap-1 border-b border-zinc-800 mb-4">
            {(["details", "session"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setActiveTab(t)}
                className={`px-3 py-2 text-xs font-medium transition-colors ${
                  activeTab === t
                    ? "text-white border-b-2 border-indigo-500"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {t === "details" ? "Details" : "Session Trail"}
              </button>
            ))}
          </div>
        )}

        {/* Agent Delegation — nur im Edit-Modus, Details-Tab */}
        {isEditing && activeTab === "details" && task?.id && (
          <div className="mb-4 p-3 bg-zinc-900/60 border border-zinc-800 rounded-lg">
            <AgentDelegation
              taskId={task.id}
              currentDelegateId={task.delegateId ?? null}
              currentStatus={(task.delegateStatus as DelegateStatus) ?? null}
              onChanged={onSuccess}
            />
          </div>
        )}

        {/* Formfelder — im Create-Modus immer sichtbar, im Edit-Modus nur im Details-Tab */}
        {(!isEditing || activeTab === "details") && (
          <>
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                Titel <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Task-Titel"
                className="w-full px-3 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-indigo-500 placeholder:text-zinc-500 transition-colors"
              />
            </div>

            {/* Instruction */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                Arbeitsanweisung
                <span className="ml-1.5 text-xs font-normal text-zinc-500">(Agent-Instruction)</span>
              </label>
              <textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="Schreibe die genaue Arbeitsanweisung für den Agenten..."
                rows={6}
                className="w-full px-3 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-indigo-500 placeholder:text-zinc-500 resize-none transition-colors"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                Status
              </label>
              <div className="relative">
                <span
                  className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${STATUS_DOT[status]}`}
                />
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TicketStatus)}
                  className="w-full pl-8 pr-3 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors appearance-none"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Assignee */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                Assignee
              </label>
              <input
                type="text"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                placeholder="human oder claude-opus"
                className="w-full px-3 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-indigo-500 placeholder:text-zinc-500 transition-colors"
              />
            </div>

            {/* Context Files */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                Context Files
                <span className="ml-1.5 text-xs font-normal text-zinc-500">(ein Pfad pro Zeile)</span>
              </label>
              <textarea
                value={contextFiles}
                onChange={(e) => setContextFiles(e.target.value)}
                placeholder={"src/lib/auth.ts\nsrc/app/api/..."}
                rows={3}
                className="w-full px-3 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm font-mono focus:outline-none focus:border-indigo-500 placeholder:text-zinc-500 resize-none transition-colors"
              />
            </div>
          </>
        )}

        {/* Session Trail Tab */}
        {isEditing && activeTab === "session" && task?.id && (
          <SessionViewer taskId={task.id} />
        )}

        {/* Error */}
        {error && (
          <p className="text-xs text-red-400 bg-red-950/30 border border-red-800/50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          {/* Implement with Claude — nur bei TODO Tasks im Edit-Modus */}
          {isEditing && status === "TODO" && (
            <button
              type="button"
              onClick={handleImplement}
              disabled={implementing || loading}
              className="mr-auto px-4 py-2 rounded-lg bg-violet-700 hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors flex items-center gap-2"
            >
              {implementing ? (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              )}
              {implementing ? "Claude implementiert…" : "Mit Claude implementieren"}
            </button>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 hover:text-white text-sm transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors flex items-center gap-2"
            >
              {loading && (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {isEditing ? "Speichern" : "Task erstellen"}
            </button>
          </div>
        </div>
      </form>
    </TicketModal>
  );
}
