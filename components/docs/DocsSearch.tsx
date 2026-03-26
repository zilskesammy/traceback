"use client";
// components/docs/DocsSearch.tsx — Client-side Fuse.js Suche

import { useState, useEffect, useRef } from "react";
import Fuse from "fuse.js";
import Link from "next/link";

interface SearchDoc {
  slug: string;
  href: string;
  title: string;
  content: string;
}

export function DocsSearch({ docs }: { docs: SearchDoc[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchDoc[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const fuseRef = useRef<Fuse<SearchDoc> | null>(null);

  useEffect(() => {
    fuseRef.current = new Fuse(docs, {
      keys: [
        { name: "title", weight: 2 },
        { name: "content", weight: 1 },
      ],
      threshold: 0.35,
      minMatchCharLength: 2,
    });
  }, [docs]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const hits = fuseRef.current?.search(query).slice(0, 8).map((r) => r.item) ?? [];
    setResults(hits);
  }, [query]);

  // Cmd+K öffnet Suche
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  return (
    <>
      {/* Trigger */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 text-sm text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 transition-colors w-full"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
        </svg>
        <span className="flex-1 text-left text-xs">Suchen…</span>
        <span className="text-[10px] border border-zinc-700 rounded px-1 py-0.5">⌘K</span>
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Dialog */}
          <div className="relative w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 shadow-xl overflow-hidden">
            {/* Input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
              <svg className="w-4 h-4 text-zinc-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Docs durchsuchen…"
                className="flex-1 bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none"
              />
              {query && (
                <button onClick={() => setQuery("")} className="text-zinc-500 hover:text-zinc-300">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Results */}
            {results.length > 0 && (
              <ul className="max-h-72 overflow-y-auto divide-y divide-zinc-800/50 py-1">
                {results.map((doc) => (
                  <li key={doc.href}>
                    <Link
                      href={doc.href}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/60 transition-colors"
                    >
                      <svg className="w-4 h-4 text-zinc-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-zinc-200">{doc.title}</p>
                        <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{doc.content.slice(0, 100)}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            {query && results.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-zinc-600">
                Keine Ergebnisse für „{query}"
              </div>
            )}

            {!query && (
              <div className="px-4 py-6 text-center text-xs text-zinc-600">
                Tippe um die Dokumentation zu durchsuchen
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
