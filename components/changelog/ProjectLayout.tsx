"use client";
// components/changelog/ProjectLayout.tsx — Shell for project view

import { useState } from "react";
import Link from "next/link";
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
}: {
  project: UIProject;
  initialFeatures: UIChangelogFeature[];
}) {
  const [view, setView] = useState<View>("changelog");

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <aside className="w-52 shrink-0 h-full flex flex-col border-r border-zinc-800 bg-zinc-950">
        <div className="px-4 py-4 border-b border-zinc-800">
          <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 mb-0.5">Project</p>
          <p className="text-sm font-semibold text-zinc-100 truncate">{project.name}</p>
          <p className="text-[10px] text-zinc-600 font-mono mt-0.5">{project.repoOwner}/{project.repoName}</p>
        </div>

        {/* View toggle */}
        <div className="px-3 py-3 space-y-0.5">
          {(["changelog", "commits"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`w-full text-left px-2 py-2 rounded-lg text-sm transition-colors ${
                view === v
                  ? "bg-zinc-800 text-zinc-100 font-medium"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900"
              }`}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>

        {/* Settings link */}
        <div className="mt-auto px-3 py-3 border-t border-zinc-800">
          <Link
            href={`/projects/${project.id}/settings`}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors text-xs"
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </Link>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-hidden">
        {view === "changelog" ? (
          <ChangelogView projectId={project.id} initialFeatures={initialFeatures} />
        ) : (
          <CommitsView
            projectId={project.id}
            repoUrl={`https://github.com/${project.repoOwner}/${project.repoName}`}
          />
        )}
      </main>
    </div>
  );
}
