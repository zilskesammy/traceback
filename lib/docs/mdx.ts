// lib/docs/mdx.ts — MDX Dateien laden, parsen, für Rendering vorbereiten

import fs from "fs";
import path from "path";
import matter from "gray-matter";

const DOCS_DIR = path.join(process.cwd(), "content/docs");

export interface DocFrontmatter {
  title: string;
  description?: string;
  order?: number;
  section?: string;
}

export interface DocMeta extends DocFrontmatter {
  slug: string;       // z.B. "getting-started/connect-repo"
  href: string;       // z.B. "/docs/getting-started/connect-repo"
}

export interface DocPage extends DocMeta {
  content: string;    // Raw MDX content ohne Frontmatter
}

// Alle MDX-Dateien rekursiv einlesen
function getAllMdxFiles(dir: string, base = ""): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...getAllMdxFiles(path.join(dir, entry.name), rel));
    } else if (entry.name.endsWith(".mdx")) {
      files.push(rel);
    }
  }
  return files;
}

// Slug aus Dateipfad ableiten: "getting-started/index.mdx" → "getting-started"
function fileToSlug(file: string): string {
  return file
    .replace(/\.mdx$/, "")
    .replace(/\/index$/, "")
    .replace(/^index$/, "");
}

// Alle Docs-Metadaten laden (für Navigation + Suche)
export function getAllDocsMeta(): DocMeta[] {
  if (!fs.existsSync(DOCS_DIR)) return [];

  const files = getAllMdxFiles(DOCS_DIR);
  return files
    .map((file) => {
      const fullPath = path.join(DOCS_DIR, file);
      const raw = fs.readFileSync(fullPath, "utf-8");
      const { data } = matter(raw);
      const slug = fileToSlug(file);
      return {
        slug,
        href: slug ? `/docs/${slug}` : "/docs",
        title: (data.title as string) ?? slug,
        description: (data.description as string) ?? undefined,
        order: (data.order as number) ?? 99,
        section: (data.section as string) ?? undefined,
      } satisfies DocMeta;
    })
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
}

// Einzelne Docs-Seite laden
export function getDocBySlug(slug: string[]): DocPage | null {
  if (!fs.existsSync(DOCS_DIR)) return null;

  const slugStr = slug.join("/");

  // Versuche direkt + als index.mdx
  const candidates = [
    path.join(DOCS_DIR, `${slugStr}.mdx`),
    path.join(DOCS_DIR, slugStr, "index.mdx"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      const raw = fs.readFileSync(candidate, "utf-8");
      const { data, content } = matter(raw);
      const resolvedSlug = fileToSlug(
        path.relative(DOCS_DIR, candidate)
      );
      return {
        slug: resolvedSlug,
        href: resolvedSlug ? `/docs/${resolvedSlug}` : "/docs",
        title: (data.title as string) ?? slugStr,
        description: (data.description as string) ?? undefined,
        order: (data.order as number) ?? 99,
        section: (data.section as string) ?? undefined,
        content,
      };
    }
  }
  return null;
}

// Docs-Startseite laden (index.mdx)
export function getDocsIndex(): DocPage | null {
  return getDocBySlug([]);
}

// Alle Seiteninhalte für Fuse.js Suchindex
export function getAllDocsForSearch(): { slug: string; href: string; title: string; content: string }[] {
  if (!fs.existsSync(DOCS_DIR)) return [];

  const files = getAllMdxFiles(DOCS_DIR);
  return files.map((file) => {
    const fullPath = path.join(DOCS_DIR, file);
    const raw = fs.readFileSync(fullPath, "utf-8");
    const { data, content } = matter(raw);
    const slug = fileToSlug(file);
    return {
      slug,
      href: slug ? `/docs/${slug}` : "/docs",
      title: (data.title as string) ?? slug,
      content: content.replace(/[#*`>\-]/g, " ").replace(/\s+/g, " ").trim(),
    };
  });
}
