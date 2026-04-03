"use client";
// components/changelog/ChangelogView.tsx

import React, { useState, useEffect } from "react";
import {
  RefreshCw,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Code2,
  GitBranch,
} from "lucide-react";
import type { UIChangelogFeature, ChangelogItemType, ChangelogStatus, ChangelogPriority } from "@/types/changelog";

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<ChangelogItemType, { label: string; className: string }> = {
  FEATURE:  { label: "Feature",  className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" },
  BUGFIX:   { label: "Bugfix",   className: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400" },
  EPIC:     { label: "Epic",     className: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-400" },
  TASK:     { label: "Task",     className: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400" },
};

const STATUS_CONFIG: Record<ChangelogStatus, { label: string; dotClass: string }> = {
  COMPLETED:   { label: "Completed",   dotClass: "bg-emerald-500" },
  IN_PROGRESS: { label: "In Progress", dotClass: "bg-amber-400" },
  PLANNED:     { label: "Planned",     dotClass: "bg-gray-400 dark:bg-slate-500" },
};

const PRIORITY_CONFIG: Record<ChangelogPriority, { label: string; className: string }> = {
  HIGH:   { label: "High",   className: "text-red-500 dark:text-red-400" },
  MEDIUM: { label: "Medium", className: "text-amber-500 dark:text-amber-400" },
  LOW:    { label: "Low",    className: "text-gray-400 dark:text-slate-500" },
};

const AGENT_CLASS: Record<string, string> = {
  FRONTEND:        "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  BACKEND:         "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  QA:              "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  DEVOPS:          "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  FULLSTACK:       "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  ARCHITECT:       "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
  PROJECT_MANAGER: "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300",
  DOCUMENTATION:   "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
  SECURITY:        "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  HUMAN:           "bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-300",
};

// ─── ENTRY ROW ────────────────────────────────────────────────────────────────

function EntryRow({ entry }: { entry: UIChangelogFeature["entries"][0] }) {
  const [expanded, setExpanded] = useState(false);
  const agentClass = AGENT_CLASS[entry.agentType] ?? AGENT_CLASS.HUMAN;
  const hasDetails = entry.what || entry.why || entry.technicalDetails || entry.sideEffects;

  return (
    <div className="py-2.5 border-b border-gray-100 dark:border-slate-800 last:border-b-0">
      <div className="flex items-start gap-3">
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold flex-shrink-0 mt-0.5 ${agentClass}`}>
          {entry.agentType.replace("_", " ")}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-gray-700 dark:text-slate-300">{entry.agentName}</span>
            <span className="text-[10px] text-gray-400 dark:text-slate-500 uppercase tracking-wide">{entry.action}</span>
            <span className="text-[10px] text-gray-400 dark:text-slate-500 ml-auto">
              {new Date(entry.timestamp).toLocaleDateString("de-DE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          <p className="text-sm text-gray-600 dark:text-slate-400 mt-0.5 leading-snug">{entry.summary}</p>
          {entry.linesAdded + entry.linesRemoved > 0 && (
            <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5 flex items-center gap-1">
              <Code2 className="w-3 h-3" />
              {entry.codeChanges.length} {entry.codeChanges.length !== 1 ? "files" : "file"}
              <span className="text-emerald-600 dark:text-emerald-500 ml-1">+{entry.linesAdded}</span>
              <span className="text-red-500 dark:text-red-400">-{entry.linesRemoved}</span>
            </p>
          )}
          {hasDetails && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="mt-1 text-[10px] text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors flex items-center gap-0.5"
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? "Weniger" : "Details"}
            </button>
          )}
          {expanded && (
            <div className="mt-2 space-y-2 bg-gray-50 dark:bg-slate-800/50 rounded-lg px-3 py-2">
              {entry.what && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-500 mb-0.5">Was</p>
                  <p className="text-xs text-gray-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">{entry.what}</p>
                </div>
              )}
              {entry.why && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-500 mb-0.5">Warum</p>
                  <p className="text-xs text-gray-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">{entry.why}</p>
                </div>
              )}
              {entry.technicalDetails && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-500 mb-0.5">Details</p>
                  <p className="text-xs text-gray-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">{entry.technicalDetails}</p>
                </div>
              )}
              {entry.codeChanges.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-500 mb-1">Geänderte Dateien</p>
                  <div className="space-y-0.5">
                    {entry.codeChanges.map((cc) => (
                      <div key={cc.file} className="flex items-center gap-2 text-[10px]">
                        <span className={`w-14 text-center rounded px-1 py-0.5 ${
                          cc.changeType === "ADDED"   ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" :
                          cc.changeType === "REMOVED" ? "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400" :
                          "bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400"
                        }`}>{cc.changeType.toLowerCase()}</span>
                        <span className="font-mono text-gray-500 dark:text-slate-400 truncate flex-1">{cc.file}</span>
                        <span className="text-gray-400 dark:text-slate-500 shrink-0">+{cc.linesAdded} -{cc.linesRemoved}</span>
                      </div>
                    ))}
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

// ─── EXPANDED ROW ────────────────────────────────────────────────────────────

function FeatureExpandedRow({
  feature,
  projectId,
}: {
  feature: UIChangelogFeature & { _entryCount?: number };
  projectId: string;
}) {
  const [fullFeature, setFullFeature] = useState<UIChangelogFeature | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${projectId}/changelog/${feature.id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (!cancelled && data) setFullFeature(data); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId, feature.id]);

  const f = fullFeature ?? feature;

  return (
    <tr>
      <td colSpan={6} className="px-4 pb-3 pt-0 bg-gray-50 dark:bg-slate-800/40">
        <div className="border-t border-gray-200 dark:border-slate-700 pt-3">
          {f.summary && <p className="text-xs text-gray-600 dark:text-slate-400 mb-3 leading-relaxed">{f.summary}</p>}
          {f.businessContext && (
            <div className="mb-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-500 mb-0.5">Business Context</p>
              <p className="text-xs text-gray-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">{f.businessContext}</p>
            </div>
          )}
          {f.rootCause && (
            <div className="mb-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-500 mb-0.5">Root Cause</p>
              <p className="text-xs text-gray-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">{f.rootCause}</p>
            </div>
          )}
          {f.acceptanceCriteria.length > 0 && (
            <div className="mb-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-500 mb-1">Acceptance Criteria</p>
              <ul className="space-y-0.5">
                {f.acceptanceCriteria.map((c, i) => (
                  <li key={i} className="text-xs text-gray-600 dark:text-slate-400 flex items-start gap-1.5">
                    <span className="text-emerald-500 shrink-0 mt-0.5">&#10003;</span>{c}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {f.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {f.tags.map((t) => (
                <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400">{t}</span>
              ))}
            </div>
          )}
          {loading && <p className="text-xs text-gray-400 dark:text-slate-500 py-2">Lädt...</p>}
          {!loading && f.entries?.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-500 mb-1">Entry Timeline</p>
              {f.entries.map((entry) => (
                <EntryRow key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export interface ChangelogViewProps {
  projectId: string;
  initialFeatures: (UIChangelogFeature & { _entryCount?: number })[];
}

export function ChangelogView({ projectId, initialFeatures }: ChangelogViewProps) {
  const [features, setFeatures] = useState(initialFeatures);
  const [syncing, setSyncing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<ChangelogItemType | "ALL">("ALL");
  const [filterStatus, setFilterStatus] = useState<ChangelogStatus | "ALL">("ALL");

  const filtered = features.filter((f) => {
    if (filterType !== "ALL" && f.type !== filterType) return false;
    if (filterStatus !== "ALL" && f.status !== filterStatus) return false;
    return true;
  });

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/changelog/sync`, { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        const listRes = await fetch(`/api/projects/${projectId}/changelog`);
        if (listRes.ok) setFeatures(await listRes.json());
      }
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-50 dark:bg-slate-950">
      {/* Toolbar */}
      <div className="flex-shrink-0 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-5 py-3 flex items-center gap-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Changelog</h2>
        <div className="flex items-center gap-2 ml-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as ChangelogItemType | "ALL")}
            className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 dark:text-slate-300 outline-none focus:border-indigo-400 dark:focus:border-indigo-600"
          >
            <option value="ALL">Alle Typen</option>
            <option value="FEATURE">Feature</option>
            <option value="BUGFIX">Bugfix</option>
            <option value="EPIC">Epic</option>
            <option value="TASK">Task</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as ChangelogStatus | "ALL")}
            className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 dark:text-slate-300 outline-none focus:border-indigo-400 dark:focus:border-indigo-600"
          >
            <option value="ALL">Alle Status</option>
            <option value="COMPLETED">Completed</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="PLANNED">Planned</option>
          </select>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-gray-400 dark:text-slate-500">{filtered.length} {filtered.length === 1 ? "Eintrag" : "Einträge"}</span>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-xs font-medium text-white transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Sync"}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <GitBranch className="w-10 h-10 text-gray-300 dark:text-slate-600 mb-3" />
            <p className="text-sm font-medium text-gray-500 dark:text-slate-400">Keine Einträge</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Sync starten oder Branch-Einstellungen prüfen.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="sticky top-0 z-10">
              <tr className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800">
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Feature</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Typ</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Status</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Priorität</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Entries</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Aktualisiert</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((feature) => {
                const typeConf = TYPE_CONFIG[feature.type];
                const statusConf = STATUS_CONFIG[feature.status];
                const priorityConf = PRIORITY_CONFIG[feature.priority];
                const entryCount = feature._entryCount ?? feature.entries?.length ?? 0;
                const isExpanded = expandedId === feature.id;

                return (
                  <React.Fragment key={feature.id}>
                    <tr
                      onClick={() => setExpandedId(isExpanded ? null : feature.id)}
                      className="border-b border-gray-100 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-900 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isExpanded
                            ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500 flex-shrink-0" />
                            : <ChevronRight className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500 flex-shrink-0" />
                          }
                          <span className="text-sm font-medium text-gray-900 dark:text-slate-100 leading-snug">{feature.title}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${typeConf.className}`}>
                          {typeConf.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-slate-400">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusConf.dotClass}`} />
                          {statusConf.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${priorityConf.className}`}>{priorityConf.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-500 dark:text-slate-400">{entryCount}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-400 dark:text-slate-500">
                          {new Date(feature.updatedAt).toLocaleDateString("de-DE", { day: "2-digit", month: "short" })}
                        </span>
                      </td>
                    </tr>
                    {isExpanded && (
                      <FeatureExpandedRow
                        key={`${feature.id}-expanded`}
                        feature={feature}
                        projectId={projectId}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
