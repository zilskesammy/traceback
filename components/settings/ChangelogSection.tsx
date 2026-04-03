"use client";
// components/settings/ChangelogSection.tsx — Changelog branch selector for Settings

import { useState, useEffect } from "react";

interface ChangelogSectionProps {
  projectId: string;
  currentBranch: string | null;
  defaultBranch: string;
}

export function ChangelogSection({
  projectId,
  currentBranch,
  defaultBranch,
}: ChangelogSectionProps) {
  const [branches, setBranches] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>(currentBranch ?? defaultBranch);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/branches`)
      .then((r) => r.json())
      .then((data: { branches?: string[] }) => {
        const list = data.branches ?? [];
        const merged =
          currentBranch && !list.includes(currentBranch)
            ? [currentBranch, ...list]
            : list;
        setBranches(merged);
        setLoading(false);
      })
      .catch(() => {
        setError("Branches konnten nicht geladen werden.");
        setLoading(false);
      });
  }, [projectId, currentBranch]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changelogBranch: selected }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError((data as { error?: string }).error ?? "Fehler beim Speichern.");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Netzwerkfehler.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mb-10">
      <h2 className="text-base font-semibold text-gray-700 dark:text-slate-300 mb-1">Changelog</h2>
      <p className="text-sm text-gray-500 dark:text-slate-400 mb-5">
        Branch aus dem der Changelog synchronisiert wird.
      </p>

      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-5 py-4">
        <label className="text-xs font-medium text-gray-500 dark:text-slate-400 block mb-2">
          Changelog Branch
        </label>

        {loading ? (
          <div className="h-9 bg-gray-100 dark:bg-slate-800 rounded-lg animate-pulse" />
        ) : (
          <div className="flex gap-2">
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="flex-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              {branches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-xs font-medium text-white transition-colors"
            >
              {saved ? "✓ Gespeichert" : saving ? "..." : "Speichern"}
            </button>
          </div>
        )}

        {error && (
          <p className="text-xs text-red-500 dark:text-red-400 mt-2">{error}</p>
        )}

        <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-2">
          Standard:{" "}
          <code className="text-gray-500 dark:text-slate-400">{defaultBranch}</code>
          {!currentBranch && " (aktuell aktiv)"}
        </p>
      </div>
    </section>
  );
}
