// lib/changelog/parser.ts — Reads .agent-changelog/ from GitHub and returns DB-ready objects

import * as yaml from "js-yaml";
import { getFileContent, listDirectory } from "@/lib/github-api";
import type {
  ChangelogItemType,
  ChangelogStatus,
  ChangelogPriority,
  ChangelogAgentType,
  ChangelogAction,
  CodeChangeType,
} from "@/types/changelog";

// ─── PARSED TYPES (internal, before DB upsert) ───────────────────────────────

export interface ParsedCodeChange {
  file: string;
  changeType: CodeChangeType;
  linesAdded: number;
  linesRemoved: number;
  diffSummary: string | null;
}

export interface ParsedEntry {
  id: string;
  timestamp: Date;
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
  codeChanges: ParsedCodeChange[];
}

export interface ParsedFeature {
  id: string;
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
  sourceFile: string;
  entries: ParsedEntry[];
}

// ─── NORMALIZATION HELPERS ────────────────────────────────────────────────────

function normalizeType(category: string): ChangelogItemType {
  const map: Record<string, ChangelogItemType> = {
    feature: "FEATURE",
    bugfix: "BUGFIX",
    epic: "EPIC",
    task: "TASK",
  };
  return map[category?.toLowerCase()] ?? "FEATURE";
}

function normalizeStatus(status: string): ChangelogStatus {
  const map: Record<string, ChangelogStatus> = {
    completed: "COMPLETED",
    in_progress: "IN_PROGRESS",
    planned: "PLANNED",
    in_review: "IN_PROGRESS",
  };
  return map[status?.toLowerCase()] ?? "PLANNED";
}

function normalizePriority(priority: string): ChangelogPriority {
  const map: Record<string, ChangelogPriority> = {
    high: "HIGH",
    medium: "MEDIUM",
    low: "LOW",
  };
  return map[priority?.toLowerCase()] ?? "MEDIUM";
}

function normalizeAgentType(agentType: string): ChangelogAgentType {
  const map: Record<string, ChangelogAgentType> = {
    frontend: "FRONTEND",
    backend: "BACKEND",
    qa: "QA",
    devops: "DEVOPS",
    fullstack: "FULLSTACK",
    architekt: "ARCHITECT",
    architect: "ARCHITECT",
    projektleiter: "PROJECT_MANAGER",
    project_manager: "PROJECT_MANAGER",
    dokumentation: "DOCUMENTATION",
    documentation: "DOCUMENTATION",
    security: "SECURITY",
    human: "HUMAN",
  };
  return map[agentType?.toLowerCase()] ?? "HUMAN";
}

function normalizeAction(action: string): ChangelogAction {
  const map: Record<string, ChangelogAction> = {
    created: "CREATED",
    modified: "MODIFIED",
    fixed: "FIXED",
    planned: "PLANNED",
  };
  return map[action?.toLowerCase()] ?? "CREATED";
}

function normalizeChangeType(changeType: string): CodeChangeType {
  const map: Record<string, CodeChangeType> = {
    added: "ADDED",
    modified: "MODIFIED",
    removed: "REMOVED",
    deleted: "REMOVED",
  };
  return map[changeType?.toLowerCase()] ?? "MODIFIED";
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function strArr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

// ─── YAML PARSER ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseYamlFile(content: string, sourcePath: string): ParsedFeature | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let doc: any;
  try {
    doc = yaml.load(content);
  } catch {
    console.warn(`[changelog-parser] Failed to parse YAML: ${sourcePath}`);
    return null;
  }

  const meta = doc?.meta;
  if (!meta?.id || !meta?.title) {
    console.warn(`[changelog-parser] Missing meta.id or meta.title in ${sourcePath}`);
    return null;
  }

  const desc = meta.description ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawEntries: any[] = Array.isArray(doc.entries) ? doc.entries : [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entries: ParsedEntry[] = rawEntries.map((e: any) => {
    const d = e.description ?? {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawCodeChanges: any[] = Array.isArray(e.code_changes) ? e.code_changes : [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const codeChanges: ParsedCodeChange[] = rawCodeChanges.map((cc: any) => ({
      file: String(cc.file ?? ""),
      changeType: normalizeChangeType(cc.change_type ?? "modified"),
      linesAdded: Number(cc.lines_added ?? 0),
      linesRemoved: Number(cc.lines_removed ?? 0),
      diffSummary: str(cc.diff_summary),
    }));

    const totalAdded = codeChanges.reduce((s, c) => s + c.linesAdded, 0);
    const totalRemoved = codeChanges.reduce((s, c) => s + c.linesRemoved, 0);

    return {
      id: String(e.id ?? ""),
      timestamp: new Date(e.timestamp ?? Date.now()),
      agentType: normalizeAgentType(e.agent_type ?? "human"),
      agentName: String(e.agent_name ?? "Unknown"),
      action: normalizeAction(e.action ?? "created"),
      summary: String(e.summary ?? ""),
      what: str(d.what),
      why: str(d.why),
      technicalDetails: str(d.technical_details),
      sideEffects: str(d.side_effects),
      dependencies: strArr(e.dependencies),
      relatedEntryIds: strArr(e.related_entries),
      linesAdded: totalAdded,
      linesRemoved: totalRemoved,
      codeChanges,
    };
  }).filter((e) => e.id);

  return {
    id: String(meta.id),
    type: normalizeType(meta.category ?? "feature"),
    status: normalizeStatus(meta.status ?? "planned"),
    priority: normalizePriority(meta.priority ?? "medium"),
    title: String(meta.title),
    summary: str(desc.summary) ?? String(meta.title),
    businessContext: str(desc.business_context),
    rootCause: str(desc.root_cause),
    impact: str(desc.impact),
    resolution: str(desc.resolution),
    regressionRisk: str(desc.regression_risk),
    affectedComponents: strArr(desc.affected_components),
    affectedUsers: str(desc.affected_users),
    acceptanceCriteria: strArr(desc.acceptance_criteria),
    tags: strArr(meta.tags),
    sourceFile: sourcePath,
    entries,
  };
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

/**
 * Reads all .agent-changelog/human/features/*.yaml and human/bugfixes/*.yaml
 * from the GitHub repo and returns parsed ParsedFeature[].
 */
export async function fetchChangelogFromGitHub(
  owner: string,
  repo: string,
  ref: string
): Promise<ParsedFeature[]> {
  const dirs = [
    ".agent-changelog/human/features",
    ".agent-changelog/human/bugfixes",
  ];

  const results: ParsedFeature[] = [];

  for (const dir of dirs) {
    const files = await listDirectory(owner, repo, dir, ref);

    for (const file of files) {
      if (!file.name.endsWith(".yaml") && !file.name.endsWith(".yml")) continue;

      const content = await getFileContent(owner, repo, file.path, ref);
      if (!content) continue;

      const parsed = parseYamlFile(content, file.path);
      if (parsed) results.push(parsed);
    }
  }

  return results;
}
