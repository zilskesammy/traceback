// lib/api/yaml.ts — Serialize Epic/Feature/Task trees to YAML strings

import yaml from "js-yaml";

// ─── Shared field helpers ─────────────────────────────────────────────────────

function jsonToStringArray(value: unknown): string[] | null {
  if (!value) return null;
  if (Array.isArray(value)) return value as string[];
  return null;
}

function isoOrNull(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

// ─── Task serialisation ───────────────────────────────────────────────────────

interface RawTask {
  id: string;
  title: string;
  instruction?: string | null;
  assignee?: string | null;
  status: string;
  contextFiles?: unknown;
  changedFiles?: unknown;
  diffRef?: string | null;
  changedBy?: string | null;
  changedAt?: Date | string | null;
  order: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

function buildTaskObject(task: RawTask): Record<string, unknown> {
  return {
    id: task.id,
    title: task.title,
    instruction: task.instruction ?? null,
    assignee: task.assignee ?? null,
    status: task.status,
    contextFiles: jsonToStringArray(task.contextFiles),
    changedFiles: jsonToStringArray(task.changedFiles),
    diffRef: task.diffRef ?? null,
    changedBy: task.changedBy ?? null,
    changedAt: isoOrNull(task.changedAt),
    order: task.order,
  };
}

// ─── Feature serialisation ────────────────────────────────────────────────────

interface RawFeature {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  assignee?: string | null;
  contextFiles?: unknown;
  changedFiles?: unknown;
  diffRef?: string | null;
  diffSummary?: string | null;
  changedBy?: string | null;
  changedAt?: Date | string | null;
  acceptanceCriteria?: unknown;
  order: number;
  tasks?: RawTask[];
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

function buildFeatureObject(feature: RawFeature): Record<string, unknown> {
  return {
    id: feature.id,
    title: feature.title,
    description: feature.description ?? null,
    status: feature.status,
    assignee: feature.assignee ?? null,
    contextFiles: jsonToStringArray(feature.contextFiles),
    changedFiles: jsonToStringArray(feature.changedFiles),
    diffRef: feature.diffRef ?? null,
    diffSummary: feature.diffSummary ?? null,
    changedBy: feature.changedBy ?? null,
    changedAt: isoOrNull(feature.changedAt),
    acceptanceCriteria: feature.acceptanceCriteria ?? null,
    order: feature.order,
    tasks: (feature.tasks ?? []).map(buildTaskObject),
  };
}

// ─── Epic serialisation ───────────────────────────────────────────────────────

interface RawEpic {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  order: number;
  features?: RawFeature[];
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

function buildEpicObject(epic: RawEpic): Record<string, unknown> {
  return {
    id: epic.id,
    title: epic.title,
    description: epic.description ?? null,
    status: epic.status,
    order: epic.order,
    features: (epic.features ?? []).map(buildFeatureObject),
  };
}

// ─── Project serialisation ────────────────────────────────────────────────────

interface RawProject {
  id: string;
  name: string;
  repoOwner?: string;
  repoName?: string;
  defaultBranch?: string;
  epics?: RawEpic[];
}

/**
 * Serializes a full project tree (epics → features → tasks) to a YAML string.
 */
export function serializeProjectToYaml(project: RawProject): string {
  const doc = {
    project: {
      id: project.id,
      name: project.name,
      repoOwner: project.repoOwner ?? null,
      repoName: project.repoName ?? null,
      defaultBranch: project.defaultBranch ?? null,
      epics: (project.epics ?? []).map(buildEpicObject),
    },
  };

  return yaml.dump(doc, { lineWidth: 120, noRefs: true });
}

/**
 * Serializes a single task with its parent feature and epic as context.
 */
export function serializeTaskToYaml(
  task: RawTask,
  feature: RawFeature,
  epic: RawEpic
): string {
  const doc = {
    epic: {
      id: epic.id,
      title: epic.title,
      description: epic.description ?? null,
      status: epic.status,
      order: epic.order,
    },
    feature: {
      id: feature.id,
      title: feature.title,
      description: feature.description ?? null,
      status: feature.status,
      assignee: feature.assignee ?? null,
      contextFiles: jsonToStringArray(feature.contextFiles),
      changedFiles: jsonToStringArray(feature.changedFiles),
      diffRef: feature.diffRef ?? null,
      diffSummary: feature.diffSummary ?? null,
      changedBy: feature.changedBy ?? null,
      changedAt: isoOrNull(feature.changedAt),
      acceptanceCriteria: feature.acceptanceCriteria ?? null,
      order: feature.order,
    },
    task: buildTaskObject(task),
  };

  return yaml.dump(doc, { lineWidth: 120, noRefs: true });
}
