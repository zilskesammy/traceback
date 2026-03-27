"use client";
// components/planning/modals/FeatureModal.tsx — Create or Edit a Feature

import { useState, useEffect, FormEvent } from "react";
import { TicketModal } from "./TicketModal";
import type { PlanningFeature, TicketStatus } from "@/types/planning";

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

interface FeatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  epicId: string;
  feature?: PlanningFeature;
  onSuccess: () => void;
}

export function FeatureModal({
  isOpen,
  onClose,
  projectId,
  epicId,
  feature,
  onSuccess,
}: FeatureModalProps) {
  const isEditing = !!feature;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TicketStatus>("BACKLOG");
  const [assignee, setAssignee] = useState("");
  const [contextFiles, setContextFiles] = useState("");
  const [acceptanceCriteria, setAcceptanceCriteria] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle(feature?.title ?? "");
      setDescription(feature?.description ?? "");
      setStatus(feature?.status ?? "BACKLOG");
      setAssignee(feature?.assignee ?? "");
      setContextFiles((feature?.contextFiles ?? []).join("\n"));
      setAcceptanceCriteria("");
      setError(null);
    }
  }, [isOpen, feature]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Titel ist erforderlich.");
      return;
    }

    setLoading(true);
    setError(null);

    const url = isEditing
      ? `/api/projects/${projectId}/epics/${epicId}/features/${feature!.id}`
      : `/api/projects/${projectId}/epics/${epicId}/features`;

    const method = isEditing ? "PATCH" : "POST";

    const contextFilesArray = contextFiles
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const acceptanceCriteriaArray = acceptanceCriteria
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          status,
          assignee: assignee.trim() || null,
          contextFiles: contextFilesArray,
          ...(acceptanceCriteriaArray.length > 0 && {
            acceptanceCriteria: acceptanceCriteriaArray,
          }),
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
      title={isEditing ? "Feature bearbeiten" : "Neues Feature"}
    >
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">
            Titel <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Feature-Titel"
            className="w-full px-3 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-indigo-500 placeholder:text-zinc-500 transition-colors"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">
            Beschreibung
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optionale Beschreibung..."
            rows={3}
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

        {/* Acceptance Criteria */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">
            Acceptance Criteria
            <span className="ml-1.5 text-xs font-normal text-zinc-500">(ein Kriterium pro Zeile)</span>
          </label>
          <textarea
            value={acceptanceCriteria}
            onChange={(e) => setAcceptanceCriteria(e.target.value)}
            placeholder={"Benutzer kann sich einloggen\nToken wird korrekt gespeichert"}
            rows={3}
            className="w-full px-3 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-indigo-500 placeholder:text-zinc-500 resize-none transition-colors"
          />
        </div>

        {/* Error */}
        {error && (
          <p className="text-xs text-red-400 bg-red-950/30 border border-red-800/50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-1">
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
            {isEditing ? "Speichern" : "Feature erstellen"}
          </button>
        </div>
      </form>
    </TicketModal>
  );
}
