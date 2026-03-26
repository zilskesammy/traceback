// lib/docs/navigation.ts — Navigationsbaum aus MDX-Metadaten aufbauen

import type { DocMeta } from "./mdx";

export interface NavSection {
  title: string;
  order: number;
  items: NavItem[];
}

export interface NavItem {
  title: string;
  href: string;
  slug: string;
}

const SECTION_META: Record<string, { title: string; order: number }> = {
  "":                    { title: "Übersicht",          order: 0 },
  "getting-started":     { title: "Erste Schritte",     order: 1 },
  "concepts":            { title: "Konzepte",            order: 2 },
  "agent-api":           { title: "Agent API",           order: 3 },
  "github-integration":  { title: "GitHub Integration",  order: 4 },
};

export function buildNavigation(docs: DocMeta[]): NavSection[] {
  const sectionsMap = new Map<string, NavSection>();

  for (const doc of docs) {
    // Section aus dem slug ableiten (erster Teil)
    const parts = doc.slug.split("/");
    const sectionKey = parts.length > 1 ? parts[0] : "";

    if (!sectionsMap.has(sectionKey)) {
      const meta = SECTION_META[sectionKey] ?? {
        title: sectionKey.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        order: 99,
      };
      sectionsMap.set(sectionKey, { ...meta, items: [] });
    }

    sectionsMap.get(sectionKey)!.items.push({
      title: doc.title,
      href: doc.href,
      slug: doc.slug,
    });
  }

  return Array.from(sectionsMap.values()).sort((a, b) => a.order - b.order);
}
