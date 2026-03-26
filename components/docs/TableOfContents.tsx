"use client";
// components/docs/TableOfContents.tsx — Rechtes Inhaltsverzeichnis (on-this-page)

import { useEffect, useState } from "react";

interface Heading {
  id: string;
  text: string;
  level: 2 | 3;
}

export function TableOfContents() {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    // Headings aus dem DOM lesen
    const els = document.querySelectorAll<HTMLElement>("article h2, article h3");
    const found: Heading[] = [];
    els.forEach((el) => {
      if (el.id) {
        found.push({
          id: el.id,
          text: el.textContent ?? "",
          level: el.tagName === "H2" ? 2 : 3,
        });
      }
    });
    setHeadings(found);
  }, []);

  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: "0px 0px -70% 0px" }
    );

    headings.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <aside className="w-52 shrink-0 hidden xl:block">
      <div className="sticky top-8 py-8">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
          Auf dieser Seite
        </p>
        <nav>
          <ul className="space-y-1">
            {headings.map(({ id, text, level }) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className={`
                    block text-xs leading-5 transition-colors
                    ${level === 3 ? "pl-3" : ""}
                    ${activeId === id
                      ? "text-indigo-400 font-medium"
                      : "text-zinc-500 hover:text-zinc-300"
                    }
                  `}
                >
                  {text}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </aside>
  );
}
