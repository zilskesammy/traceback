"use client";
// components/changelog/ChangelogView.tsx — Feature list with expandable Entry timeline

import { useState } from "react";
import type { UIChangelogFeature, ChangelogItemType, ChangelogStatus, ChangelogPriority } from "@/types/changelog";

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<ChangelogItemType, { label: string; color: string; bg: string }> = {
  FEATURE: { label: "Feature", color: "text-emerald-400", bg: "bg-emerald-500" },
  BUGFIX: { label: "Bugfix", color: "text-amber-400", bg: "bg-amber-500" },
  EPIC: { label: "Epic", color: "text-violet-400", bg: "bg-violet-500" },
  TASK: { label: "Task", color: "text-blue-400", bg: "bg-blue-500" },
};

const STATUS_CONFIG: Record<ChangelogStatus, { label: string; dot: string }> = {
  COMPLETED: { label: "Completed", dot: "bg-emerald-500" },
  IN_PROGRESS: { label: "In Progress", dot: "bg-amber-400" },
  PLANNED: { label: "Planned", dot: "bg-zinc-400" },
};

const PRIORITY_CONFIG: Record<ChangelogPriority, { label: string; color: string }> = {
  HIGH: { label: "High", color: "text-red-400" },
  MEDIUM: { label: "Medium", color: "text-amber-400" },
  LOW: { label: "Low", color: "text-zinc-400" },
};

const AGENT_COLOR: Record<string, string> = {
  FRONTEND: "bg-violet-900 text-violet-300",
  BACKEND: "bg-blue-900 text-blue-300",
  QA: "bg-green-900 text-green-300",
  DEVOPS: "bg-orange-900 text-orange-300",
  FULLSTACK: "bg-indigo-900 text-indigo-300",
  HUMAN: "bg-zinc-800 text-zinc-300",
};

// ─── ENTRY ROW ────────────────────────────────────────────────────────────────

function EntryRow({ entry }: { entry: UIChangelogFeature["entries"][0] }) {
  const [expanded, setExpanded] = useState(false);
  const agentColor = AGENT_COLOR[entry.agentType] ?? "bg-zinc-800 text-zinc-300";
  const hasDetails = entry.what || entry.why || entry.technicalDetails || entry.sideEffects;

  return (
    <div className="flex gap-3 py-2 group/entry">
      <div className="w-[2px] bg-zinc-800 rounded-full shrink-0 mt-1" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${agentColor}`}>
            {entry.agentType}
          </span>
          <span className="text-xs text-zinc-500">{entry.agentName}</span>
          <span className="text-[10px] text-zinc-600 uppercase tracking-wide">{entry.action}</span>
          <span className="text-[10px] text-zinc-600 ml-auto">
            {new Date(entry.timestamp).toLocaleDateString("de-DE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
        <p className="text-sm text-zinc-300 mt-1 leading-snug">{entry.summary}</p>
        {entry.linesAdded + entry.linesRemoved > 0 && (
          <p className="text-[10px] text-zinc-600 mt-0.5">
            {entry.codeChanges.length} file{entry.codeChanges.length !== 1 ? "s" : ""} ·{" "}
            <span className="text-emerald-600">+{entry.linesAdded}</span>{" "}
            <span className="text-red-600">-{entry.linesRemoved}</span>
          </p>
        )}

        {hasDetails && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="mt-1 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            {expanded ? "▲ Less" : "▼ More"}
          </button>
        )}

        {expanded && (
          <div className="mt-2 space-y-2">
            {entry.what && (
              <div>
                <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 mb-0.5">What</p>
                <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap">{entry.what}</p>
              </div>
            )}
            {entry.why && (
              <div>
                <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 mb-0.5">Why</p>
                <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap">{entry.why}</p>
              </div>
            )}
            {entry.technicalDetails && (
              <div>
                <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 mb-0.5">Technical Details</p>
                <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap">{entry.technicalDetails}</p>
              </div>
            )}
            {entry.sideEffects && (
              <div>
                <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 mb-0.5">Side Effects</p>
                <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap">{entry.sideEffects}</p>
              </div>
            )}
            {entry.codeChanges.length > 0 && (
              <div>
                <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 mb-1">Changed Files</p>
                <div className="space-y-0.5">
                  {entry.codeChanges.map((cc) => (
                    <div key={cc.file} className="flex items-center gap-2 text-[10px]">
                      <span className={`w-12 text-center rounded px-1 ${
                        cc.changeType === "ADDED" ? "bg-emerald-900/50 text-emerald-400" :
                        cc.changeType === "REMOVED" ? "bg-red-900/50 text-red-400" :
                        "bg-zinc-800 text-zinc-400"
                      }`}>{cc.changeType.toLowerCase()}</span>
                      <span className="font-mono text-zinc-400 truncate flex-1">{cc.file}</span>
                      <span className="text-zinc-600 shrink-0">+{cc.linesAdded} -{cc.linesRemoved}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── FEATURE ROW ──────────────────────────────────────────────────────────────

function FeatureRow({
  feature,
  projectId,
}: {
  feature: UIChangelogFeature & { _entryCount?: number };
  projectId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [fullFeature, setFullFeature] = useState<UIChangelogFeature | null>(null);
  const [loading, setLoading] = useState(false);

  const typeConf = TYPE_CONFIG[feature.type];
  const statusConf = STATUS_CONFIG[feature.status];
  const priorityConf = PRIORITY_CONFIG[feature.priority];
  const entryCount = feature._entryCount ?? feature.entries?.length ?? 0;

  async function handleExpand() {
    if (!expanded && !fullFeature) {
      setLoading(true);
      try {
        const res = await fetch(`/api/projects/${projectId}/changelog/${feature.id}`);
        if (res.ok) setFullFeature(await res.json());
      } finally {
        setLoading(false);
      }
    }
    setExpanded((e) => !e);
  }

  const displayFeature = fullFeature ?? feature;

  return (
    <div className="border border-zinc-800 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={handleExpand}
        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-zinc-900/50 transition-colors"
      >
        <span className={`w-2 h-2 rounded-full shrink-0 ${typeConf.bg}`} />
        <span className={`text-[10px] font-semibold uppercase tracking-wide ${typeConf.color} shrink-0 w-14`}>
          {typeConf.label}
        </span>
        <span className="flex-1 text-sm font-medium text-zinc-200 text-left truncate">{feature.title}</span>
        <span className="flex items-center gap-1 shrink-0">
          <span className={`w-1.5 h-1.5 rounded-full ${statusConf.dot}`} />
          <span className="text-[10px] text-zinc-500">{statusConf.label}</span>
        </span>
        <span className={`text-[10px] shrink-0 ${priorityConf.color}`}>{priorityConf.label}</span>
        <span className="text-[10px] text-zinc-600 shrink-0">{entryCount} entr{entryCount !== 1 ? "ies" : "y"}</span>
        <span className="text-zinc-600 text-xs shrink-0">{expanded ? "▲" : "▼"}</span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-zinc-800 px-4 py-3 bg-zinc-950/50">
          {displayFeature.summary && (
            <p className="text-xs text-zinc-400 mb-3 leading-relaxed">{displayFeature.summary}</p>
          )}
          {displayFeature.businessContext && (
            <div className="mb-3">
              <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 mb-0.5">Business Context</p>
              <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap">{displayFeature.businessContext}</p>
            </div>
          )}
          {displayFeature.rootCause && (
            <div className="mb-3">
              <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 mb-0.5">Root Cause</p>
              <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap">{displayFeature.rootCause}</p>
            </div>
          )}
          {displayFeature.acceptanceCriteria.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 mb-1">Acceptance Criteria</p>
              <ul className="space-y-0.5">
                {displayFeature.acceptanceCriteria.map((c, i) => (
                  <li key={i} className="text-xs text-zinc-400 flex items-start gap-1.5">
                    <span className="text-emerald-500 shrink-0 mt-0.5">✓</span>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {displayFeature.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {displayFeature.tags.map((t) => (
                <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">{t}</span>
              ))}
            </div>
          )}

          {loading && <p className="text-xs text-zinc-500 py-2">Loading entries...</p>}
          {!loading && displayFeature.entries?.length > 0 && (
            <div className="mt-2 space-y-0">
              <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 mb-2">Entry Timeline</p>
              {displayFeature.entries.map((entry) => (
                <EntryRow key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
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
    <div className="flex h-full overflow-hidden">
      {/* Filter sidebar */}
      <aside className="w-48 shrink-0 border-r border-zinc-800 bg-zinc-950 p-3 overflow-y-auto">
        <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 mb-2">Type</p>
        {(["ALL", "FEATURE", "BUGFIX", "EPIC", "TASK"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={`w-full text-left px-2 py-1 rounded text-xs mb-0.5 transition-colors ${
              filterType === t ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t === "ALL" ? "All Types" : TYPE_CONFIG[t].label}
          </button>
        ))}

        <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 mb-2 mt-4">Status</p>
        {(["ALL", "COMPLETED", "IN_PROGRESS", "PLANNED"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`w-full text-left px-2 py-1 rounded text-xs mb-0.5 transition-colors ${
              filterStatus === s ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {s === "ALL" ? "All Status" : STATUS_CONFIG[s].label}
          </button>
        ))}
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="shrink-0 px-5 py-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900">
          <p className="text-sm font-medium text-zinc-300">
            {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
            {filterType !== "ALL" || filterStatus !== "ALL" ? " (filtered)" : ""}
          </p>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-medium text-white transition-colors"
          >
            {syncing ? "Syncing..." : "↓ Sync"}
          </button>
        </div>

        {/* Feature list */}
        <div className="flex-1 overflow-y-auto p-5 space-y-2">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-zinc-500 text-sm">No entries yet.</p>
              <p className="text-zinc-600 text-xs mt-1">Push .agent-changelog/ changes or click Sync.</p>
            </div>
          ) : (
            filtered.map((feature) => (
              <FeatureRow key={feature.id} feature={feature} projectId={projectId} />
            ))
          )}
        </div>
      </main>
    </div>
  );
}
