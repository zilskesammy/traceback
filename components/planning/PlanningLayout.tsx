"use client";
// components/planning/PlanningLayout.tsx — Haupt-Shell der Planning UI
// Sidebar (Epics) + Hauptbereich (FeatureBoard, KanbanBoard oder YamlView) + View-Toggle

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FeatureBoard } from "./FeatureBoard";
import { KanbanBoard } from "./KanbanBoard";
import { YamlView } from "./YamlView";
import { EpicModal } from "./modals/EpicModal";
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

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────

function EpicSidebar({
  epics,
  activeId,
  onSelect,
  projectName,
  projectId,
  onMutated,
}: {
  epics: PlanningEpic[];
  activeId: string | null;
  onSelect: (id: string) => void;
  projectName: string;
  projectId: string;
  onMutated: () => void;
}) {
  const [epicModalOpen, setEpicModalOpen] = useState(false);
  const [editingEpic, setEditingEpic] = useState<PlanningEpic | undefined>(undefined);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function openCreate() {
    setEditingEpic(undefined);
    setEpicModalOpen(true);
  }

  function openEdit(epic: PlanningEpic, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingEpic(epic);
    setEpicModalOpen(true);
  }

  async function handleDelete(epic: PlanningEpic, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Epic "${epic.title}" wirklich löschen? Alle Features und Tasks werden ebenfalls gelöscht.`)) return;

    setDeletingId(epic.id);
    try {
      const res = await fetch(`/api/projects/${projectId}/epics/${epic.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`Fehler ${res.status}`);
      onMutated();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Löschen fehlgeschlagen");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <aside className="w-60 shrink-0 h-full flex flex-col border-r border-[0.5px] border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
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
        <div className="px-2 py-3 flex-1 overflow-y-auto">
          {/* Section header with "+" button */}
          <div className="flex items-center justify-between px-2 mb-2">
            <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
              Epics
            </p>
            <button
              onClick={openCreate}
              title="Neues Epic"
              className="w-5 h-5 flex items-center justify-center rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <PlusIcon className="w-3 h-3" />
            </button>
          </div>

          {epics.length === 0 && (
            <p className="px-2 text-xs text-zinc-400 dark:text-zinc-600 italic">
              Noch keine Epics
            </p>
          )}

          <ul className="space-y-0.5">
            {epics.map((epic) => {
              const isActive = epic.id === activeId;
              const featureCount = epic.features.length;
              const doneCount = epic.features.filter((f) => f.status === "DONE").length;
              const isDeleting = deletingId === epic.id;

              return (
                <li key={epic.id}>
                  <button
                    onClick={() => onSelect(epic.id)}
                    disabled={isDeleting}
                    className={`
                      w-full text-left px-2 py-2 rounded-lg transition-colors duration-100
                      flex items-start gap-2.5 group
                      ${isDeleting ? "opacity-50 cursor-not-allowed" : ""}
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

                    {/* Action buttons — visible on hover */}
                    <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => openEdit(epic, e)}
                        onKeyDown={(e) => e.key === "Enter" && openEdit(epic, e as unknown as React.MouseEvent)}
                        title="Bearbeiten"
                        className="w-5 h-5 flex items-center justify-center rounded text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
                      >
                        <PencilIcon className="w-3 h-3" />
                      </span>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => handleDelete(epic, e)}
                        onKeyDown={(e) => e.key === "Enter" && handleDelete(epic, e as unknown as React.MouseEvent)}
                        title="Löschen"
                        className="w-5 h-5 flex items-center justify-center rounded text-zinc-400 hover:text-red-400 hover:bg-zinc-700 transition-colors"
                      >
                        <TrashIcon className="w-3 h-3" />
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Settings link — fest am unteren Rand der Sidebar */}
        <div className="shrink-0 px-3 py-3 border-t border-[0.5px] border-zinc-200 dark:border-zinc-800">
          <Link
            href={`/projects/${projectId}/settings`}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-xs"
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Einstellungen
          </Link>
        </div>
      </aside>

      <EpicModal
        isOpen={epicModalOpen}
        onClose={() => setEpicModalOpen(false)}
        projectId={projectId}
        epic={editingEpic}
        onSuccess={onMutated}
      />
    </>
  );
}

// ─── VIEW TOGGLE ─────────────────────────────────────────────────────────────

type View = "human" | "kanban" | "machine";

const VIEW_LABELS: Record<View, string> = {
  human: "List",
  kanban: "Kanban",
  machine: "YAML",
};

function ViewToggle({
  view,
  onChange,
}: {
  view: View;
  onChange: (v: View) => void;
}) {
  return (
    <div className="flex items-center gap-0 p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-[0.5px] border-zinc-200 dark:border-zinc-700">
      {(["human", "kanban", "machine"] as const).map((v) => (
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
          {VIEW_LABELS[v]}
        </button>
      ))}
    </div>
  );
}

// ─── MAIN LAYOUT ─────────────────────────────────────────────────────────────

export function PlanningLayout({ project }: { project: PlanningProject }) {
  const router = useRouter();
  const [activeEpicId, setActiveEpicId] = useState<string | null>(
    project.epics[0]?.id ?? null
  );
  const [view, setView] = useState<View>("human");

  const activeEpic = project.epics.find((e) => e.id === activeEpicId) ?? null;

  function handleMutated() {
    router.refresh();
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <EpicSidebar
        epics={project.epics}
        activeId={activeEpicId}
        onSelect={setActiveEpicId}
        projectName={project.name}
        projectId={project.id}
        onMutated={handleMutated}
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
              epicId={activeEpic.id}
              onMutated={handleMutated}
            />
          ) : view === "kanban" ? (
            <KanbanBoard
              features={activeEpic.features}
              projectId={project.id}
              epicId={activeEpic.id}
              onMutated={handleMutated}
            />
          ) : (
            <YamlView features={activeEpic.features} epicTitle={activeEpic.title} />
          )}
        </div>
      </main>
    </div>
  );
}
