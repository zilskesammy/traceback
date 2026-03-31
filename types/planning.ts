// types/planning.ts — Serialisierte UI-Typen (nur noch Diff-Typen)

// ─── DIFF TYPES ──────────────────────────────────────────────────────────────

export interface DiffLine {
  type: "add" | "remove" | "context" | "header";
  content: string;
}

export interface FileDiff {
  file: string;
  additions: number;
  deletions: number;
  lines: DiffLine[];
  error?: string;
}
