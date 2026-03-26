"use client";
// app/(app)/projects/new/NewProjectForm.tsx — Client Component für Repo-Auswahl + Formular

import { useState, useTransition } from "react";
import type { GitHubRepo } from "./page";

interface Props {
  repos: GitHubRepo[];
  createProject: (formData: FormData) => Promise<void>;
}

const LANG_COLORS: Record<string, string> = {
  TypeScript: "bg-blue-500",
  JavaScript: "bg-yellow-400",
  Python: "bg-green-500",
  Rust: "bg-orange-500",
  Go: "bg-cyan-400",
  Java: "bg-red-500",
  "C#": "bg-violet-500",
  Swift: "bg-orange-400",
  Kotlin: "bg-violet-400",
};

export function NewProjectForm({ repos, createProject }: Props) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<GitHubRepo | null>(null);
  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");
  const [isPending, startTransition] = useTransition();

  const filtered = repos.filter((r) =>
    r.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (r.description ?? "").toLowerCase().includes(search.toLowerCase())
  );

  function selectRepo(repo: GitHubRepo) {
    setSelected(repo);
    // Projektname automatisch vorausfüllen
    if (!projectName) {
      setProjectName(repo.name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));
    }
    if (!description && repo.description) {
      setDescription(repo.description);
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;

    const formData = new FormData();
    formData.set("name", projectName);
    formData.set("description", description);
    formData.set("repoUrl", selected.html_url);
    formData.set("repoOwner", selected.owner.login);
    formData.set("repoName", selected.name);
    formData.set("defaultBranch", selected.default_branch);

    startTransition(async () => {
      await createProject(formData);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ── REPO PICKER ──────────────────────────────────────────── */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">
          GitHub Repository <span className="text-red-400">*</span>
        </label>

        {repos.length === 0 ? (
          <div className="border border-zinc-800 rounded-xl p-6 text-center text-sm text-zinc-500">
            Keine Repositories gefunden. Stelle sicher, dass du eingeloggt bist.
          </div>
        ) : (
          <div className="border border-zinc-800 rounded-xl overflow-hidden">
            {/* Search */}
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-zinc-800 bg-zinc-900">
              <svg className="w-4 h-4 text-zinc-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <input
                type="text"
                placeholder="Repository suchen..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none"
              />
              {search && (
                <button type="button" onClick={() => setSearch("")} className="text-zinc-500 hover:text-zinc-300">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Repo list */}
            <ul className="max-h-64 overflow-y-auto divide-y divide-zinc-800/50 bg-zinc-950">
              {filtered.length === 0 && (
                <li className="px-4 py-6 text-center text-sm text-zinc-600">
                  Kein Repository gefunden
                </li>
              )}
              {filtered.map((repo) => {
                const isSelected = selected?.id === repo.id;
                return (
                  <li key={repo.id}>
                    <button
                      type="button"
                      onClick={() => selectRepo(repo)}
                      className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors ${
                        isSelected
                          ? "bg-indigo-600/20 border-l-2 border-indigo-500"
                          : "hover:bg-zinc-900 border-l-2 border-transparent"
                      }`}
                    >
                      {/* Lock icon for private */}
                      <div className="mt-0.5 shrink-0">
                        {repo.private ? (
                          <svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a4 4 0 014-4h.01M17 21H7a2 2 0 01-2-2V9a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2z" />
                          </svg>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium truncate ${isSelected ? "text-indigo-300" : "text-zinc-200"}`}>
                            {repo.full_name}
                          </span>
                          {repo.private && (
                            <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500">
                              private
                            </span>
                          )}
                        </div>
                        {repo.description && (
                          <p className="text-xs text-zinc-500 mt-0.5 truncate">{repo.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1">
                          {repo.language && (
                            <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                              <span className={`w-2 h-2 rounded-full ${LANG_COLORS[repo.language] ?? "bg-zinc-500"}`} />
                              {repo.language}
                            </span>
                          )}
                          <span className="text-[11px] text-zinc-600">
                            branch: {repo.default_branch}
                          </span>
                        </div>
                      </div>

                      {isSelected && (
                        <svg className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {selected && (
          <p className="mt-2 text-xs text-indigo-400 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            {selected.full_name} ausgewählt
          </p>
        )}
      </div>

      {/* ── PROJECT NAME ─────────────────────────────────────────── */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1.5">
          Projektname <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          required
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          placeholder="Mein Projekt"
          className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
        />
      </div>

      {/* ── DESCRIPTION ──────────────────────────────────────────── */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1.5">
          Beschreibung{" "}
          <span className="text-zinc-600 font-normal">(optional)</span>
        </label>
        <textarea
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Kurze Beschreibung..."
          className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-indigo-500 transition-colors resize-none"
        />
      </div>

      {/* ── SUBMIT ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={!selected || !projectName.trim() || isPending}
          className="flex-1 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          {isPending ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Wird angelegt…
            </>
          ) : (
            "Projekt anlegen"
          )}
        </button>
        <a
          href="/dashboard"
          className="px-4 py-2.5 rounded-lg border border-zinc-800 hover:border-zinc-700 text-sm text-zinc-400 hover:text-white transition-colors"
        >
          Abbrechen
        </a>
      </div>
    </form>
  );
}
