"use client";
// components/changelog/ProjectSidebar.tsx

import Link from "next/link";
import {
  ClipboardList,
  GitCommitHorizontal,
  Settings,
  Key,
  Search,
  ChevronDown,
} from "lucide-react";
import type { UIProject } from "@/types/changelog";

type View = "changelog" | "commits";

interface ProjectSidebarProps {
  project: UIProject;
  view: View;
  onViewChange: (v: View) => void;
  userName: string | null;
  userEmail: string | null;
}

export function ProjectSidebar({
  project,
  view,
  onViewChange,
  userName,
  userEmail,
}: ProjectSidebarProps) {
  const initials = (userName ?? userEmail ?? "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* Brand */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
            <ClipboardList className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 dark:text-slate-100 truncate leading-tight">{project.name}</p>
            <p className="text-[10px] text-gray-400 dark:text-slate-500 font-mono truncate">{project.repoOwner}/{project.repoName}</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-slate-800 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Suchen..."
            className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-gray-700 dark:text-slate-300 placeholder-gray-400 dark:placeholder-slate-500 outline-none focus:border-indigo-400 dark:focus:border-indigo-600"
          />
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-2 overflow-y-auto">
        {/* Übersicht */}
        <p className="px-2 py-1 text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-1">Übersicht</p>
        <button
          onClick={() => onViewChange("changelog")}
          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm mb-0.5 transition-colors text-left ${
            view === "changelog"
              ? "bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 font-semibold shadow-sm ring-1 ring-gray-200 dark:ring-slate-700"
              : "text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-slate-200"
          }`}
        >
          <ClipboardList className="w-3.5 h-3.5 flex-shrink-0" />
          Changelog
        </button>
        <button
          onClick={() => onViewChange("commits")}
          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm mb-0.5 transition-colors text-left ${
            view === "commits"
              ? "bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 font-semibold shadow-sm ring-1 ring-gray-200 dark:ring-slate-700"
              : "text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-slate-200"
          }`}
        >
          <GitCommitHorizontal className="w-3.5 h-3.5 flex-shrink-0" />
          Commits
        </button>

        {/* Konfiguration */}
        <p className="px-2 py-1 text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-1 mt-3">Konfiguration</p>
        <Link
          href={`/projects/${project.id}/settings`}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-slate-200 transition-colors mb-0.5"
        >
          <Settings className="w-3.5 h-3.5 flex-shrink-0" />
          Settings
        </Link>
        <Link
          href={`/projects/${project.id}/settings`}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-slate-200 transition-colors"
        >
          <Key className="w-3.5 h-3.5 flex-shrink-0" />
          API Keys
        </Link>
      </nav>

      {/* User row */}
      <div className="px-3 py-2.5 border-t border-gray-200 dark:border-slate-800 flex-shrink-0">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors group"
        >
          <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center flex-shrink-0">
            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">{initials}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-gray-700 dark:text-slate-300 truncate">{userName ?? userEmail ?? "User"}</p>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500 flex-shrink-0" />
        </Link>
      </div>
    </div>
  );
}
