"use client";
// components/planning/modals/EpicModal.tsx — Create or Edit an Epic

import { useState, useEffect, FormEvent } from "react";
import { TicketModal } from "./TicketModal";
import type { PlanningEpic, TicketStatus } from "@/types/planning";

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

interface EpicModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  epic?: PlanningEpic;
  onSuccess: () => void;
}

export function EpicModal({ isOpen, onClose, projectId, epic, onSuccess }: EpicModalProps) {
  const isEditing = !!epic;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TicketStatus>("BACKLOG");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Populate form when editing
  useEffect(() => {
    if (isOpen) {
      setTitle(epic?.title ?? "");
      setDescription(epic?.description ?? "");
      setStatus(epic?.status ?? "BACKLOG");
      setError(null);
    }
  }, [isOpen, epic]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Titel ist erforderlich.");
      return;
    }

    setLoading(true);
    setError(null);

    const url = isEditing
      ? `/api/projects/${projectId}/epics/${epic!.id}`
      : `/api/projects/${projectId}/epics`;

    const method = isEditing ? "PATCH" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          status,
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
      title={isEditing ? "Epic bearbeiten" : "Neues Epic"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">
            Titel <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Epic-Titel"
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
            {isEditing ? "Speichern" : "Epic erstellen"}
          </button>
        </div>
      </form>
    </TicketModal>
  );
}
