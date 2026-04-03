"use client";
// components/settings/RepoSection.tsx — GitHub Repository Info + Webhook-Status

import { Copy, ExternalLink } from "lucide-react";

interface RepoSectionProps {
  repoOwner: string;
  repoName: string;
  repoUrl: string;
  defaultBranch: string;
  lastCommitAt: string | null; // ISO-String des letzten Commits
  commitCount: number;
  webhookUrl: string; // URL des Webhook-Endpunkts
}

export function RepoSection({
  repoOwner,
  repoName,
  repoUrl,
  defaultBranch,
  lastCommitAt,
  commitCount,
  webhookUrl,
}: RepoSectionProps) {
  function formatDate(iso: string | null): string {
    if (!iso) return "Noch kein Commit empfangen";
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const hours = Math.floor(diff / 3_600_000);
    const days = Math.floor(diff / 86_400_000);
    if (hours < 1) return "Vor weniger als einer Stunde";
    if (hours < 24) return `Vor ${hours} Stunde${hours === 1 ? "" : "n"}`;
    if (days < 7) return `Vor ${days} Tag${days === 1 ? "" : "en"}`;
    return d.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });
  }

  return (
    <section className="mb-10">
      <h2 className="text-base font-semibold text-gray-700 dark:text-slate-300 mb-1">GitHub Repository</h2>
      <p className="text-sm text-gray-500 dark:text-slate-400 mb-5">
        Verbundenes Repository und Webhook-Status.
      </p>

      {/* Repo card */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden mb-4">
        {/* Repo header */}
        <div className="px-5 py-4 flex items-center gap-4">
          {/* GitHub icon */}
          <div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-gray-600" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
          </div>

          <div className="flex-1 min-w-0">
            <a
              href={repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-gray-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              {repoOwner}/{repoName}
            </a>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 3v12m0 0l3-3m-3 3l-3-3m12 0V3m0 0l3 3m-3-3l-3 3" />
                </svg>
                {defaultBranch}
              </span>
              <span className="text-xs text-gray-500 dark:text-slate-400">
                {commitCount} Commit{commitCount !== 1 ? "s" : ""} getrackt
              </span>
            </div>
          </div>

          <a
            href={repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-xs text-gray-400 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-1"
          >
            Öffnen
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Stats row */}
        <div className="border-t border-gray-100 dark:border-slate-800 px-5 py-3 flex items-center gap-6">
          {/* Webhook status */}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${commitCount > 0 ? "bg-emerald-500" : "bg-amber-400"}`} />
            <span className="text-xs text-gray-500 dark:text-slate-400">
              Webhook {commitCount > 0 ? "aktiv" : "noch nicht empfangen"}
            </span>
          </div>
          <span className="text-xs text-gray-400 dark:text-slate-500">
            Letzter Push: {formatDate(lastCommitAt)}
          </span>
        </div>
      </div>

      {/* Webhook URL info box */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-5 py-4">
        <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-2">Webhook-Endpunkt</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs font-mono text-gray-700 dark:text-slate-300 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 px-3 py-2 rounded-lg truncate">
            {webhookUrl}
          </code>
          <button
            onClick={() => navigator.clipboard.writeText(webhookUrl)}
            title="Kopieren"
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-500 dark:text-slate-300 hover:text-gray-700 transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-2">
          Trage diese URL in den GitHub Webhook-Einstellungen deines Repositories ein.
          Content-Type: <code className="text-gray-500 dark:text-slate-400">application/json</code>
        </p>
      </div>
    </section>
  );
}
