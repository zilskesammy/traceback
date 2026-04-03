"use client";
// components/changelog/ProjectLayout.tsx

import { useState } from "react";
import { PanelLeft, ChevronRight, Home } from "lucide-react";
import Link from "next/link";
import { ProjectSidebar } from "./ProjectSidebar";
import { ChangelogView } from "./ChangelogView";
import { CommitsView } from "@/components/planning/CommitsView";
import type { UIProject, UIChangelogFeature } from "@/types/changelog";

type View = "changelog" | "commits";

const VIEW_LABELS: Record<View, string> = {
  changelog: "Changelog",
  commits: "Commits",
};

export function ProjectLayout({
  project,
  initialFeatures,
  userName,
  userEmail,
}: {
  project: UIProject;
  initialFeatures: UIChangelogFeature[];
  userName: string | null;
  userEmail: string | null;
}) {
  const [view, setView] = useState<View>("changelog");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-full overflow-hidden bg-gray-50 dark:bg-slate-950">
      {/* Sidebar */}
      <aside
        className={`flex-shrink-0 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 overflow-hidden transition-all duration-200 ${
          sidebarOpen ? "w-52" : "w-0 border-r-0"
        }`}
      >
        <ProjectSidebar
          project={project}
          view={view}
          onViewChange={setView}
          userName={userName}
          userEmail={userEmail}
        />
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Breadcrumb bar */}
        <div className="flex-shrink-0 h-10 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 flex items-center px-3 gap-2">
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            className="w-7 h-7 rounded-md border border-gray-200 dark:border-slate-700 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors text-gray-500 dark:text-slate-400 flex-shrink-0"
            title="Sidebar ein-/ausblenden"
          >
            <PanelLeft className="w-3.5 h-3.5" />
          </button>
          <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-slate-500">
            <Link href="/dashboard" className="hover:text-gray-600 dark:hover:text-slate-300 transition-colors flex items-center gap-1">
              <Home className="w-3 h-3" />
              Dashboard
            </Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-gray-600 dark:text-slate-300">{project.name}</span>
            <ChevronRight className="w-3 h-3" />
            <span className="font-medium text-gray-900 dark:text-slate-100">{VIEW_LABELS[view]}</span>
          </div>
        </div>

        {/* Views — both mounted, toggled via hidden */}
        <div className={`flex-1 overflow-hidden ${view === "changelog" ? "" : "hidden"}`}>
          <ChangelogView projectId={project.id} initialFeatures={initialFeatures} />
        </div>
        <div className={`flex-1 overflow-hidden ${view === "commits" ? "" : "hidden"}`}>
          <CommitsView
            projectId={project.id}
            repoUrl={`https://github.com/${project.repoOwner}/${project.repoName}`}
          />
        </div>
      </main>
    </div>
  );
}
