"use client";
// components/planning/PlanningLayout.tsx — Haupt-Shell der Planning UI
// Sidebar (Epics) + Hauptbereich (FeatureBoard oder YamlView) + View-Toggle

import { useState } from "react";
import { FeatureBoard } from "./FeatureBoard";
import { YamlView } from "./YamlView";
import type { PlanningProject, PlanningEpic, TicketStatus } from "@/types/planning";

// ─── STATUS HELPERS ──────────────────────────────────────────────────────────

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

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────

function EpicSidebar({
  epics,
  activeId,
  onSelect,
  projectName,
}: {
  epics: PlanningEpic[];
  activeId: string | null;
  onSelect: (id: string) => void;
  projectName: string;
}) {
  return (
    <aside className="w-60 shrink-0 h-full flex flex-col border-r border-[0.5px] border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-y-auto">
      {/* Project name */}
      <div className="px-4 py-4 border-b border-[0.5px] border-zinc-200 dark:border-zinc-800">
        <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-0.5">
          Project
        </p>
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
          {projectName}
        </p>
      </div>

      {/* Epics list */}
      <div className="px-2 py-3 flex-1">
        <p className="px-2 mb-2 text-[10px] font-medium uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
          Epics
        </p>

        {epics.length === 0 && (
          <p className="px-2 text-xs text-zinc-400 dark:text-zinc-600 italic">
            Noch keine Epics
          </p>
        )}

        <ul className="space-y-0.5">
          {epics.map((epic) => {
            const isActive = epic.id === activeId;
            const featureCount = epic.features.length;
            const doneCount = epic.features.filter(
              (f) => f.status === "DONE"
            ).length;

            return (
              <li key={epic.id}>
                <button
                  onClick={() => onSelect(epic.id)}
                  className={`
                    w-full text-left px-2 py-2 rounded-lg transition-colors duration-100
                    flex items-start gap-2.5 group
                    ${
                      isActive
                        ? "bg-zinc-100 dark:bg-zinc-800/80"
                        : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
                    }
                  `}
                >
                  {/* Status dot */}
                  <span
                    className={`mt-[5px] w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[epic.status]}`}
                  />
                  <span className="flex-1 min-w-0">
                    <span
                      className={`block text-sm leading-snug truncate ${
                        isActive
                          ? "text-zinc-900 dark:text-zinc-100 font-medium"
                          : "text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-200"
                      }`}
                    >
                      {epic.title}
                    </span>
                    {featureCount > 0 && (
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-600">
                        {doneCount}/{featureCount} Features
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}

// ─── VIEW TOGGLE ─────────────────────────────────────────────────────────────

type View = "human" | "machine";

function ViewToggle({
  view,
  onChange,
}: {
  view: View;
  onChange: (v: View) => void;
}) {
  return (
    <div className="flex items-center gap-0 p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-[0.5px] border-zinc-200 dark:border-zinc-700">
      {(["human", "machine"] as const).map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`
            px-3 py-1 rounded-md text-xs font-medium transition-all duration-150
            ${
              view === v
                ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
            }
          `}
        >
          {v === "human" ? "Human" : "Machine"}
        </button>
      ))}
    </div>
  );
}

// ─── MAIN LAYOUT ─────────────────────────────────────────────────────────────

export function PlanningLayout({ project }: { project: PlanningProject }) {
  const [activeEpicId, setActiveEpicId] = useState<string | null>(
    project.epics[0]?.id ?? null
  );
  const [view, setView] = useState<View>("human");

  const activeEpic = project.epics.find((e) => e.id === activeEpicId) ?? null;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <EpicSidebar
        epics={project.epics}
        activeId={activeEpicId}
        onSelect={setActiveEpicId}
        projectName={project.name}
      />

      {/* Main area */}
      <main className="flex-1 flex flex-col overflow-hidden bg-zinc-50 dark:bg-zinc-950">
        {/* Header bar */}
        <header className="shrink-0 h-12 px-6 flex items-center justify-between border-b border-[0.5px] border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="flex items-center gap-2">
            {activeEpic ? (
              <>
                <span
                  className={`w-2 h-2 rounded-full ${STATUS_DOT[activeEpic.status]}`}
                />
                <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {activeEpic.title}
                </h1>
                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                  {STATUS_LABEL[activeEpic.status]}
                </span>
              </>
            ) : (
              <h1 className="text-sm font-semibold text-zinc-500">
                Kein Epic ausgewählt
              </h1>
            )}
          </div>

          <ViewToggle view={view} onChange={setView} />
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeEpic === null ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-zinc-400 dark:text-zinc-600">
                Wähle ein Epic aus der Sidebar
              </p>
            </div>
          ) : view === "human" ? (
            <FeatureBoard
              features={activeEpic.features}
              projectId={project.id}
            />
          ) : (
            <YamlView features={activeEpic.features} epicTitle={activeEpic.title} />
          )}
        </div>
      </main>
    </div>
  );
}
