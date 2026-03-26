"use client";
// components/planning/DiffModal.tsx — Diff Viewer Modal
// Lädt Diffs per Datei von /api/diff, rendert unified diff mit Farbcodes

import { useEffect, useState, useCallback } from "react";
import type { FileDiff, DiffLine } from "@/types/planning";

// ─── DIFF RENDERING ──────────────────────────────────────────────────────────

const LINE_STYLES: Record<DiffLine["type"], string> = {
  add: "bg-emerald-950/60 text-emerald-300 border-l-2 border-emerald-500",
  remove: "bg-red-950/60 text-red-300 border-l-2 border-red-600",
  context: "text-zinc-400",
  header: "text-violet-400 bg-zinc-900",
};

const LINE_PREFIX: Record<DiffLine["type"], string> = {
  add: "+ ",
  remove: "- ",
  context: "  ",
  header: "",
};

function DiffBlock({ diff }: { diff: FileDiff }) {
  if (diff.error) {
    return (
      <div className="px-4 py-3 text-xs text-red-400 bg-red-950/30 rounded-lg border border-[0.5px] border-red-800">
        {diff.error}
      </div>
    );
  }

  if (diff.lines.length === 0) {
    return (
      <div className="px-4 py-3 text-xs text-zinc-500 italic">
        Keine Änderungen in dieser Datei.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <pre className="text-[11px] leading-5 font-mono">
        {diff.lines.map((line, i) => (
          <div
            key={i}
            className={`px-4 py-px whitespace-pre ${LINE_STYLES[line.type]}`}
          >
            {LINE_PREFIX[line.type]}
            {line.content}
          </div>
        ))}
      </pre>
    </div>
  );
}

// ─── FILE TAB BAR ─────────────────────────────────────────────────────────────

function FileTab({
  path,
  active,
  diff,
  onClick,
}: {
  path: string;
  active: boolean;
  diff: FileDiff | null;
  onClick: () => void;
}) {
  const fileName = path.split("/").pop() ?? path;
  const hasStats = diff && !diff.error && diff.lines.length > 0;

  return (
    <button
      onClick={onClick}
      title={path}
      className={`
        shrink-0 px-3 py-2 text-[11px] font-mono border-b-2 transition-colors whitespace-nowrap
        ${
          active
            ? "border-indigo-500 text-zinc-100 bg-zinc-800/60"
            : "border-transparent text-zinc-500 hover:text-zinc-300 hover:border-zinc-600"
        }
      `}
    >
      {fileName}
      {hasStats && (
        <span className="ml-1.5">
          <span className="text-emerald-400">+{diff.additions}</span>
          <span className="text-zinc-600 mx-0.5">/</span>
          <span className="text-red-400">-{diff.deletions}</span>
        </span>
      )}
    </button>
  );
}

// ─── MAIN MODAL ───────────────────────────────────────────────────────────────

interface DiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  diffRef: string;
  files: string[];
  title: string;
}

export function DiffModal({
  isOpen,
  onClose,
  projectId,
  diffRef,
  files,
  title,
}: DiffModalProps) {
  const [diffs, setDiffs] = useState<Map<string, FileDiff>>(new Map());
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [activeFile, setActiveFile] = useState<string | null>(null);

  // Fetch diff für eine einzelne Datei
  const fetchDiff = useCallback(
    async (file: string) => {
      if (diffs.has(file) || loading.has(file)) return;

      setLoading((prev) => new Set(prev).add(file));

      try {
        const url = `/api/diff?sha=${encodeURIComponent(diffRef)}&file=${encodeURIComponent(file)}&projectId=${encodeURIComponent(projectId)}`;
        const res = await fetch(url);

        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { error?: string };
          setDiffs((prev) =>
            new Map(prev).set(file, {
              file,
              additions: 0,
              deletions: 0,
              lines: [],
              error: body.error ?? `HTTP ${res.status}`,
            })
          );
          return;
        }

        const data = (await res.json()) as FileDiff;
        setDiffs((prev) => new Map(prev).set(file, data));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Network error";
        setDiffs((prev) =>
          new Map(prev).set(file, {
            file,
            additions: 0,
            deletions: 0,
            lines: [],
            error: message,
          })
        );
      } finally {
        setLoading((prev) => {
          const next = new Set(prev);
          next.delete(file);
          return next;
        });
      }
    },
    [diffRef, projectId, diffs, loading]
  );

  // Beim Öffnen: aktives File setzen + initialen Diff laden
  useEffect(() => {
    if (!isOpen || files.length === 0) return;
    const first = files[0];
    setActiveFile(first);
    void fetchDiff(first);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Datei-Tab wechseln: Diff lazy laden
  const handleTabClick = (file: string) => {
    setActiveFile(file);
    void fetchDiff(file);
  };

  // ESC schließt Modal
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const activeDiff = activeFile ? (diffs.get(activeFile) ?? null) : null;
  const isLoadingActive = activeFile ? loading.has(activeFile) : false;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
        aria-modal="true"
        role="dialog"
        aria-label={`Diff: ${title}`}
      >
        <div
          className="
            pointer-events-auto w-full max-w-4xl max-h-[85vh] flex flex-col
            bg-zinc-950 border border-[0.5px] border-zinc-800 rounded-xl shadow-xl overflow-hidden
          "
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[0.5px] border-zinc-800 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-mono text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded border border-[0.5px] border-zinc-700">
                {diffRef.slice(0, 7)}
              </span>
              <span className="text-sm font-medium text-zinc-200 truncate">
                {title}
              </span>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 ml-2 p-1 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
              aria-label="Schließen"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* File Tabs */}
          {files.length > 1 && (
            <div className="flex overflow-x-auto border-b border-[0.5px] border-zinc-800 shrink-0 bg-zinc-900/50">
              {files.map((file) => (
                <FileTab
                  key={file}
                  path={file}
                  active={file === activeFile}
                  diff={diffs.get(file) ?? null}
                  onClick={() => handleTabClick(file)}
                />
              ))}
            </div>
          )}

          {/* Single-file label */}
          {files.length === 1 && activeFile && (
            <div className="px-4 py-2 border-b border-[0.5px] border-zinc-800 shrink-0 bg-zinc-900/30">
              <span className="text-[11px] font-mono text-zinc-400">
                {activeFile}
              </span>
              {activeDiff && !activeDiff.error && (
                <span className="ml-3 text-[11px]">
                  <span className="text-emerald-400">+{activeDiff.additions}</span>
                  <span className="text-zinc-600 mx-1">/</span>
                  <span className="text-red-400">-{activeDiff.deletions}</span>
                </span>
              )}
            </div>
          )}

          {/* Diff Content */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {isLoadingActive ? (
              <div className="flex items-center justify-center h-40 gap-2">
                <svg
                  className="w-4 h-4 text-zinc-500 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>
                <span className="text-xs text-zinc-500">Lade Diff…</span>
              </div>
            ) : activeDiff ? (
              <DiffBlock diff={activeDiff} />
            ) : (
              <div className="flex items-center justify-center h-40">
                <span className="text-xs text-zinc-600">Keine Datei ausgewählt</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
