// types/planning.ts — Serialisierte UI-Typen (Dates als ISO-Strings, Json als string[])
// Diese Typen werden zwischen Server Components und Client Components übergeben.

export type TicketStatus =
  | "BACKLOG"
  | "TODO"
  | "IN_PROGRESS"
  | "IN_REVIEW"
  | "DONE"
  | "CANCELLED";

export interface PlanningTask {
  id: string;
  title: string;
  instruction: string | null;
  assignee: string | null;
  status: TicketStatus;
  contextFiles: string[];
  changedFiles: string[];
  diffRef: string | null;
  changedBy: string | null;
  changedAt: string | null; // ISO-String (von Date serialisiert)
  order: number;
}

export interface PlanningFeature {
  id: string;
  title: string;
  description: string | null;
  status: TicketStatus;
  assignee: string | null;
  contextFiles: string[];
  changedFiles: string[];
  diffRef: string | null;
  diffSummary: string | null;
  changedBy: string | null;
  changedAt: string | null; // ISO-String
  order: number;
  tasks: PlanningTask[];
}

export interface PlanningEpic {
  id: string;
  title: string;
  description: string | null;
  status: TicketStatus;
  order: number;
  features: PlanningFeature[];
}

export interface PlanningProject {
  id: string;
  name: string;
  repoOwner: string;
  repoName: string;
  defaultBranch: string;
  epics: PlanningEpic[];
}

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
