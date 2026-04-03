// app/(app)/dashboard/page.tsx — Server Component

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ClipboardList,
  Plus,
  GitCommitHorizontal,
  BookOpen,
  ChevronRight,
  LogOut,
  Circle,
} from "lucide-react";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const projects = await db.project.findMany({
    where: { members: { some: { userId: session.user.id } } },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { commits: true, changelogFeatures: true } },
    },
  });

  const totalCommits = projects.reduce((s, p) => s + p._count.commits, 0);
  const totalFeatures = projects.reduce((s, p) => s + p._count.changelogFeatures, 0);

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100">
      {/* Top Nav */}
      <header className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-6 h-12 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
              <ClipboardList className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-sm tracking-tight text-gray-900 dark:text-slate-100">traceback</span>
          </div>
          <nav className="flex items-center gap-1">
            <span className="px-3 py-1.5 rounded-md text-sm font-medium bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-slate-100">
              Projekte
            </span>
            <Link
              href="/docs"
              className="px-3 py-1.5 rounded-md text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
            >
              Docs
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/projects/new"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Neues Projekt
          </Link>
          <span className="text-sm text-gray-500 dark:text-slate-400">{session.user.name ?? session.user.email}</span>
          <form action="/api/auth/signout" method="POST">
            <button
              type="submit"
              className="p-1.5 rounded-lg text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              title="Abmelden"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </form>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-slate-100">Deine Projekte</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{projects.length} Projekt{projects.length !== 1 ? "e" : ""} verbunden</p>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4">
            <p className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-2">Projekte</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">{projects.length}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4">
            <p className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-2">Commits gesamt</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">{totalCommits}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4">
            <p className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-2">Changelog Features</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">{totalFeatures}</p>
          </div>
        </div>

        {projects.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-dashed border-gray-300 dark:border-slate-700 rounded-xl p-16 text-center">
            <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
              <ClipboardList className="w-6 h-6 text-gray-400 dark:text-slate-500" />
            </div>
            <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Noch keine Projekte</h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">Erstelle dein erstes Projekt und verbinde ein GitHub Repo.</p>
            <Link
              href="/projects/new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Erstes Projekt anlegen
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="group bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 rounded-xl p-5 transition-colors block"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center">
                    <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 dark:text-slate-600 group-hover:text-gray-400 dark:group-hover:text-slate-400 transition-colors" />
                </div>
                <h3 className="font-semibold text-sm text-gray-900 dark:text-slate-100 mb-1">{project.name}</h3>
                {project.description && (
                  <p className="text-xs text-gray-500 dark:text-slate-400 line-clamp-2 mb-2">{project.description}</p>
                )}
                <p className="text-xs text-gray-400 dark:text-slate-500 font-mono">{project.repoOwner}/{project.repoName}</p>
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 dark:border-slate-800">
                  <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400">
                    <GitCommitHorizontal className="w-3.5 h-3.5" />
                    {project._count.commits} Commits
                  </span>
                  <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400">
                    <Circle className="w-3 h-3 fill-emerald-500 text-emerald-500" />
                    {project._count.changelogFeatures} Features
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
