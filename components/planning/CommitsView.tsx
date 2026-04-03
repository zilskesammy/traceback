"use client";
// components/planning/CommitsView.tsx — Commit-Timeline für ein Projekt

import { useEffect, useState } from "react";
import { GitCommitHorizontal, ExternalLink, ChevronDown, ChevronUp, FileCode2 } from "lucide-react";
// TicketStatus removed — inline definition
type TicketStatus = string;

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface LinkedTicket {
  id: string;
  title: string;
  status: TicketStatus;
  diffRef: string | null;
  prUrl?: string | null;
  changedFiles: unknown;
}

interface CommitEntry {
  id: string;
  sha: string;
  message: string;
  author: string;
  branch: string;
  pushedAt: string;
  filesChanged: unknown;
  linkedTasks: LinkedTicket[];
  linkedFeatures: LinkedTicket[];
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const STATUS_DOT: Record<TicketStatus, string> = {
  BACKLOG: "bg-gray-400 dark:bg-slate-500",
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

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (minutes < 1) return "gerade eben";
  if (minutes < 60) return `vor ${minutes} Min.`;
  if (hours < 24) return `vor ${hours} Std.`;
  if (days < 7) return `vor ${days} Tag${days === 1 ? "" : "en"}`;
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" });
}

function shortSha(sha: string) {
  return sha.slice(0, 7);
}

function parseFiles(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.filter((v): v is string => typeof v === "string");
}

function firstLine(msg: string): string {
  return msg.split("\n")[0] ?? msg;
}

// ─── COMMIT CARD ──────────────────────────────────────────────────────────────

function CommitCard({ commit, repoUrl }: { commit: CommitEntry; repoUrl: string }) {
  const [expanded, setExpanded] = useState(false);
  const files = parseFiles(commit.filesChanged);
  const hasTickets = commit.linkedTasks.length > 0 || commit.linkedFeatures.length > 0;
  const commitUrl = `${repoUrl}/commit/${commit.sha}`;

  return (
    <div className="relative pl-6">
      {/* Timeline line */}
      <div className="absolute left-[7px] top-0 bottom-0 w-px bg-gray-200 dark:bg-slate-800" />
      {/* Timeline dot */}
      <div className="absolute left-0 top-3.5 w-3.5 h-3.5 rounded-full bg-gray-100 dark:bg-slate-800 border-2 border-gray-300 dark:border-slate-700 flex items-center justify-center">
        <GitCommitHorizontal className="w-4 h-4 text-gray-400 dark:text-slate-500" />
      </div>

      <div className="pb-6">
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <a
                  href={commitUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-gray-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors bg-gray-100 dark:bg-slate-800 px-1.5 py-0.5 rounded"
                >
                  {shortSha(commit.sha)}
                </a>
                <span className="text-xs font-mono text-gray-400 dark:text-slate-500 bg-gray-100/60 dark:bg-slate-800/60 px-1.5 py-0.5 rounded border border-gray-300 dark:border-slate-700">
                  {commit.branch}
                </span>
                {hasTickets && (
                  <span className="text-[10px] text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800 px-1.5 py-0.5 rounded">
                    {commit.linkedTasks.length + commit.linkedFeatures.length} Ticket{commit.linkedTasks.length + commit.linkedFeatures.length !== 1 ? "s" : ""} verknüpft
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-sm text-gray-900 dark:text-slate-100 font-medium leading-snug">
                {firstLine(commit.message)}
              </p>
              <p className="mt-0.5 text-xs text-gray-400 dark:text-slate-500">
                {commit.author} · {formatRelativeTime(commit.pushedAt)}
              </p>
            </div>

            {/* Expand button */}
            {(files.length > 0 || hasTickets) && (
              <button
                onClick={() => setExpanded((p) => !p)}
                className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              >
                {expanded
                  ? <ChevronUp className="w-4 h-4" />
                  : <ChevronDown className="w-4 h-4" />
                }
              </button>
            )}
          </div>

          {/* Expanded content */}
          {expanded && (
            <div className="border-t border-gray-200 dark:border-slate-800 divide-y divide-gray-200 dark:divide-slate-800">
              {/* Linked tickets */}
              {hasTickets && (
                <div className="px-4 py-3">
                  <p className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-slate-500 mb-2">
                    Verknüpfte Tickets
                  </p>
                  <div className="space-y-1.5">
                    {commit.linkedFeatures.map((f) => (
                      <div key={f.id} className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[f.status]}`} />
                        <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">Feature</span>
                        <span className="text-xs text-gray-800 dark:text-slate-200">{f.title}</span>
                        <span className="text-[10px] text-gray-400 dark:text-slate-500 ml-auto">{STATUS_LABEL[f.status]}</span>
                      </div>
                    ))}
                    {commit.linkedTasks.map((t) => (
                      <div key={t.id} className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[t.status]}`} />
                        <span className="text-xs text-gray-400 dark:text-slate-500">Task</span>
                        <span className="text-xs text-gray-700 dark:text-slate-300">{t.title}</span>
                        {t.prUrl && (
                          <a
                            href={t.prUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-auto text-[10px] text-violet-600 dark:text-violet-400 hover:text-violet-500 dark:hover:text-violet-300 font-mono bg-violet-50 dark:bg-violet-950/40 px-1.5 py-0.5 rounded border border-violet-200 dark:border-violet-800"
                          >
                            PR
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Changed files */}
              {files.length > 0 && (
                <div className="px-4 py-3">
                  <p className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-slate-500 mb-2">
                    Geänderte Dateien ({files.length})
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {files.slice(0, 20).map((f) => (
                      <span
                        key={f}
                        className="inline-flex items-center gap-1 font-mono text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 border border-gray-300 dark:border-slate-700 max-w-xs truncate"
                        title={f}
                      >
                        <FileCode2 className="w-3.5 h-3.5 shrink-0" />
                        {f.split("/").pop()}
                      </span>
                    ))}
                    {files.length > 20 && (
                      <span className="text-[10px] text-gray-400 dark:text-slate-500 px-1.5 py-0.5">
                        +{files.length - 20} weitere
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export function CommitsView({
  projectId,
  repoUrl,
}: {
  projectId: string;
  repoUrl: string;
}) {
  const [commits, setCommits] = useState<CommitEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/projects/${projectId}/commits`)
      .then((r) => {
        if (!r.ok) throw new Error(`Fehler ${r.status}`);
        return r.json() as Promise<{ commits: CommitEntry[] }>;
      })
      .then((data) => setCommits(data.commits))
      .catch((err) => setError(err instanceof Error ? err.message : "Unbekannter Fehler"))
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <svg className="w-5 h-5 animate-spin text-gray-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (commits.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <GitCommitHorizontal className="w-10 h-10 text-gray-300 dark:text-slate-700" />
        <p className="text-sm text-gray-400 dark:text-slate-500">Noch keine Commits empfangen.</p>
        <p className="text-xs text-gray-400 dark:text-slate-600">
          Stelle sicher, dass der GitHub Webhook konfiguriert ist.
        </p>
      </div>
    );
  }

  // Nach Datum gruppieren
  const groups = new Map<string, CommitEntry[]>();
  for (const c of commits) {
    const dateKey = new Date(c.pushedAt).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    if (!groups.has(dateKey)) groups.set(dateKey, []);
    groups.get(dateKey)!.push(c);
  }

  return (
    <div className="px-6 py-6 max-w-3xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Commit-Verlauf</h2>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{commits.length} Commits · letzte 50</p>
        </div>
        <a
          href={`${repoUrl}/commits`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-1.5"
        >
          GitHub öffnen
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>

      {Array.from(groups.entries()).map(([dateKey, dayCommits]) => (
        <div key={dateKey} className="mb-6">
          <p className="text-[10px] font-medium uppercase tracking-widest text-gray-400 dark:text-slate-500 mb-3">
            {dateKey}
          </p>
          <div>
            {dayCommits.map((commit) => (
              <CommitCard key={commit.id} commit={commit} repoUrl={repoUrl} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
