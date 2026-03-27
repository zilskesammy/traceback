"use client";
// components/settings/ApiKeysSection.tsx — Client Component
// Verwaltet API-Keys: Anzeige, Erstellen (mit Key-Reveal-Modal), Löschen.

import { useState, useRef } from "react";

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
        <div className="pointer-events-auto w-full max-w-md bg-zinc-950 border border-[0.5px] border-zinc-800 rounded-xl shadow-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[0.5px] border-zinc-800">
            <h2 className="text-sm font-medium text-zinc-100">
              Neuen API-Key erstellen
            </h2>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
              aria-label="Schließen"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="px-5 py-5 space-y-4">
            <div>
              <label
                htmlFor="key-label"
                className="block text-xs text-zinc-400 mb-1.5"
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
                  bg-zinc-900 border border-[0.5px] border-zinc-700
                  text-zinc-100 placeholder-zinc-600
                  focus:outline-none focus:border-zinc-500
                  transition-colors
                "
              />
            </div>

            {error && (
              <p className="text-xs text-red-400">{error}</p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={loading || !label.trim()}
                className="
                  px-3 py-1.5 text-xs rounded-lg
                  bg-zinc-100 text-zinc-900 font-medium
                  hover:bg-white
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
        <div className="pointer-events-auto w-full max-w-lg bg-zinc-950 border border-[0.5px] border-zinc-800 rounded-xl shadow-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[0.5px] border-zinc-800">
            <h2 className="text-sm font-medium text-zinc-100">
              API-Key erstellt
            </h2>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
              aria-label="Schließen"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div className="px-5 py-5 space-y-4">
            <p className="text-xs text-amber-400 flex items-center gap-1.5">
              <svg
                className="w-3.5 h-3.5 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
              Kopiere diesen Key jetzt. Er wird nicht erneut angezeigt.
            </p>

            <div className="relative">
              <div className="font-mono text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 p-3 rounded-lg break-all select-all">
                {rawKey}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={handleCopy}
                className="
                  flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg
                  bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100
                  transition-colors
                "
              >
                {copied ? (
                  <>
                    <svg
                      className="w-3.5 h-3.5 text-emerald-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4.5 12.75l6 6 9-13.5"
                      />
                    </svg>
                    Kopiert
                  </>
                ) : (
                  <>
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"
                      />
                    </svg>
                    Kopieren
                  </>
                )}
              </button>
              <button
                onClick={onClose}
                className="px-3 py-1.5 text-xs rounded-lg bg-zinc-100 text-zinc-900 font-medium hover:bg-white transition-colors"
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
          <h2 className="text-sm font-medium text-zinc-100">API-Keys</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Keys für maschinenlesbare Ticket-Abfragen per{" "}
            <code className="font-mono text-zinc-400">x-api-key</code> Header.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="
            flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg
            bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100
            border border-[0.5px] border-zinc-700
            transition-colors shrink-0
          "
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
          Neuen Key erstellen
        </button>
      </div>

      {/* Tabelle */}
      {keys.length === 0 ? (
        <div className="text-xs text-zinc-600 py-6 text-center border border-[0.5px] border-zinc-800 rounded-lg">
          Noch keine API-Keys vorhanden.
        </div>
      ) : (
        <div className="border border-[0.5px] border-zinc-800 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[0.5px] border-zinc-800 bg-zinc-900/50">
                <th className="text-left px-4 py-2.5 text-zinc-500 font-medium">
                  Label
                </th>
                <th className="text-left px-4 py-2.5 text-zinc-500 font-medium">
                  Prefix
                </th>
                <th className="text-left px-4 py-2.5 text-zinc-500 font-medium">
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
                      ? "border-b border-[0.5px] border-zinc-800/70"
                      : ""
                  }
                >
                  <td className="px-4 py-3 text-zinc-200">{key.label}</td>
                  <td className="px-4 py-3">
                    <code className="font-mono text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded text-[11px]">
                      {key.keyPrefix}…
                    </code>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {formatDate(key.lastUsedAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(key.id)}
                      disabled={deletingId === key.id}
                      className="
                        p-1 rounded text-zinc-600 hover:text-red-400 hover:bg-red-950/30
                        disabled:opacity-40 disabled:cursor-not-allowed
                        transition-colors
                      "
                      aria-label={`${key.label} löschen`}
                    >
                      {deletingId === key.id ? (
                        <svg
                          className="w-3.5 h-3.5 animate-spin"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                          />
                        </svg>
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
