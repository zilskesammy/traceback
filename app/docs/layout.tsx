// app/docs/layout.tsx — Docs Shell: Sidebar links, Content mitte, ToC rechts

import { getAllDocsMeta, getAllDocsForSearch } from "@/lib/docs/mdx";
import { buildNavigation } from "@/lib/docs/navigation";
import { DocsSidebar } from "@/components/docs/DocsSidebar";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { DocsSearch } from "@/components/docs/DocsSearch";
import type { ReactNode } from "react";

export default function DocsLayout({ children }: { children: ReactNode }) {
  const allDocs = getAllDocsMeta();
  const searchDocs = getAllDocsForSearch();
  const sections = buildNavigation(allDocs);

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950 text-white">

      {/* ── Left Sidebar ───────────────────────────────────── */}
      <aside className="w-64 shrink-0 h-full flex flex-col border-r border-zinc-800 overflow-hidden">
        {/* Search box */}
        <div className="px-4 pt-5 pb-3 border-b border-zinc-800">
          <DocsSearch docs={searchDocs} />
        </div>
        {/* Nav */}
        <div className="flex-1 overflow-y-auto">
          <DocsSidebar sections={sections} />
        </div>
      </aside>

      {/* ── Main + ToC ─────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-8 py-12">
            {children}
          </div>
        </main>

        {/* ToC */}
        <aside className="hidden xl:block w-52 shrink-0 border-l border-zinc-800 overflow-y-auto px-5">
          <TableOfContents />
        </aside>
      </div>

    </div>
  );
}
