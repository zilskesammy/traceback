// types/changelog.ts — Serialised UI types for Changelog (Dates as ISO strings)

export type ChangelogItemType = "FEATURE" | "BUGFIX" | "EPIC" | "TASK";
export type ChangelogStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED";
export type ChangelogPriority = "HIGH" | "MEDIUM" | "LOW";
export type ChangelogSource = "CHANGELOG" | "UI";
export type ChangelogAgentType =
  | "FRONTEND" | "BACKEND" | "QA" | "DEVOPS" | "FULLSTACK"
  | "ARCHITECT" | "PROJECT_MANAGER" | "DOCUMENTATION" | "SECURITY" | "HUMAN";
export type ChangelogAction = "CREATED" | "MODIFIED" | "FIXED" | "PLANNED";
export type CodeChangeType = "ADDED" | "MODIFIED" | "REMOVED";

export interface UICodeChange {
  id: string;
  entryId: string;
  file: string;
  changeType: CodeChangeType;
  linesAdded: number;
  linesRemoved: number;
  diffSummary: string | null;
}

export interface UIChangelogEntry {
  id: string;
  featureId: string;
  timestamp: string; // ISO
  agentType: ChangelogAgentType;
  agentName: string;
  action: ChangelogAction;
  summary: string;
  what: string | null;
  why: string | null;
  technicalDetails: string | null;
  sideEffects: string | null;
  dependencies: string[];
  relatedEntryIds: string[];
  linesAdded: number;
  linesRemoved: number;
  createdAt: string; // ISO
  codeChanges: UICodeChange[];
}

export interface UIChangelogFeature {
  id: string;
  projectId: string;
  parentId: string | null;
  type: ChangelogItemType;
  status: ChangelogStatus;
  priority: ChangelogPriority;
  title: string;
  summary: string;
  businessContext: string | null;
  rootCause: string | null;
  impact: string | null;
  resolution: string | null;
  regressionRisk: string | null;
  affectedComponents: string[];
  affectedUsers: string | null;
  acceptanceCriteria: string[];
  tags: string[];
  source: ChangelogSource;
  sourceFile: string | null;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  entries: UIChangelogEntry[];
  _entryCount?: number; // for list view without full entries
  // children, linkedPrs, sessionSteps omitted — load separately if needed
}

export interface UIProject {
  id: string;
  name: string;
  repoOwner: string;
  repoName: string;
  defaultBranch: string;
}
