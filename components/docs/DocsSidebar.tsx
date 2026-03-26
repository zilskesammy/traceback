"use client";
// components/docs/DocsSidebar.tsx — Linke Navigations-Sidebar für Docs

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavSection } from "@/lib/docs/navigation";

export function DocsSidebar({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 h-full overflow-y-auto border-r border-zinc-800 bg-zinc-950 py-8 px-4">
      {/* Logo */}
      <Link href="/dashboard" className="flex items-center gap-2 px-2 mb-8 group">
        <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center">
          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <span className="text-sm font-semibold text-zinc-200 group-hover:text-white transition-colors">
          Traceback
        </span>
        <span className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500">
          Docs
        </span>
      </Link>

      {/* Navigation */}
      <nav className="space-y-6">
        {sections.map((section) => (
          <div key={section.title}>
            {section.title !== "Übersicht" && (
              <p className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                {section.title}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href === "/docs" && pathname === "/docs");
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`
                        flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors
                        ${isActive
                          ? "bg-indigo-600/15 text-indigo-300 font-medium"
                          : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
                        }
                      `}
                    >
                      {isActive && (
                        <span className="w-1 h-1 rounded-full bg-indigo-400 shrink-0" />
                      )}
                      <span className={isActive ? "" : "pl-3"}>{item.title}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Back to App */}
      <div className="mt-8 pt-6 border-t border-zinc-800">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Zurück zur App
        </Link>
      </div>
    </aside>
  );
}
