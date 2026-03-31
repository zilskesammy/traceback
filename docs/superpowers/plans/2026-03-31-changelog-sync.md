# Changelog Sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Traceback's Epic/Feature/Task planning schema with a Changelog-based schema (ChangelogFeature + ChangelogEntry + CodeChange), sync data from `.agent-changelog/` in connected GitHub repos, and render it as a multi-project changelog view.

**Architecture:** Three new Prisma models replace Epic/Feature/Task. A GitHub-API-based parser reads human YAML files (richest source) and upserts into DB. The existing push webhook triggers sync when `.agent-changelog/` files change. A new `ChangelogView` component replaces `PlanningLayout`'s epic sidebar + feature board. SessionStep and LinkedPR FK renamed from `ticketId` → `featureId`.

**Tech Stack:** Prisma 6 (PostgreSQL), Next.js 16 App Router, Tailwind CSS v4, js-yaml (already installed), @octokit/rest (already installed)

---

## Codebase map — was existiert

| Pfad | Was es tut |
|------|-----------|
| `prisma/schema.prisma` | DB-Schema — wird radikal umgebaut |
| `lib/github-api.ts` | Octokit-Wrapper — wird um `getFileContent` (existiert) + neues `listDirectory` erweitert |
| `lib/db.ts` | Prisma-Singleton — unverändert |
| `lib/api/auth-middleware.ts` | `resolveAuth()` — unverändert |
| `app/api/webhook/github/route.ts` | Push-Webhook — wird erweitert um Changelog-Sync-Trigger |
| `components/planning/PlanningLayout.tsx` | Haupt-Shell — wird durch `ProjectLayout` ersetzt |
| `app/(app)/projects/[id]/page.tsx` | Server Component — wird auf ChangelogFeature umgestellt |
| `types/planning.ts` | UI-Typen — Planung raus, DiffLine/FileDiff bleiben |

**Wichtige Quelldateien im Changelog:**
- `.agent-changelog/machine/index.json` — Index mit feature-level metadata (status, priority, tags)
- `.agent-changelog/human/index.yaml` — Human-readable Index
- `.agent-changelog/human/features/*.yaml` — Feature-Details (businessContext, acceptanceCriteria, code_changes)
- `.agent-changelog/human/bugfixes/*.yaml` — Bugfix-Details (rootCause, impact, resolution)

**YAML-Entry-Struktur:**
```yaml
meta:
  id: "feat-20260330-001"
  title: "..."
  category: "feature" | "bugfix"
  status: "completed" | "in_progress" | "planned"
  priority: "high" | "medium" | "low"
  tags: [...]
  description:
    summary: "..."
    business_context: "..."          # feature
    root_cause: "..."                # bugfix
    impact: "..."                    # bugfix
    resolution: "..."                # bugfix
    regression_risk: "..."           # bugfix
    affected_components: [...]
    affected_users: "..."
    acceptance_criteria: [...]
entries:
  - id: "entry-20260330-120000-be01"
    timestamp: "2026-03-30T12:00:00Z"
    agent_type: "BackEnd"
    agent_name: "Claude"
    action: "created" | "modified" | "fixed"
    summary: "..."
    description:
      what: "..."
      why: "..."
      technical_details: "..."
      side_effects: "..."
    code_changes:
      - file: "path/to/file.ts"
        change_type: "added" | "modified" | "removed"
        lines_added: 42
        lines_removed: 0
        diff_summary: "..."
    dependencies: [...]
    related_entries: [...]
```

---

## File structure after implementation

```
prisma/
  schema.prisma             MODIFY — radikal umbauen

lib/
  changelog/
    parser.ts               CREATE — parseHumanYaml(), syncProject()
  db/
    changelog.ts            CREATE — upsertFeature(), upsertEntry(), upsertCodeChanges(), listFeatures(), getFeature()
    session-steps.ts        MODIFY — ticketId → featureId
    linked-prs.ts           MODIFY — ticketId → featureId
  github-api.ts             MODIFY — listDirectory() hinzufügen

app/
  api/
    projects/[id]/
      changelog/
        sync/route.ts       CREATE — POST /api/projects/[id]/changelog/sync
        route.ts            CREATE — GET /api/projects/[id]/changelog
        [featureId]/
          route.ts          CREATE — GET /api/projects/[id]/changelog/[featureId]
    webhook/github/route.ts MODIFY — Changelog-Sync-Trigger für .agent-changelog/**
    tasks/ (gesamtes Verzeichnis)   DELETE
    projects/[id]/epics/ (gesamtes Verzeichnis)  DELETE
    projects/[id]/tickets/route.ts  DELETE

types/
  planning.ts               MODIFY — Planung raus, DiffLine/FileDiff bleiben
  changelog.ts              CREATE — ChangelogFeature, ChangelogEntry, CodeChange UI-Typen

components/
  changelog/
    ChangelogView.tsx        CREATE — Feature-Liste mit Entry-Timeline
    ProjectLayout.tsx        CREATE — Shell mit Filter-Sidebar
  planning/ (Planung-Komponenten)   DELETE
    FeatureBoard.tsx, FeatureCard.tsx, KanbanBoard.tsx, YamlView.tsx
    modals/EpicModal.tsx, FeatureModal.tsx, TaskModal.tsx, TicketModal.tsx
    SessionViewer.tsx, AgentBadge.tsx, AgentDelegation.tsx (bleiben für später)

  lib/
    mcp/tools/tickets.ts    MODIFY — auf ChangelogFeature umstellen
    mcp/tools/sessions.ts   MODIFY — ticketId → featureId
    mcp/tools/links.ts      MODIFY — ticketId → featureId
    mcp/tools/comments.ts   MODIFY — TaskComment → ChangelogEntry

app/(app)/projects/[id]/page.tsx  MODIFY — ChangelogFeatures laden
```

---

## Task 1 — Prisma Schema umbauen

**Files:** `prisma/schema.prisma`

- [ ] **Step 1: Alte Modelle und Enums entfernen**

Öffne `prisma/schema.prisma`. Entferne vollständig (inkl. aller Felder und Relations):
- Model `Epic`
- Model `Feature`
- Model `Task`
- Model `TaskComment`
- Enum `TicketStatus`
- Enum `DelegateStatus`

Lass stehen: `Account`, `Session`, `VerificationToken`, `User`, `Project`, `ProjectMember`, `ProjectRole`, `ProjectInvitation`, `InvitationStatus`, `Commit`, `ApiKey`, `Agent`, `SessionStep`, `LinkedPR`, `SessionStepType`, `LinkType`, `PRStatus`, `AuthorType`.

- [ ] **Step 2: SessionStep und LinkedPR umverdrahten**

In `SessionStep`: ändere `ticketId` zu `featureId`, passe Relation und Index an:

```prisma
model SessionStep {
  id        String          @id @default(cuid())
  featureId String
  agentId   String
  sequence  Int
  type      SessionStepType
  content   String          @db.Text
  metadata  Json            @default("{}")
  createdAt DateTime        @default(now())

  feature ChangelogFeature @relation(fields: [featureId], references: [id], onDelete: Cascade)
  agent   Agent            @relation(fields: [agentId], references: [id])

  @@index([featureId, sequence])
  @@index([agentId])
}
```

In `LinkedPR`: ändere `ticketId` zu `featureId`:

```prisma
model LinkedPR {
  id        String   @id @default(cuid())
  featureId String
  url       String
  type      LinkType @default(PR)
  title     String?
  status    PRStatus @default(OPEN)
  createdAt DateTime @default(now())

  feature ChangelogFeature @relation(fields: [featureId], references: [id], onDelete: Cascade)

  @@index([featureId])
}
```

In `Agent`: ändere `delegatedTasks Task[] @relation("TaskDelegate")` → entfernen (Task existiert nicht mehr). `sessionSteps SessionStep[]` bleibt.

```prisma
model Agent {
  id           String   @id
  name         String
  provider     String
  model        String?
  capabilities String[]
  avatarUrl    String?
  guidance     String?  @db.Text
  createdAt    DateTime @default(now())

  sessionSteps SessionStep[]
}
```

- [ ] **Step 3: Neue Enums hinzufügen**

Füge nach den bestehenden Enums hinzu:

```prisma
enum ChangelogItemType {
  FEATURE
  BUGFIX
  EPIC
  TASK
}

enum ChangelogStatus {
  PLANNED
  IN_PROGRESS
  COMPLETED
}

enum ChangelogPriority {
  HIGH
  MEDIUM
  LOW
}

enum ChangelogSource {
  CHANGELOG
  UI
}

enum ChangelogAgentType {
  FRONTEND
  BACKEND
  QA
  DEVOPS
  FULLSTACK
  ARCHITEKT
  PROJEKTLEITER
  DOKUMENTATION
  SECURITY
  HUMAN
}

enum ChangelogAction {
  CREATED
  MODIFIED
  FIXED
  PLANNED
}

enum CodeChangeType {
  ADDED
  MODIFIED
  REMOVED
}
```

- [ ] **Step 4: Neue Modelle hinzufügen**

```prisma
// ─── CHANGELOG ───────────────────────────────────────────────────────────────

model ChangelogFeature {
  id                 String            @id
  projectId          String
  parentId           String?
  type               ChangelogItemType
  status             ChangelogStatus
  priority           ChangelogPriority
  title              String
  summary            String            @db.Text
  businessContext    String?           @db.Text
  rootCause          String?           @db.Text
  impact             String?           @db.Text
  resolution         String?           @db.Text
  regressionRisk     String?           @db.Text
  affectedComponents String[]
  affectedUsers      String?           @db.Text
  acceptanceCriteria String[]
  tags               String[]
  source             ChangelogSource   @default(CHANGELOG)
  sourceFile         String?
  createdAt          DateTime          @default(now())
  updatedAt          DateTime          @updatedAt

  project      Project              @relation(fields: [projectId], references: [id], onDelete: Cascade)
  parent       ChangelogFeature?    @relation("FeatureHierarchy", fields: [parentId], references: [id])
  children     ChangelogFeature[]   @relation("FeatureHierarchy")
  entries      ChangelogEntry[]
  sessionSteps SessionStep[]
  linkedPrs    LinkedPR[]

  @@index([projectId])
  @@index([parentId])
  @@index([type])
  @@index([status])
}

model ChangelogEntry {
  id               String             @id
  featureId        String
  timestamp        DateTime
  agentType        ChangelogAgentType
  agentName        String
  action           ChangelogAction
  summary          String             @db.Text
  what             String?            @db.Text
  why              String?            @db.Text
  technicalDetails String?            @db.Text
  sideEffects      String?            @db.Text
  dependencies     String[]
  relatedEntryIds  String[]
  linesAdded       Int                @default(0)
  linesRemoved     Int                @default(0)
  createdAt        DateTime           @default(now())

  feature     ChangelogFeature @relation(fields: [featureId], references: [id], onDelete: Cascade)
  codeChanges CodeChange[]

  @@index([featureId])
  @@index([timestamp])
  @@index([agentType])
}

model CodeChange {
  id           String         @id @default(cuid())
  entryId      String
  file         String
  changeType   CodeChangeType
  linesAdded   Int            @default(0)
  linesRemoved Int            @default(0)
  diffSummary  String?        @db.Text

  entry ChangelogEntry @relation(fields: [entryId], references: [id], onDelete: Cascade)

  @@index([entryId])
  @@index([file])
}
```

Füge auch in `Project` die Relation hinzu (nach bestehenden Relations):

```prisma
  changelogFeatures ChangelogFeature[]
```

- [ ] **Step 5: Schema validieren**

```bash
cd /Users/sam_zahra_shop/traceback
npx prisma validate
```

Expected: `The schema at prisma/schema.prisma is valid!`

- [ ] **Step 6: DB push**

```bash
npx prisma db push --accept-data-loss
```

Expected: `Your database is now in sync with your Prisma schema.`

`--accept-data-loss` ist nötig weil Epic/Feature/Task-Tabellen gelöscht werden. Das ist gewollt — alle Daten kommen aus dem Changelog-Sync.

- [ ] **Step 7: Prisma Client regenerieren**

```bash
npx prisma generate
```

Expected: `Generated Prisma Client`

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma
git commit -m "refactor: replace Epic/Feature/Task with ChangelogFeature/Entry/CodeChange schema"
```

---

## Task 2 — TypeScript Types

**Files:** `types/planning.ts`, `types/changelog.ts`

- [ ] **Step 1: types/planning.ts bereinigen**

Ersetze den gesamten Inhalt von `types/planning.ts` — entferne alle Planungstypen, behalte nur DiffLine/FileDiff:

```typescript
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
```

- [ ] **Step 2: types/changelog.ts erstellen**

```typescript
// types/changelog.ts — Serialisierte UI-Typen für Changelog (Dates als ISO-Strings)

export type ChangelogItemType = "FEATURE" | "BUGFIX" | "EPIC" | "TASK";
export type ChangelogStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED";
export type ChangelogPriority = "HIGH" | "MEDIUM" | "LOW";
export type ChangelogSource = "CHANGELOG" | "UI";
export type ChangelogAgentType =
  | "FRONTEND" | "BACKEND" | "QA" | "DEVOPS" | "FULLSTACK"
  | "ARCHITEKT" | "PROJEKTLEITER" | "DOKUMENTATION" | "SECURITY" | "HUMAN";
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
  _entryCount?: number; // für Listen-View ohne volle Entries
}

export interface UIProject {
  id: string;
  name: string;
  repoOwner: string;
  repoName: string;
  defaultBranch: string;
}
```

- [ ] **Step 3: Commit**

```bash
git add types/planning.ts types/changelog.ts
git commit -m "refactor: update types — remove planning types, add changelog types"
```

---

## Task 3 — GitHub Helper erweitern

**Files:** `lib/github-api.ts`

- [ ] **Step 1: listDirectory() hinzufügen**

Füge am Ende von `lib/github-api.ts` hinzu:

```typescript
// ─── DIRECTORY LISTING ───────────────────────────────────────────────────────

/**
 * Listet alle Dateien in einem Verzeichnis eines GitHub Repos.
 * Gibt Array von { name, path, sha } zurück.
 * Gibt leeres Array zurück wenn Verzeichnis nicht existiert (404).
 */
export async function listDirectory(
  owner: string,
  repo: string,
  path: string,
  ref: string
): Promise<Array<{ name: string; path: string; sha: string }>> {
  try {
    const { data } = await octokit.repos.getContent({ owner, repo, path, ref });
    if (!Array.isArray(data)) return [];
    return data
      .filter((item) => item.type === "file")
      .map((item) => ({ name: item.name, path: item.path, sha: item.sha }));
  } catch (err: unknown) {
    if ((err as { status?: number }).status === 404) return [];
    throw err;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/github-api.ts
git commit -m "feat: add listDirectory() to github-api"
```

---

## Task 4 — Changelog Parser

**Files:** `lib/changelog/parser.ts` (CREATE)

Der Parser liest die Human-YAML-Dateien aus GitHub (reichste Datenquelle) und gibt strukturierte Objekte zurück.

- [ ] **Step 1: lib/changelog/parser.ts erstellen**

```typescript
// lib/changelog/parser.ts — Liest .agent-changelog/ aus GitHub und gibt DB-Objekte zurück

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

// ─── PARSED TYPES (intern, vor DB-Upsert) ───────────────────────────────────

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
    architekt: "ARCHITEKT",
    projektleiter: "PROJEKTLEITER",
    dokumentation: "DOKUMENTATION",
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
  const rawEntries: any[] = Array.isArray(doc.entries) ? doc.entries : [];

  const entries: ParsedEntry[] = rawEntries.map((e: any) => {
    const d = e.description ?? {};
    const rawCodeChanges: any[] = Array.isArray(e.code_changes) ? e.code_changes : [];

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
 * Liest alle .agent-changelog/human/features/*.yaml und human/bugfixes/*.yaml
 * aus dem GitHub Repo und gibt geparste ParsedFeature[] zurück.
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
```

- [ ] **Step 2: Commit**

```bash
git add lib/changelog/parser.ts
git commit -m "feat: add changelog parser — reads human YAML from GitHub"
```

---

## Task 5 — DB Helpers

**Files:** `lib/db/changelog.ts` (CREATE), `lib/db/session-steps.ts` (MODIFY), `lib/db/linked-prs.ts` (MODIFY)

- [ ] **Step 1: lib/db/changelog.ts erstellen**

```typescript
// lib/db/changelog.ts — DB-Operationen für ChangelogFeature, ChangelogEntry, CodeChange

import { db } from "@/lib/db";
import type { ParsedFeature } from "@/lib/changelog/parser";
import type { ChangelogItemType, ChangelogStatus, ChangelogPriority } from "@/types/changelog";

// ─── UPSERT ──────────────────────────────────────────────────────────────────

export async function upsertChangelogFeature(
  projectId: string,
  feature: ParsedFeature
): Promise<void> {
  // 1. Feature upserten
  await db.changelogFeature.upsert({
    where: { id: feature.id },
    create: {
      id: feature.id,
      projectId,
      type: feature.type,
      status: feature.status,
      priority: feature.priority,
      title: feature.title,
      summary: feature.summary,
      businessContext: feature.businessContext,
      rootCause: feature.rootCause,
      impact: feature.impact,
      resolution: feature.resolution,
      regressionRisk: feature.regressionRisk,
      affectedComponents: feature.affectedComponents,
      affectedUsers: feature.affectedUsers,
      acceptanceCriteria: feature.acceptanceCriteria,
      tags: feature.tags,
      source: "CHANGELOG",
      sourceFile: feature.sourceFile,
    },
    update: {
      status: feature.status,
      priority: feature.priority,
      title: feature.title,
      summary: feature.summary,
      businessContext: feature.businessContext,
      rootCause: feature.rootCause,
      impact: feature.impact,
      resolution: feature.resolution,
      regressionRisk: feature.regressionRisk,
      affectedComponents: feature.affectedComponents,
      affectedUsers: feature.affectedUsers,
      acceptanceCriteria: feature.acceptanceCriteria,
      tags: feature.tags,
      sourceFile: feature.sourceFile,
    },
  });

  // 2. Entries upserten
  for (const entry of feature.entries) {
    await db.changelogEntry.upsert({
      where: { id: entry.id },
      create: {
        id: entry.id,
        featureId: feature.id,
        timestamp: entry.timestamp,
        agentType: entry.agentType,
        agentName: entry.agentName,
        action: entry.action,
        summary: entry.summary,
        what: entry.what,
        why: entry.why,
        technicalDetails: entry.technicalDetails,
        sideEffects: entry.sideEffects,
        dependencies: entry.dependencies,
        relatedEntryIds: entry.relatedEntryIds,
        linesAdded: entry.linesAdded,
        linesRemoved: entry.linesRemoved,
      },
      update: {
        agentType: entry.agentType,
        agentName: entry.agentName,
        action: entry.action,
        summary: entry.summary,
        what: entry.what,
        why: entry.why,
        technicalDetails: entry.technicalDetails,
        sideEffects: entry.sideEffects,
        dependencies: entry.dependencies,
        relatedEntryIds: entry.relatedEntryIds,
        linesAdded: entry.linesAdded,
        linesRemoved: entry.linesRemoved,
      },
    });

    // 3. CodeChanges: delete + recreate (kein stabiler PK pro Change)
    if (entry.codeChanges.length > 0) {
      await db.codeChange.deleteMany({ where: { entryId: entry.id } });
      await db.codeChange.createMany({
        data: entry.codeChanges.map((cc) => ({
          entryId: entry.id,
          file: cc.file,
          changeType: cc.changeType,
          linesAdded: cc.linesAdded,
          linesRemoved: cc.linesRemoved,
          diffSummary: cc.diffSummary,
        })),
      });
    }
  }
}

// ─── READ ─────────────────────────────────────────────────────────────────────

export async function listChangelogFeatures(
  projectId: string,
  opts?: {
    type?: ChangelogItemType;
    status?: ChangelogStatus;
    priority?: ChangelogPriority;
    tags?: string[];
    limit?: number;
    offset?: number;
  }
) {
  return db.changelogFeature.findMany({
    where: {
      projectId,
      ...(opts?.type ? { type: opts.type } : {}),
      ...(opts?.status ? { status: opts.status } : {}),
      ...(opts?.priority ? { priority: opts.priority } : {}),
      ...(opts?.tags?.length ? { tags: { hasSome: opts.tags } } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: opts?.limit ?? 50,
    skip: opts?.offset ?? 0,
    include: {
      _count: { select: { entries: true } },
    },
  });
}

export async function getChangelogFeature(featureId: string) {
  return db.changelogFeature.findUnique({
    where: { id: featureId },
    include: {
      entries: {
        orderBy: { timestamp: "asc" },
        include: { codeChanges: { orderBy: { file: "asc" } } },
      },
    },
  });
}
```

- [ ] **Step 2: lib/db/session-steps.ts aktualisieren**

Ersetze `ticketId` durch `featureId` in allen Vorkommen:

```typescript
import { db } from "@/lib/db";
import type { SessionStepType } from "@prisma/client";

export interface CreateSessionStepInput {
  featureId: string;
  agentId: string;
  type: SessionStepType;
  content: string;
  metadata?: Record<string, unknown>;
}

export async function createSessionStep(input: CreateSessionStepInput) {
  const last = await db.sessionStep.findFirst({
    where: { featureId: input.featureId },
    orderBy: { sequence: "desc" },
    select: { sequence: true },
  });

  return db.sessionStep.create({
    data: {
      featureId: input.featureId,
      agentId: input.agentId,
      sequence: (last?.sequence ?? 0) + 1,
      type: input.type,
      content: input.content,
      metadata: (input.metadata ?? {}) as any,
    },
  });
}

export async function getSessionSteps(
  featureId: string,
  opts?: { types?: SessionStepType[]; since?: string }
) {
  return db.sessionStep.findMany({
    where: {
      featureId,
      ...(opts?.types?.length ? { type: { in: opts.types } } : {}),
      ...(opts?.since ? { createdAt: { gte: new Date(opts.since) } } : {}),
    },
    orderBy: { sequence: "asc" },
  });
}
```

- [ ] **Step 3: lib/db/linked-prs.ts aktualisieren**

```typescript
import { db } from "@/lib/db";
import type { LinkType } from "@prisma/client";

export interface CreateLinkedPRInput {
  featureId: string;
  url: string;
  type?: LinkType;
  title?: string;
}

export async function createLinkedPR(input: CreateLinkedPRInput) {
  return db.linkedPR.create({
    data: {
      featureId: input.featureId,
      url: input.url,
      type: input.type ?? "PR",
      title: input.title ?? null,
    },
  });
}

export async function getLinkedPRs(featureId: string) {
  return db.linkedPR.findMany({
    where: { featureId },
    orderBy: { createdAt: "asc" },
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/db/changelog.ts lib/db/session-steps.ts lib/db/linked-prs.ts
git commit -m "feat: add changelog DB helpers, rename ticketId→featureId in session-steps + linked-prs"
```

---

## Task 6 — Sync Endpoint

**Files:** `app/api/projects/[id]/changelog/sync/route.ts` (CREATE)

- [ ] **Step 1: Sync-Route erstellen**

```typescript
// app/api/projects/[id]/changelog/sync/route.ts — POST: Sync Changelog aus GitHub

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveAuth } from "@/lib/api/auth-middleware";
import { fetchChangelogFromGitHub } from "@/lib/changelog/parser";
import { upsertChangelogFeature } from "@/lib/db/changelog";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id: projectId } = await params;

  const auth = await resolveAuth(req, projectId);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { repoOwner: true, repoName: true, defaultBranch: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  try {
    const features = await fetchChangelogFromGitHub(
      project.repoOwner,
      project.repoName,
      project.defaultBranch
    );

    let synced = 0;
    for (const feature of features) {
      await upsertChangelogFeature(projectId, feature);
      synced++;
    }

    return NextResponse.json({ ok: true, synced, total: features.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[changelog-sync] Error:", message, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/projects/[id]/changelog/sync/route.ts
git commit -m "feat: add POST /api/projects/[id]/changelog/sync endpoint"
```

---

## Task 7 — Changelog Read Endpoints

**Files:** `app/api/projects/[id]/changelog/route.ts` (CREATE), `app/api/projects/[id]/changelog/[featureId]/route.ts` (CREATE)

- [ ] **Step 1: List-Endpoint erstellen**

```typescript
// app/api/projects/[id]/changelog/route.ts — GET: Liste aller Features

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveAuth } from "@/lib/api/auth-middleware";
import { listChangelogFeatures } from "@/lib/db/changelog";
import type { ChangelogItemType, ChangelogStatus, ChangelogPriority } from "@/types/changelog";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id: projectId } = await params;

  const auth = await resolveAuth(req, projectId);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") as ChangelogItemType | null;
  const status = searchParams.get("status") as ChangelogStatus | null;
  const priority = searchParams.get("priority") as ChangelogPriority | null;
  const tags = searchParams.get("tags")?.split(",").filter(Boolean);
  const limit = Number(searchParams.get("limit") ?? "50");
  const offset = Number(searchParams.get("offset") ?? "0");

  const features = await listChangelogFeatures(projectId, {
    ...(type ? { type } : {}),
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
    ...(tags?.length ? { tags } : {}),
    limit,
    offset,
  });

  return NextResponse.json(features);
}
```

- [ ] **Step 2: Detail-Endpoint erstellen**

```typescript
// app/api/projects/[id]/changelog/[featureId]/route.ts — GET: Feature + Entries + CodeChanges

import { NextRequest, NextResponse } from "next/server";
import { resolveAuth } from "@/lib/api/auth-middleware";
import { getChangelogFeature } from "@/lib/db/changelog";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; featureId: string }> }
): Promise<NextResponse> {
  const { id: projectId, featureId } = await params;

  const auth = await resolveAuth(req, projectId);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const feature = await getChangelogFeature(featureId);
  if (!feature || feature.projectId !== projectId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(feature);
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/projects/[id]/changelog/route.ts app/api/projects/[id]/changelog/[featureId]/route.ts
git commit -m "feat: add GET /api/projects/[id]/changelog + /[featureId] endpoints"
```

---

## Task 8 — Webhook erweitern

**Files:** `app/api/webhook/github/route.ts`

- [ ] **Step 1: Alte Task-Logik entfernen, Changelog-Sync-Trigger hinzufügen**

Ersetze die gesamte `handlePush`-Funktion und entferne alle task-bezogenen Hilfsfunktionen. Behalte: `verifySignature`, `getRepoFullName`, `error`. Entferne: `extractTaskIdFromBranch`, `extractTaskNumbersFromMessage`, `updateTaskFromPR`, `updateTaskByNumber`.

Ersetze auch den Import `matchFilesToTickets` (wird nicht mehr gebraucht).

Neue `handlePush`-Funktion:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { extractFilesFromPush, extractBranchFromRef } from "@/lib/webhook/extractFilesFromPush";
import { fetchChangelogFromGitHub } from "@/lib/changelog/parser";
import { upsertChangelogFeature } from "@/lib/db/changelog";
import type { GitHubPushPayload, GitHubPullRequestPayload } from "@/types/github";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");
  const eventType = req.headers.get("x-github-event");
  const deliveryId = req.headers.get("x-github-delivery");

  if (!signature || !eventType) {
    return error(400, "Missing required GitHub headers");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return error(400, "Invalid JSON payload");
  }

  const repoFullName = getRepoFullName(payload);
  if (!repoFullName) return error(400, "Cannot determine repository from payload");

  const [repoOwner, repoName] = repoFullName.split("/");
  const project = await db.project.findFirst({
    where: { repoOwner, repoName },
    select: { id: true, webhookSecret: true, defaultBranch: true },
  });

  if (!project) return NextResponse.json({ ok: true }, { status: 200 });

  const signatureValid = verifySignature(rawBody, signature, project.webhookSecret);
  if (!signatureValid) return error(401, "Invalid signature");

  console.log(`[webhook] event=${eventType} delivery=${deliveryId} repo=${repoFullName}`);

  try {
    switch (eventType) {
      case "push":
        await handlePush(project.id, project.defaultBranch, payload as GitHubPushPayload, repoOwner, repoName);
        break;
      case "ping":
        break;
      default:
        console.log(`[webhook] Unhandled event type: ${eventType}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[webhook] Processing failed: ${message}`, err);
    return error(500, `Processing failed: ${message}`);
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

async function handlePush(
  projectId: string,
  defaultBranch: string,
  payload: GitHubPushPayload,
  repoOwner: string,
  repoName: string
): Promise<void> {
  if (!payload.commits || payload.commits.length === 0) return;

  const headSha = payload.after;
  const branch = extractBranchFromRef(payload.ref);
  const changedFiles = extractFilesFromPush(payload);

  const headCommit = payload.head_commit ?? payload.commits[payload.commits.length - 1];
  const message = headCommit?.message ?? "";
  const author = headCommit?.author.name ?? payload.pusher.name;
  const pushedAt = headCommit?.timestamp ? new Date(headCommit.timestamp) : new Date();

  // Commit in DB speichern
  await db.commit.upsert({
    where: { projectId_sha: { projectId, sha: headSha } },
    create: { projectId, sha: headSha, message, author, pushedAt, branch, filesChanged: changedFiles },
    update: { filesChanged: changedFiles },
  });

  // Changelog-Sync wenn .agent-changelog/ Dateien geändert wurden
  const hasChangelogChanges = changedFiles.some((f: string) =>
    f.startsWith(".agent-changelog/")
  );

  if (hasChangelogChanges) {
    console.log(`[webhook] .agent-changelog/ changed — syncing changelog for project ${projectId}`);
    try {
      const features = await fetchChangelogFromGitHub(repoOwner, repoName, branch || defaultBranch);
      for (const feature of features) {
        await upsertChangelogFeature(projectId, feature);
      }
      console.log(`[webhook] Synced ${features.length} changelog features`);
    } catch (err) {
      console.error("[webhook] Changelog sync failed:", err);
      // Fehler nicht weiterwerfen — Commit wurde trotzdem gespeichert
    }
  }
}

function verifySignature(rawBody: string, receivedSignature: string, secret: string): boolean {
  const expected = "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    const a = Buffer.from(receivedSignature, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function getRepoFullName(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  const repo = p.repository;
  if (typeof repo !== "object" || repo === null) return null;
  const fullName = (repo as Record<string, unknown>).full_name;
  return typeof fullName === "string" ? fullName : null;
}

function error(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}
```

- [ ] **Step 2: handlePullRequest entfernen**

`handlePullRequest` referenzierte Task-Modelle. Da der Switch nur `push` und `ping` hat, ist `handlePullRequest` jetzt tot code — es wurde bereits aus dem Switch entfernt. Stelle sicher dass die Funktion nicht mehr im File existiert.

- [ ] **Step 3: Commit**

```bash
git add app/api/webhook/github/route.ts
git commit -m "refactor: simplify webhook — remove task logic, add changelog sync trigger"
```

---

## Task 9 — MCP Tools aktualisieren

**Files:** `lib/mcp/tools/tickets.ts`, `lib/mcp/tools/sessions.ts`, `lib/mcp/tools/links.ts`, `lib/mcp/tools/comments.ts`

- [ ] **Step 1: sessions.ts — ticketId → featureId**

Ersetze `ticketId` überall durch `featureId`:

```typescript
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "@/lib/db";
import { createSessionStep } from "@/lib/db/session-steps";
import type { McpAuthContext } from "../server";
import type { SessionStepType } from "@prisma/client";

export function registerSessionTools(server: McpServer, _auth: McpAuthContext) {

  server.tool(
    "traceback_log_session_step",
    `Append a reasoning/action step to a feature's agent session log.
CALL THIS FOR EVERY SIGNIFICANT STEP: decisions, searches, code changes, results, errors.
Types: thinking | reasoning | action | code | result | error`,
    {
      feature_id: z.string().describe("ChangelogFeature ID"),
      type: z.enum(["thinking", "reasoning", "action", "code", "result", "error"]),
      content: z.string().describe("What happened — actual reasoning, command, diff, or result"),
      metadata: z.object({
        files_changed: z.array(z.string()).optional(),
        tokens_used: z.number().optional(),
        duration_ms: z.number().optional(),
        tool_name: z.string().optional(),
        model: z.string().optional(),
      }).optional(),
    },
    async ({ feature_id, type, content, metadata }) => {
      try {
        const step = await createSessionStep({
          featureId: feature_id,
          agentId: "claude-code",
          type: type.toUpperCase() as SessionStepType,
          content,
          metadata: metadata as Record<string, unknown> | undefined,
        });
        return { content: [{ type: "text", text: JSON.stringify(step, null, 2) }] };
      } catch (e: any) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }] };
      }
    }
  );

  server.tool(
    "traceback_get_session",
    "Get the full session log for a feature.",
    {
      feature_id: z.string().describe("ChangelogFeature ID"),
      types: z.array(z.enum(["thinking", "reasoning", "action", "code", "result", "error"])).optional(),
      since: z.string().optional().describe("ISO timestamp — only steps after this time"),
    },
    async ({ feature_id, types, since }) => {
      try {
        const steps = await db.sessionStep.findMany({
          where: {
            featureId: feature_id,
            ...(types?.length ? { type: { in: types.map((t) => t.toUpperCase()) as SessionStepType[] } } : {}),
            ...(since ? { createdAt: { gte: new Date(since) } } : {}),
          },
          orderBy: { sequence: "asc" },
        });
        return { content: [{ type: "text", text: JSON.stringify(steps, null, 2) }] };
      } catch (e: any) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }] };
      }
    }
  );
}
```

- [ ] **Step 2: links.ts — ticketId → featureId**

```typescript
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createLinkedPR } from "@/lib/db/linked-prs";
import type { McpAuthContext } from "../server";
import type { LinkType } from "@prisma/client";

export function registerLinkTools(server: McpServer, _auth: McpAuthContext) {
  server.tool(
    "traceback_link_pr",
    "Link a PR, branch, or commit to a changelog feature.",
    {
      feature_id: z.string(),
      url: z.string().url(),
      type: z.enum(["pr", "branch", "commit"]).optional(),
      title: z.string().optional(),
    },
    async ({ feature_id, url, type, title }) => {
      try {
        const pr = await createLinkedPR({
          featureId: feature_id,
          url,
          type: (type?.toUpperCase() ?? "PR") as LinkType,
          title,
        });
        return { content: [{ type: "text", text: JSON.stringify(pr, null, 2) }] };
      } catch (e: any) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }] };
      }
    }
  );
}
```

- [ ] **Step 3: tickets.ts — auf ChangelogFeature umstellen**

Ersetze den gesamten Inhalt:

```typescript
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "@/lib/db";
import type { McpAuthContext } from "../server";
import type { ChangelogItemType, ChangelogStatus } from "@/types/changelog";

function toDbStatus(s: string): ChangelogStatus {
  const map: Record<string, ChangelogStatus> = {
    planned: "PLANNED",
    in_progress: "IN_PROGRESS",
    "in-progress": "IN_PROGRESS",
    completed: "COMPLETED",
  };
  return map[s.toLowerCase()] ?? "PLANNED";
}

function serializeFeature(f: any) {
  return {
    id: f.id,
    type: f.type,
    status: f.status?.toLowerCase(),
    priority: f.priority?.toLowerCase(),
    title: f.title,
    summary: f.summary,
    tags: f.tags,
    createdAt: f.createdAt?.toISOString() ?? null,
    updatedAt: f.updatedAt?.toISOString() ?? null,
  };
}

export function registerTicketTools(server: McpServer, _auth: McpAuthContext) {

  server.tool(
    "traceback_list_tickets",
    "List changelog features from a project. Filter by type, status, or tags.",
    {
      project_id: z.string().describe("Project ID"),
      type: z.enum(["feature", "bugfix", "epic", "task"]).optional(),
      status: z.enum(["planned", "in-progress", "completed"]).optional(),
      limit: z.number().min(1).max(100).optional().describe("Max results, default 50"),
    },
    async ({ project_id, type, status, limit }) => {
      try {
        const features = await db.changelogFeature.findMany({
          where: {
            projectId: project_id,
            ...(type ? { type: type.toUpperCase() as ChangelogItemType } : {}),
            ...(status ? { status: toDbStatus(status) } : {}),
          },
          orderBy: { updatedAt: "desc" },
          take: limit ?? 50,
        });
        return { content: [{ type: "text", text: JSON.stringify(features.map(serializeFeature), null, 2) }] };
      } catch (e: any) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }] };
      }
    }
  );

  server.tool(
    "traceback_get_ticket",
    "Get full changelog feature with all entries and code changes.",
    {
      ticket_id: z.string().describe("ChangelogFeature ID"),
      include_session: z.boolean().optional().describe("Include session log, default true"),
    },
    async ({ ticket_id, include_session }) => {
      try {
        const feature = await db.changelogFeature.findUnique({
          where: { id: ticket_id },
          include: {
            entries: {
              orderBy: { timestamp: "asc" },
              include: { codeChanges: true },
            },
            linkedPrs: { orderBy: { createdAt: "asc" } },
          },
        });
        if (!feature) return { content: [{ type: "text", text: "Error: Feature not found" }] };

        let sessionLog: any[] = [];
        if (include_session !== false) {
          sessionLog = await db.sessionStep.findMany({
            where: { featureId: ticket_id },
            orderBy: { sequence: "asc" },
          });
        }

        const result = { ...serializeFeature(feature), entries: feature.entries, linkedPrs: feature.linkedPrs, sessionLog };
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e: any) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }] };
      }
    }
  );

  server.tool(
    "traceback_create_ticket",
    "Create a new changelog feature in a project.",
    {
      project_id: z.string().describe("Project ID"),
      title: z.string().describe("Feature title"),
      summary: z.string().optional().describe("Short summary"),
      type: z.enum(["feature", "bugfix", "task"]).optional(),
      status: z.enum(["planned", "in-progress", "completed"]).optional(),
    },
    async ({ project_id, title, summary, type, status }) => {
      try {
        const id = `feat-${Date.now()}-ui`;
        const feature = await db.changelogFeature.create({
          data: {
            id,
            projectId: project_id,
            type: (type?.toUpperCase() ?? "FEATURE") as ChangelogItemType,
            status: status ? toDbStatus(status) : "PLANNED",
            priority: "MEDIUM",
            title,
            summary: summary ?? title,
            affectedComponents: [],
            acceptanceCriteria: [],
            tags: [],
            source: "UI",
          },
        });
        return { content: [{ type: "text", text: JSON.stringify(serializeFeature(feature), null, 2) }] };
      } catch (e: any) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }] };
      }
    }
  );

  server.tool(
    "traceback_update_ticket",
    "Update a changelog feature's status or other fields.",
    {
      ticket_id: z.string().describe("ChangelogFeature ID"),
      status: z.enum(["planned", "in-progress", "completed"]).optional(),
      title: z.string().optional(),
      summary: z.string().optional(),
    },
    async ({ ticket_id, status, title, summary }) => {
      try {
        const updates: Record<string, any> = {};
        if (status !== undefined) updates.status = toDbStatus(status);
        if (title !== undefined) updates.title = title;
        if (summary !== undefined) updates.summary = summary;

        const feature = await db.changelogFeature.update({
          where: { id: ticket_id },
          data: updates,
        });
        return { content: [{ type: "text", text: JSON.stringify(serializeFeature(feature), null, 2) }] };
      } catch (e: any) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }] };
      }
    }
  );
}
```

- [ ] **Step 4: comments.ts — TaskComment ist weg, Tool entfernen**

`TaskComment` existiert nicht mehr. Ersetze comments.ts mit einem No-op (damit der MCP-Server nicht bricht, aber das Tool gibt einen klaren Hinweis):

```typescript
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpAuthContext } from "../server";

// TaskComment-Modell wurde entfernt. Kommentare sind jetzt ChangelogEntry-Einträge.
// Dieses Tool ist nicht mehr registriert.
export function registerCommentTools(_server: McpServer, _auth: McpAuthContext) {
  // intentionally empty
}
```

- [ ] **Step 5: Commit**

```bash
git add lib/mcp/tools/tickets.ts lib/mcp/tools/sessions.ts lib/mcp/tools/links.ts lib/mcp/tools/comments.ts
git commit -m "refactor: update MCP tools — ChangelogFeature, featureId, remove TaskComment tool"
```

---

## Task 10 — Alte Dateien löschen

**Files:** Diverse

- [ ] **Step 1: Alte API-Routen löschen**

```bash
cd /Users/sam_zahra_shop/traceback
rm -rf app/api/projects/[id]/epics
rm -rf app/api/tasks
rm app/api/projects/[id]/tickets/route.ts
```

- [ ] **Step 2: Alte Planungs-Komponenten löschen**

```bash
rm components/planning/FeatureBoard.tsx
rm components/planning/FeatureCard.tsx
rm components/planning/KanbanBoard.tsx
rm components/planning/YamlView.tsx
rm components/planning/modals/EpicModal.tsx
rm components/planning/modals/FeatureModal.tsx
rm components/planning/modals/TaskModal.tsx
rm components/planning/modals/TicketModal.tsx
```

Behalte: `CommitsView.tsx`, `DiffModal.tsx`, `SessionViewer.tsx`, `AgentBadge.tsx`, `AgentDelegation.tsx` (für spätere Nutzung).

- [ ] **Step 3: matchFilesToTickets entfernen**

```bash
rm lib/webhook/matchFilesToTickets.ts
```

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit
```

Erwartete Fehler jetzt: Imports auf gelöschte Typen in `PlanningLayout.tsx` und `app/(app)/projects/[id]/page.tsx` — diese werden in Task 11 + 12 behoben. Alle anderen Fehler müssen 0 sein.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: remove old Epic/Feature/Task routes, components, matchFilesToTickets"
```

---

## Task 11 — ChangelogView Komponente

**Files:** `components/changelog/ChangelogView.tsx` (CREATE)

- [ ] **Step 1: ChangelogView.tsx erstellen**

```typescript
"use client";
// components/changelog/ChangelogView.tsx — Feature-Liste mit expandierbarer Entry-Timeline

import { useState, useEffect } from "react";
import type { UIChangelogFeature, ChangelogItemType, ChangelogStatus, ChangelogPriority, ChangelogAgentType } from "@/types/changelog";

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<ChangelogItemType, { label: string; color: string; bg: string }> = {
  FEATURE: { label: "Feature", color: "text-emerald-400", bg: "bg-emerald-500" },
  BUGFIX: { label: "Bugfix", color: "text-amber-400", bg: "bg-amber-500" },
  EPIC: { label: "Epic", color: "text-violet-400", bg: "bg-violet-500" },
  TASK: { label: "Task", color: "text-blue-400", bg: "bg-blue-500" },
};

const STATUS_CONFIG: Record<ChangelogStatus, { label: string; dot: string }> = {
  COMPLETED: { label: "Completed", dot: "bg-emerald-500" },
  IN_PROGRESS: { label: "In Progress", dot: "bg-amber-400" },
  PLANNED: { label: "Planned", dot: "bg-zinc-400" },
};

const PRIORITY_CONFIG: Record<ChangelogPriority, { label: string; color: string }> = {
  HIGH: { label: "High", color: "text-red-400" },
  MEDIUM: { label: "Medium", color: "text-amber-400" },
  LOW: { label: "Low", color: "text-zinc-400" },
};

const AGENT_COLOR: Record<string, string> = {
  FRONTEND: "bg-violet-900 text-violet-300",
  BACKEND: "bg-blue-900 text-blue-300",
  QA: "bg-green-900 text-green-300",
  DEVOPS: "bg-orange-900 text-orange-300",
  FULLSTACK: "bg-indigo-900 text-indigo-300",
  HUMAN: "bg-zinc-800 text-zinc-300",
};

// ─── ENTRY ROW ────────────────────────────────────────────────────────────────

function EntryRow({ entry }: { entry: UIChangelogFeature["entries"][0] }) {
  const [expanded, setExpanded] = useState(false);
  const agentColor = AGENT_COLOR[entry.agentType] ?? "bg-zinc-800 text-zinc-300";
  const hasDetails = entry.what || entry.why || entry.technicalDetails || entry.sideEffects;

  return (
    <div className="flex gap-3 py-2 group/entry">
      <div className="w-[2px] bg-zinc-800 rounded-full shrink-0 mt-1" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${agentColor}`}>
            {entry.agentType}
          </span>
          <span className="text-xs text-zinc-500">{entry.agentName}</span>
          <span className="text-[10px] text-zinc-600 uppercase tracking-wide">{entry.action}</span>
          <span className="text-[10px] text-zinc-600 ml-auto">
            {new Date(entry.timestamp).toLocaleDateString("de-DE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
        <p className="text-sm text-zinc-300 mt-1 leading-snug">{entry.summary}</p>
        {entry.linesAdded + entry.linesRemoved > 0 && (
          <p className="text-[10px] text-zinc-600 mt-0.5">
            {entry.codeChanges.length} file{entry.codeChanges.length !== 1 ? "s" : ""} ·{" "}
            <span className="text-emerald-600">+{entry.linesAdded}</span>{" "}
            <span className="text-red-600">-{entry.linesRemoved}</span>
          </p>
        )}

        {hasDetails && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="mt-1 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            {expanded ? "▲ Less" : "▼ More"}
          </button>
        )}

        {expanded && (
          <div className="mt-2 space-y-2">
            {entry.what && (
              <div>
                <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 mb-0.5">What</p>
                <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap">{entry.what}</p>
              </div>
            )}
            {entry.why && (
              <div>
                <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 mb-0.5">Why</p>
                <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap">{entry.why}</p>
              </div>
            )}
            {entry.technicalDetails && (
              <div>
                <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 mb-0.5">Technical Details</p>
                <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap">{entry.technicalDetails}</p>
              </div>
            )}
            {entry.sideEffects && (
              <div>
                <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 mb-0.5">Side Effects</p>
                <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap">{entry.sideEffects}</p>
              </div>
            )}
            {entry.codeChanges.length > 0 && (
              <div>
                <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 mb-1">Changed Files</p>
                <div className="space-y-0.5">
                  {entry.codeChanges.map((cc) => (
                    <div key={cc.file} className="flex items-center gap-2 text-[10px]">
                      <span className={`w-12 text-center rounded px-1 ${
                        cc.changeType === "ADDED" ? "bg-emerald-900/50 text-emerald-400" :
                        cc.changeType === "REMOVED" ? "bg-red-900/50 text-red-400" :
                        "bg-zinc-800 text-zinc-400"
                      }`}>{cc.changeType.toLowerCase()}</span>
                      <span className="font-mono text-zinc-400 truncate flex-1">{cc.file}</span>
                      <span className="text-zinc-600 shrink-0">+{cc.linesAdded} -{cc.linesRemoved}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── FEATURE ROW ──────────────────────────────────────────────────────────────

function FeatureRow({
  feature,
  projectId,
}: {
  feature: UIChangelogFeature & { _entryCount?: number };
  projectId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [fullFeature, setFullFeature] = useState<UIChangelogFeature | null>(null);
  const [loading, setLoading] = useState(false);

  const typeConf = TYPE_CONFIG[feature.type];
  const statusConf = STATUS_CONFIG[feature.status];
  const priorityConf = PRIORITY_CONFIG[feature.priority];
  const entryCount = feature._entryCount ?? feature.entries?.length ?? 0;

  async function handleExpand() {
    if (!expanded && !fullFeature) {
      setLoading(true);
      try {
        const res = await fetch(`/api/projects/${projectId}/changelog/${feature.id}`);
        if (res.ok) setFullFeature(await res.json());
      } finally {
        setLoading(false);
      }
    }
    setExpanded((e) => !e);
  }

  const displayFeature = fullFeature ?? feature;

  return (
    <div className="border border-zinc-800 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={handleExpand}
        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-zinc-900/50 transition-colors"
      >
        <span className={`w-2 h-2 rounded-full shrink-0 ${typeConf.bg}`} />
        <span className={`text-[10px] font-semibold uppercase tracking-wide ${typeConf.color} shrink-0 w-14`}>
          {typeConf.label}
        </span>
        <span className="flex-1 text-sm font-medium text-zinc-200 text-left truncate">{feature.title}</span>
        <span className="flex items-center gap-1 shrink-0">
          <span className={`w-1.5 h-1.5 rounded-full ${statusConf.dot}`} />
          <span className="text-[10px] text-zinc-500">{statusConf.label}</span>
        </span>
        <span className={`text-[10px] shrink-0 ${priorityConf.color}`}>{priorityConf.label}</span>
        <span className="text-[10px] text-zinc-600 shrink-0">{entryCount} entr{entryCount !== 1 ? "ies" : "y"}</span>
        <span className="text-zinc-600 text-xs shrink-0">{expanded ? "▲" : "▼"}</span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-zinc-800 px-4 py-3 bg-zinc-950/50">
          {/* Summary / metadata */}
          {displayFeature.summary && (
            <p className="text-xs text-zinc-400 mb-3 leading-relaxed">{displayFeature.summary}</p>
          )}
          {displayFeature.businessContext && (
            <div className="mb-3">
              <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 mb-0.5">Business Context</p>
              <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap">{displayFeature.businessContext}</p>
            </div>
          )}
          {displayFeature.rootCause && (
            <div className="mb-3">
              <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 mb-0.5">Root Cause</p>
              <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap">{displayFeature.rootCause}</p>
            </div>
          )}
          {displayFeature.acceptanceCriteria.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 mb-1">Acceptance Criteria</p>
              <ul className="space-y-0.5">
                {displayFeature.acceptanceCriteria.map((c, i) => (
                  <li key={i} className="text-xs text-zinc-400 flex items-start gap-1.5">
                    <span className="text-emerald-500 shrink-0 mt-0.5">✓</span>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {displayFeature.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {displayFeature.tags.map((t) => (
                <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">{t}</span>
              ))}
            </div>
          )}

          {/* Entries */}
          {loading && <p className="text-xs text-zinc-500 py-2">Loading entries...</p>}
          {!loading && displayFeature.entries?.length > 0 && (
            <div className="mt-2 space-y-0">
              <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 mb-2">Entry Timeline</p>
              {displayFeature.entries.map((entry) => (
                <EntryRow key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export interface ChangelogViewProps {
  projectId: string;
  initialFeatures: (UIChangelogFeature & { _entryCount?: number })[];
}

export function ChangelogView({ projectId, initialFeatures }: ChangelogViewProps) {
  const [features, setFeatures] = useState(initialFeatures);
  const [syncing, setSyncing] = useState(false);
  const [filterType, setFilterType] = useState<ChangelogItemType | "ALL">("ALL");
  const [filterStatus, setFilterStatus] = useState<ChangelogStatus | "ALL">("ALL");

  const filtered = features.filter((f) => {
    if (filterType !== "ALL" && f.type !== filterType) return false;
    if (filterStatus !== "ALL" && f.status !== filterStatus) return false;
    return true;
  });

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/changelog/sync`, { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        // Reload features
        const listRes = await fetch(`/api/projects/${projectId}/changelog`);
        if (listRes.ok) setFeatures(await listRes.json());
      }
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Filter sidebar */}
      <aside className="w-48 shrink-0 border-r border-zinc-800 bg-zinc-950 p-3 overflow-y-auto">
        <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 mb-2">Type</p>
        {(["ALL", "FEATURE", "BUGFIX", "EPIC", "TASK"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={`w-full text-left px-2 py-1 rounded text-xs mb-0.5 transition-colors ${
              filterType === t ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t === "ALL" ? "All Types" : TYPE_CONFIG[t].label}
          </button>
        ))}

        <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 mb-2 mt-4">Status</p>
        {(["ALL", "COMPLETED", "IN_PROGRESS", "PLANNED"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`w-full text-left px-2 py-1 rounded text-xs mb-0.5 transition-colors ${
              filterStatus === s ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {s === "ALL" ? "All Status" : STATUS_CONFIG[s].label}
          </button>
        ))}
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="shrink-0 px-5 py-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900">
          <p className="text-sm font-medium text-zinc-300">
            {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
            {filterType !== "ALL" || filterStatus !== "ALL" ? " (filtered)" : ""}
          </p>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-medium text-white transition-colors"
          >
            {syncing ? "Syncing..." : "↓ Sync"}
          </button>
        </div>

        {/* Feature list */}
        <div className="flex-1 overflow-y-auto p-5 space-y-2">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-zinc-500 text-sm">No entries yet.</p>
              <p className="text-zinc-600 text-xs mt-1">Push .agent-changelog/ changes or click Sync.</p>
            </div>
          ) : (
            filtered.map((feature) => (
              <FeatureRow key={feature.id} feature={feature} projectId={projectId} />
            ))
          )}
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/changelog/ChangelogView.tsx
git commit -m "feat: add ChangelogView component with filter sidebar and entry timeline"
```

---

## Task 12 — ProjectLayout (ersetzt PlanningLayout)

**Files:** `components/changelog/ProjectLayout.tsx` (CREATE)

- [ ] **Step 1: ProjectLayout.tsx erstellen**

```typescript
"use client";
// components/changelog/ProjectLayout.tsx — Shell für Projekt-View

import { useState } from "react";
import Link from "next/link";
import { ChangelogView } from "./ChangelogView";
import { CommitsView } from "@/components/planning/CommitsView";
import type { UIProject, UIChangelogFeature } from "@/types/changelog";

type View = "changelog" | "commits";

const VIEW_LABELS: Record<View, string> = {
  changelog: "Changelog",
  commits: "Commits",
};

export function ProjectLayout({
  project,
  initialFeatures,
}: {
  project: UIProject;
  initialFeatures: UIChangelogFeature[];
}) {
  const [view, setView] = useState<View>("changelog");

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <aside className="w-52 shrink-0 h-full flex flex-col border-r border-zinc-800 bg-zinc-950">
        <div className="px-4 py-4 border-b border-zinc-800">
          <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 mb-0.5">Project</p>
          <p className="text-sm font-semibold text-zinc-100 truncate">{project.name}</p>
          <p className="text-[10px] text-zinc-600 font-mono mt-0.5">{project.repoOwner}/{project.repoName}</p>
        </div>

        {/* View toggle */}
        <div className="px-3 py-3 space-y-0.5">
          {(["changelog", "commits"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`w-full text-left px-2 py-2 rounded-lg text-sm transition-colors ${
                view === v
                  ? "bg-zinc-800 text-zinc-100 font-medium"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900"
              }`}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>

        {/* Settings link */}
        <div className="mt-auto px-3 py-3 border-t border-zinc-800">
          <Link
            href={`/projects/${project.id}/settings`}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors text-xs"
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </Link>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-hidden">
        {view === "changelog" ? (
          <ChangelogView projectId={project.id} initialFeatures={initialFeatures} />
        ) : (
          <CommitsView
            projectId={project.id}
            repoUrl={`https://github.com/${project.repoOwner}/${project.repoName}`}
          />
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/changelog/ProjectLayout.tsx
git commit -m "feat: add ProjectLayout — replaces PlanningLayout with changelog + commits view"
```

---

## Task 13 — Project Page aktualisieren

**Files:** `app/(app)/projects/[id]/page.tsx`

- [ ] **Step 1: Server Component umschreiben**

Ersetze den gesamten Inhalt:

```typescript
// app/(app)/projects/[id]/page.tsx — Server Component
// Lädt Projekt + ChangelogFeatures (mit Entry-Count), rendert ProjectLayout

import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ProjectLayout } from "@/components/changelog/ProjectLayout";
import type { UIProject, UIChangelogFeature } from "@/types/changelog";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const project = await db.project.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      repoOwner: true,
      repoName: true,
      defaultBranch: true,
    },
  });

  if (!project) notFound();

  const rawFeatures = await db.changelogFeature.findMany({
    where: { projectId: id },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { entries: true } },
      entries: {
        orderBy: { timestamp: "asc" },
        include: { codeChanges: { orderBy: { file: "asc" } } },
      },
    },
  });

  const uiProject: UIProject = {
    id: project.id,
    name: project.name,
    repoOwner: project.repoOwner,
    repoName: project.repoName,
    defaultBranch: project.defaultBranch,
  };

  const features: UIChangelogFeature[] = rawFeatures.map((f) => ({
    id: f.id,
    projectId: f.projectId,
    parentId: f.parentId,
    type: f.type,
    status: f.status,
    priority: f.priority,
    title: f.title,
    summary: f.summary,
    businessContext: f.businessContext,
    rootCause: f.rootCause,
    impact: f.impact,
    resolution: f.resolution,
    regressionRisk: f.regressionRisk,
    affectedComponents: f.affectedComponents,
    affectedUsers: f.affectedUsers,
    acceptanceCriteria: f.acceptanceCriteria,
    tags: f.tags,
    source: f.source,
    sourceFile: f.sourceFile,
    createdAt: f.createdAt.toISOString(),
    updatedAt: f.updatedAt.toISOString(),
    entries: f.entries.map((e) => ({
      id: e.id,
      featureId: e.featureId,
      timestamp: e.timestamp.toISOString(),
      agentType: e.agentType,
      agentName: e.agentName,
      action: e.action,
      summary: e.summary,
      what: e.what,
      why: e.why,
      technicalDetails: e.technicalDetails,
      sideEffects: e.sideEffects,
      dependencies: e.dependencies,
      relatedEntryIds: e.relatedEntryIds,
      linesAdded: e.linesAdded,
      linesRemoved: e.linesRemoved,
      codeChanges: e.codeChanges.map((cc) => ({
        id: cc.id,
        entryId: cc.entryId,
        file: cc.file,
        changeType: cc.changeType,
        linesAdded: cc.linesAdded,
        linesRemoved: cc.linesRemoved,
        diffSummary: cc.diffSummary,
      })),
    })),
    _entryCount: f._count.entries,
  }));

  return <ProjectLayout project={uiProject} initialFeatures={features} />;
}
```

- [ ] **Step 2: TypeScript-Check**

```bash
npx tsc --noEmit
```

Expected: 0 Fehler.

- [ ] **Step 3: Commit**

```bash
git add app/(app)/projects/[id]/page.tsx
git commit -m "refactor: update project page to use ChangelogFeature + ProjectLayout"
```

---

## Task 14 — Agents-Endpoint + Session/Delegate REST-Routen bereinigen

**Files:** `app/api/tasks/[taskId]/session/route.ts`, `app/api/tasks/[taskId]/delegate/route.ts`, `app/api/tasks/[taskId]/linked-prs/route.ts`

Diese Routen waren unter `/api/tasks/` — wurden in Task 10 gelöscht. Die Session/Delegate/LinkedPR-Funktionalität ist jetzt unter `/api/projects/[id]/changelog/[featureId]/` (Future). Vorerst reichen die bestehenden MCP-Tools.

- [ ] **Step 1: agents/route.ts prüfen**

Die Agents-Route `/api/agents/route.ts` ist unverändert korrekt (liest `db.agent.findMany()`). Keine Änderung nötig.

- [ ] **Step 2: Finaler TypeScript-Check**

```bash
cd /Users/sam_zahra_shop/traceback
npx tsc --noEmit
```

Expected: 0 Fehler.

- [ ] **Step 3: Prisma validate**

```bash
npx prisma validate
```

Expected: `The schema at prisma/schema.prisma is valid!`

- [ ] **Step 4: Dev-Server starten und manuell testen**

```bash
npm run dev
```

Öffne `http://localhost:3000`. Logge dich ein. Gehe zu einem verbundenen Projekt.
Erwartetes Ergebnis: `ProjectLayout` mit leerer Changelog-Liste (noch kein Sync).

Klicke "↓ Sync".
Erwartetes Ergebnis: alle `.agent-changelog/human/features/*.yaml` und `bugfixes/*.yaml` werden gelesen und als Features in der Liste angezeigt.

- [ ] **Step 5: Finaler Commit**

```bash
git add -A
git commit -m "feat: complete changelog sync — parser, DB, UI, webhook integration"
```

---

## Self-Review (bereits inline durchgeführt)

**Spec coverage:**
- ✅ ChangelogFeature/Entry/CodeChange Prisma-Modelle
- ✅ Parser liest human YAML aus GitHub
- ✅ Sync via Webhook (bei .agent-changelog/ Push)
- ✅ Manueller Sync-Button
- ✅ Multi-Project über bestehende Project-Tabelle (Dashboard unverändert)
- ✅ Filter (Type, Status) in ChangelogView
- ✅ Alle YAML-Felder gemapped (businessContext, rootCause, acceptanceCriteria etc.)
- ✅ MCP Tools auf ChangelogFeature umgestellt
- ✅ ticketId → featureId in SessionStep, LinkedPR

**Typ-Konsistenz:** `UIChangelogFeature.entries[].codeChanges` ist `UICodeChange[]` — stimmt mit `ChangelogView`-Usage überein. `createSessionStep({ featureId })` stimmt mit `lib/db/session-steps.ts` überein.

**Keine Platzhalter.**
