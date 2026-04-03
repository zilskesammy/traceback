"use client";
// components/settings/ApiKeysSection.tsx — Client Component
// Verwaltet API-Keys: Anzeige, Erstellen (mit Key-Reveal-Modal), Löschen.

import { useState, useRef } from "react";
import { Trash2, Copy, X, AlertTriangle, Check, Plus, Loader2 } from "lucide-react";

// ─── Typen ────────────────────────────────────────────────────────────────────

interface ApiKeyRow {
  id: string;
  label: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  createdAt: string;
}

interface ApiKeysSectionProps {
  projectId: string;
  initialKeys: ApiKeyRow[];
}

// ─── Datum-Hilfsfunktion ──────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "Nie";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

// ─── Erstellen-Modal ──────────────────────────────────────────────────────────

interface CreateModalProps {
  projectId: string;
  onCreated: (key: ApiKeyRow, rawKey: string) => void;
  onClose: () => void;
}

function CreateModal({ projectId, onCreated, onClose }: CreateModalProps) {
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, label: label.trim() }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(body.error ?? `Fehler ${res.status}`);
        return;
      }

      const data = (await res.json()) as {
        id: string;
        label: string;
        rawKey: string;
      };

      onCreated(
        {
          id: data.id,
          label: data.label,
          keyPrefix: data.rawKey.slice(0, 8),
          lastUsedAt: null,
          createdAt: new Date().toISOString(),
        },
        data.rawKey
      );
    } catch {
      setError("Netzwerkfehler");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
        role="dialog"
        aria-modal="true"
        aria-label="Neuen API-Key erstellen"
      >
        <div className="pointer-events-auto w-full max-w-md bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-slate-800">
            <h2 className="text-sm font-medium text-gray-900 dark:text-slate-100">
              Neuen API-Key erstellen
            </h2>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-gray-400 dark:text-slate-500 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Schließen"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="px-5 py-5 space-y-4">
            <div>
              <label
                htmlFor="key-label"
                className="block text-xs text-gray-500 dark:text-slate-400 mb-1.5"
              >
                Label
              </label>
              <input
                ref={inputRef}
                id="key-label"
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="z.B. Claude Agent, CI Pipeline"
                autoFocus
                className="
                  w-full px-3 py-2 text-sm rounded-lg
                  bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700
                  text-gray-900 dark:text-slate-100 placeholder-gray-400
                  focus:outline-none focus:border-indigo-500
                  transition-colors
                "
              />
            </div>

            {error && (
              <p className="text-xs text-red-500">{error}</p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={loading || !label.trim()}
                className="
                  px-3 py-1.5 text-xs rounded-lg
                  bg-indigo-600 text-white font-medium
                  hover:bg-indigo-700
                  disabled:opacity-40 disabled:cursor-not-allowed
                  transition-colors
                "
              >
                {loading ? "Erstelle…" : "Erstellen"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

// ─── Key-Reveal-Modal ─────────────────────────────────────────────────────────

interface RevealModalProps {
  rawKey: string;
  onClose: () => void;
}

function RevealModal({ rawKey, onClose }: RevealModalProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(rawKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
        role="dialog"
        aria-modal="true"
        aria-label="API-Key kopieren"
      >
        <div className="pointer-events-auto w-full max-w-lg bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-slate-800">
            <h2 className="text-sm font-medium text-gray-900 dark:text-slate-100">
              API-Key erstellt
            </h2>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-gray-400 dark:text-slate-500 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Schließen"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-5 py-5 space-y-4">
            <p className="text-xs text-amber-400 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              Kopiere diesen Key jetzt. Er wird nicht erneut angezeigt.
            </p>

            <div className="relative">
              <div className="font-mono text-xs bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-slate-200 p-3 rounded-lg break-all select-all">
                {rawKey}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={handleCopy}
                className="
                  flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg
                  bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800
                  transition-colors
                "
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    Kopiert
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Kopieren
                  </>
                )}
              </button>
              <button
                onClick={onClose}
                className="px-3 py-1.5 text-xs rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
              >
                Fertig
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

export function ApiKeysSection({
  projectId,
  initialKeys,
}: ApiKeysSectionProps) {
  const [keys, setKeys] = useState<ApiKeyRow[]>(initialKeys);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [revealKey, setRevealKey] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleCreated(newKey: ApiKeyRow, rawKey: string) {
    setKeys((prev) => [newKey, ...prev]);
    setShowCreateModal(false);
    setRevealKey(rawKey);
  }

  async function handleDelete(keyId: string) {
    setDeletingId(keyId);
    try {
      const res = await fetch("/api/keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyId }),
      });
      if (res.ok) {
        setKeys((prev) => prev.filter((k) => k.id !== keyId));
      }
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-medium text-gray-700 dark:text-slate-300">API-Keys</h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">
            Keys für maschinenlesbare Ticket-Abfragen per{" "}
            <code className="font-mono text-gray-500 dark:text-slate-400">x-api-key</code> Header.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="
            flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg
            bg-indigo-600 text-white hover:bg-indigo-700
            transition-colors shrink-0
          "
        >
          <Plus className="w-3.5 h-3.5" />
          Neuen Key erstellen
        </button>
      </div>

      {/* Tabelle */}
      {keys.length === 0 ? (
        <div className="text-xs text-gray-400 dark:text-slate-500 py-6 text-center border border-gray-200 dark:border-slate-700 rounded-xl">
          Noch keine API-Keys vorhanden.
        </div>
      ) : (
        <div className="border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800">
                <th className="text-left px-4 py-2.5 text-gray-500 dark:text-slate-400 font-medium">
                  Label
                </th>
                <th className="text-left px-4 py-2.5 text-gray-500 dark:text-slate-400 font-medium">
                  Prefix
                </th>
                <th className="text-left px-4 py-2.5 text-gray-500 dark:text-slate-400 font-medium">
                  Zuletzt verwendet
                </th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {keys.map((key, i) => (
                <tr
                  key={key.id}
                  className={
                    i < keys.length - 1
                      ? "border-b border-gray-100 dark:border-slate-800"
                      : ""
                  }
                >
                  <td className="px-4 py-3 text-gray-800 dark:text-slate-200">{key.label}</td>
                  <td className="px-4 py-3">
                    <code className="font-mono text-gray-500 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[11px]">
                      {key.keyPrefix}…
                    </code>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-slate-200">
                    {formatDate(key.lastUsedAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(key.id)}
                      disabled={deletingId === key.id}
                      className="
                        p-1 rounded text-gray-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30
                        disabled:opacity-40 disabled:cursor-not-allowed
                        transition-colors
                      "
                      aria-label={`${key.label} löschen`}
                    >
                      {deletingId === key.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {showCreateModal && (
        <CreateModal
          projectId={projectId}
          onCreated={handleCreated}
          onClose={() => setShowCreateModal(false)}
        />
      )}
      {revealKey !== null && (
        <RevealModal rawKey={revealKey} onClose={() => setRevealKey(null)} />
      )}
    </section>
  );
}
