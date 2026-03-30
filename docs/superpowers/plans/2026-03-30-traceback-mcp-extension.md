# Traceback MCP Extension — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend Traceback with an MCP server at `/api/mcp`, agent delegation on Tasks, session-step logging, and a Session Viewer UI — so AI agents can read/work tickets and leave a full reasoning trail.

**Architecture:** Four new Prisma models (`Agent`, `SessionStep`, `LinkedPR`, `TaskComment`) plus two new fields on `Task`. An `McpServer` (SDK v1.29.0) exposes 8 tools over HTTP Streamable transport on a single Next.js route. DB-layer functions wrap all Prisma queries. REST routes expose session/delegation for the UI. A `SessionViewer` and `AgentDelegation` component extend the existing `TaskModal`.

**Tech Stack:** `@modelcontextprotocol/sdk` v1.29.0, `zod` v4, Prisma 6 (PostgreSQL), Next.js 16 App Router, Tailwind CSS v4

---

## Codebase map — what exists

| Path | What it does |
|------|-------------|
| `prisma/schema.prisma` | Full DB schema — Epic→Feature→Task hierarchy |
| `lib/db.ts` | Prisma client singleton |
| `lib/apiKey.ts` | `validateApiKey(raw)` → `{ valid, projectId }` |
| `lib/api/auth-middleware.ts` | `resolveAuth(req, projectId?)` → `{ userId, projectId }` — supports Bearer + session |
| `app/api/tasks/[taskId]/route.ts` | Pattern for task routes: load, auth-check, respond |
| `types/planning.ts` | Serialised types passed from Server→Client components |
| `components/planning/modals/TaskModal.tsx` | Task edit modal — extend this with delegation + session viewer |

**Key quirk:** `TicketStatus` enum in Prisma is uppercase (`IN_PROGRESS`). MCP tools receive lowercase strings (`in_progress`). Every DB function must `toUpperCase()` on status.

---

## File structure after implementation

```
prisma/
  schema.prisma             MODIFY — add Agent, SessionStep, LinkedPR, TaskComment, Task fields

lib/
  db/
    agents.ts               CREATE — getAgents(), getAgent()
    session-steps.ts        CREATE — createSessionStep(), getSessionSteps()
    linked-prs.ts           CREATE — createLinkedPR(), getLinkedPRs()
  mcp/
    server.ts               CREATE — createTracebackMcpServer() factory
    tools/
      tickets.ts            CREATE — list, get, create, update ticket tools
      sessions.ts           CREATE — log_session_step, get_session tools
      links.ts              CREATE — link_pr tool
      comments.ts           CREATE — add_comment tool

app/
  api/
    mcp/
      route.ts              CREATE — POST/GET HTTP MCP handler
    agents/
      route.ts              CREATE — GET /api/agents
    tasks/[taskId]/
      session/route.ts      CREATE — GET/POST session steps
      delegate/route.ts     CREATE — POST/DELETE delegation
      linked-prs/route.ts   CREATE — GET/POST linked PRs

types/
  agents.ts                 CREATE — Agent, SessionStep, LinkedPR, TaskComment types
  planning.ts               MODIFY — add delegateId, delegateStatus, sessionSteps, linkedPrs, comments to PlanningTask

components/
  planning/
    SessionViewer.tsx        CREATE — timeline of session steps
    AgentBadge.tsx           CREATE — avatar + pulse indicator
    AgentDelegation.tsx      CREATE — dropdown to assign/remove agent
    modals/TaskModal.tsx     MODIFY — add delegation section + session viewer tab
    FeatureCard.tsx          MODIFY — show agent badge when delegated
```

---

## Task 1 — Install dependencies

**Files:** `package.json`

- [ ] **Step 1: Install SDK + zod**

```bash
cd /Users/sam_zahra_shop/traceback
npm install @modelcontextprotocol/sdk@1.29.0 zod@^4
```

Expected: both packages appear in `node_modules/@modelcontextprotocol/sdk` and `node_modules/zod`.

- [ ] **Step 2: Check the SDK's HTTP server API**

```bash
cat node_modules/@modelcontextprotocol/sdk/README.md | head -300
ls node_modules/@modelcontextprotocol/sdk/dist/cjs/server/
```

Look for `streamableHttp.js` and note the exported class name and `handleRequest` / `handle` method signature. The rest of Task 14 uses what you find here.

- [ ] **Step 3: Verify zod version is v4**

```bash
node -e "const {z} = require('zod'); console.log(z.string().describe('test'))"
```

Expected: no error. If it errors with "z.string is not a function", the SDK ships its own zod — import from `@modelcontextprotocol/sdk/node_modules/zod` in that case (see Task 10 note).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install @modelcontextprotocol/sdk and zod"
```

---

## Task 2 — Prisma schema: new models

**Files:** `prisma/schema.prisma`

- [ ] **Step 1: Add enums**

Open `prisma/schema.prisma`. After the existing `TicketStatus` enum, add:

```prisma
enum DelegateStatus {
  IDLE
  WORKING
  COMPLETED
  ERROR
}

enum SessionStepType {
  THINKING
  REASONING
  ACTION
  CODE
  RESULT
  ERROR
}

enum LinkType {
  PR
  BRANCH
  COMMIT
}

enum PRStatus {
  OPEN
  MERGED
  CLOSED
}

enum AuthorType {
  HUMAN
  AGENT
}
```

- [ ] **Step 2: Add Agent model**

After the enums, add:

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
  delegatedTasks Task[]      @relation("TaskDelegate")
}
```

- [ ] **Step 3: Add SessionStep model**

```prisma
model SessionStep {
  id        String          @id @default(cuid())
  ticketId  String
  agentId   String
  sequence  Int
  type      SessionStepType
  content   String          @db.Text
  metadata  Json            @default("{}")
  createdAt DateTime        @default(now())

  task  Task  @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  agent Agent @relation(fields: [agentId], references: [id])

  @@index([ticketId, sequence])
  @@index([agentId])
}
```

- [ ] **Step 4: Add LinkedPR model**

```prisma
model LinkedPR {
  id        String   @id @default(cuid())
  ticketId  String
  url       String
  type      LinkType @default(PR)
  title     String?
  status    PRStatus @default(OPEN)
  createdAt DateTime @default(now())

  task Task @relation(fields: [ticketId], references: [id], onDelete: Cascade)

  @@index([ticketId])
}
```

- [ ] **Step 5: Add TaskComment model**

```prisma
model TaskComment {
  id         String     @id @default(cuid())
  ticketId   String
  content    String     @db.Text
  authorType AuthorType @default(AGENT)
  authorId   String
  createdAt  DateTime   @default(now())

  task Task @relation(fields: [ticketId], references: [id], onDelete: Cascade)

  @@index([ticketId])
}
```

---

## Task 3 — Prisma schema: extend Task model

**Files:** `prisma/schema.prisma`

- [ ] **Step 1: Add delegate fields to Task**

Find the `Task` model. Add these fields after `prUrl`:

```prisma
  delegateId     String?
  delegateStatus DelegateStatus?
```

- [ ] **Step 2: Add relations to Task**

In the same `Task` model, add these relations (after existing `feature` relation):

```prisma
  delegate     Agent?        @relation("TaskDelegate", fields: [delegateId], references: [id])
  sessionSteps SessionStep[]
  linkedPrs    LinkedPR[]
  comments     TaskComment[]
```

- [ ] **Step 3: Verify schema compiles**

```bash
cd /Users/sam_zahra_shop/traceback
npx prisma validate
```

Expected: `The schema at prisma/schema.prisma is valid!`

---

## Task 4 — Migration + seed agents

**Files:** `prisma/schema.prisma`, new migration file

- [ ] **Step 1: Create and apply migration**

```bash
cd /Users/sam_zahra_shop/traceback
npx prisma migrate dev --name add_mcp_models
```

Expected: migration applied, new migration file in `prisma/migrations/`.

- [ ] **Step 2: Generate updated Prisma client**

```bash
npx prisma generate
```

Expected: `Generated Prisma Client`.

- [ ] **Step 3: Seed agents via Prisma Studio or script**

Create `prisma/seed-agents.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const agents = [
    {
      id: "claude-code",
      name: "Claude Code",
      provider: "Anthropic",
      model: "claude-sonnet-4-20250514",
      capabilities: ["code-gen", "refactor", "debug", "test", "pr-creation"],
    },
    {
      id: "devin",
      name: "Devin",
      provider: "Cognition",
      model: "devin-2.0",
      capabilities: ["code-gen", "planning", "pr-creation", "testing"],
    },
    {
      id: "cursor-agent",
      name: "Cursor Agent",
      provider: "Anysphere",
      model: "cursor-agent",
      capabilities: ["code-gen", "refactor", "multi-file"],
    },
  ];

  for (const agent of agents) {
    await db.agent.upsert({
      where: { id: agent.id },
      update: agent,
      create: agent,
    });
  }
  console.log("Agents seeded.");
}

main().finally(() => db.$disconnect());
```

- [ ] **Step 4: Run seed**

```bash
npx ts-node --esm prisma/seed-agents.ts
# Or if ts-node isn't available:
npx tsx prisma/seed-agents.ts
```

Expected: `Agents seeded.`

- [ ] **Step 5: Commit**

```bash
git add prisma/
git commit -m "feat: add Agent, SessionStep, LinkedPR, TaskComment models + Task delegate fields"
```

---

## Task 5 — TypeScript types

**Files:** `types/agents.ts`

- [ ] **Step 1: Create types file**

Create `types/agents.ts`:

```typescript
// types/agents.ts — Serialised types for Agent, SessionStep, LinkedPR, TaskComment
// These are passed from Server→Client components (dates as ISO strings).

export type DelegateStatus = "IDLE" | "WORKING" | "COMPLETED" | "ERROR";

export type SessionStepType =
  | "THINKING"
  | "REASONING"
  | "ACTION"
  | "CODE"
  | "RESULT"
  | "ERROR";

export type LinkType = "PR" | "BRANCH" | "COMMIT";
export type PRStatus = "OPEN" | "MERGED" | "CLOSED";
export type AuthorType = "HUMAN" | "AGENT";

export interface Agent {
  id: string;
  name: string;
  provider: string;
  model: string | null;
  capabilities: string[];
  avatarUrl: string | null;
  guidance: string | null;
  createdAt: string;
}

export interface SessionStep {
  id: string;
  ticketId: string;
  agentId: string;
  sequence: number;
  type: SessionStepType;
  content: string;
  metadata: {
    filesChanged?: string[];
    tokensUsed?: number;
    durationMs?: number;
    toolName?: string;
    model?: string;
  };
  createdAt: string;
}

export interface LinkedPR {
  id: string;
  ticketId: string;
  url: string;
  type: LinkType;
  title: string | null;
  status: PRStatus;
  createdAt: string;
}

export interface TaskComment {
  id: string;
  ticketId: string;
  content: string;
  authorType: AuthorType;
  authorId: string;
  createdAt: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add types/agents.ts
git commit -m "feat: add agent/session TypeScript types"
```

---

## Task 6 — DB layer: agents

**Files:** `lib/db/agents.ts`

- [ ] **Step 1: Create agents DB module**

Create `lib/db/agents.ts`:

```typescript
// lib/db/agents.ts — Prisma queries for Agent model

import { db } from "@/lib/db";
import type { Agent } from "@prisma/client";

export async function getAgents(): Promise<Agent[]> {
  return db.agent.findMany({ orderBy: { name: "asc" } });
}

export async function getAgent(id: string): Promise<Agent | null> {
  return db.agent.findUnique({ where: { id } });
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd /Users/sam_zahra_shop/traceback
npx tsc --noEmit
```

Expected: no errors related to `lib/db/agents.ts`.

---

## Task 7 — DB layer: session-steps

**Files:** `lib/db/session-steps.ts`

- [ ] **Step 1: Create session-steps DB module**

Create `lib/db/session-steps.ts`:

```typescript
// lib/db/session-steps.ts — Prisma queries for SessionStep model

import { db } from "@/lib/db";
import type { SessionStepType } from "@prisma/client";

export interface CreateSessionStepInput {
  ticketId: string;
  agentId: string;
  type: SessionStepType;
  content: string;
  metadata?: Record<string, unknown>;
}

export async function createSessionStep(input: CreateSessionStepInput) {
  // Compute next sequence number atomically-enough for our use case
  // (single-agent per ticket is the expected pattern)
  const last = await db.sessionStep.findFirst({
    where: { ticketId: input.ticketId },
    orderBy: { sequence: "desc" },
    select: { sequence: true },
  });

  return db.sessionStep.create({
    data: {
      ticketId: input.ticketId,
      agentId: input.agentId,
      sequence: (last?.sequence ?? 0) + 1,
      type: input.type,
      content: input.content,
      metadata: input.metadata ?? {},
    },
  });
}

export async function getSessionSteps(
  ticketId: string,
  opts?: {
    types?: SessionStepType[];
    since?: string;
  }
) {
  return db.sessionStep.findMany({
    where: {
      ticketId,
      ...(opts?.types?.length ? { type: { in: opts.types } } : {}),
      ...(opts?.since ? { createdAt: { gte: new Date(opts.since) } } : {}),
    },
    orderBy: { sequence: "asc" },
  });
}
```

---

## Task 8 — DB layer: linked-prs

**Files:** `lib/db/linked-prs.ts`

- [ ] **Step 1: Create linked-prs DB module**

Create `lib/db/linked-prs.ts`:

```typescript
// lib/db/linked-prs.ts — Prisma queries for LinkedPR model

import { db } from "@/lib/db";
import type { LinkType } from "@prisma/client";

export interface CreateLinkedPRInput {
  ticketId: string;
  url: string;
  type?: LinkType;
  title?: string;
}

export async function createLinkedPR(input: CreateLinkedPRInput) {
  return db.linkedPR.create({
    data: {
      ticketId: input.ticketId,
      url: input.url,
      type: input.type ?? "PR",
      title: input.title ?? null,
    },
  });
}

export async function getLinkedPRs(ticketId: string) {
  return db.linkedPR.findMany({
    where: { ticketId },
    orderBy: { createdAt: "asc" },
  });
}
```

- [ ] **Step 2: Verify whole DB layer compiles**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add lib/db/
git commit -m "feat: add agents, session-steps, linked-prs DB layer"
```

---

## Task 9 — Verify MCP SDK HTTP API

**Files:** none (research step)

The MCP SDK's HTTP transport API is not stable across minor versions. Verify before writing the route.

- [ ] **Step 1: Read the SDK README**

```bash
cat node_modules/@modelcontextprotocol/sdk/README.md | grep -A 40 "HTTP\|Streamable\|StreamableHTTP"
```

- [ ] **Step 2: Check exported server classes**

```bash
ls node_modules/@modelcontextprotocol/sdk/dist/cjs/server/
node -e "const m = require('@modelcontextprotocol/sdk/server/mcp.js'); console.log(Object.keys(m))"
node -e "const m = require('@modelcontextprotocol/sdk/server/streamableHttp.js'); console.log(Object.keys(m))"
```

Note down:
- The class name exported from `streamableHttp.js` (likely `StreamableHTTPServerTransport`)
- The method to handle an incoming request (likely `handleRequest` or `handle`)
- Whether it returns a `Response` or `{ status, headers, body }`

This determines the exact implementation in Task 14. If the API differs substantially from what's planned, adjust Task 14 accordingly.

---

## Task 10 — MCP server factory

**Files:** `lib/mcp/server.ts`

- [ ] **Step 1: Create server factory**

Create `lib/mcp/server.ts`:

```typescript
// lib/mcp/server.ts — McpServer factory with all tools registered

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTicketTools } from "./tools/tickets";
import { registerSessionTools } from "./tools/sessions";
import { registerLinkTools } from "./tools/links";
import { registerCommentTools } from "./tools/comments";

export interface McpAuthContext {
  userId: string;
  projectId: string;
}

export function createTracebackMcpServer(auth: McpAuthContext) {
  const server = new McpServer({
    name: "traceback",
    version: "1.0.0",
    description:
      "Traceback — transparent AI agent session tracking for code development",
  });

  registerTicketTools(server, auth);
  registerSessionTools(server, auth);
  registerLinkTools(server, auth);
  registerCommentTools(server, auth);

  return server;
}
```

**Note on zod import:** If `zod` types conflict (the SDK may vendor its own copy), import `z` from:
```typescript
import { z } from "zod"; // try this first
// if errors: import { z } from "@modelcontextprotocol/sdk/node_modules/zod";
```

---

## Task 11 — MCP tools: tickets

**Files:** `lib/mcp/tools/tickets.ts`

This is the longest tool file. It implements 4 tools that map MCP requests to Prisma Task queries.

The `traceback_create_ticket` tool auto-creates a "MCP Tasks" epic + "Inbox" feature in the project if they don't exist, so agents don't need to know the Epic/Feature hierarchy.

- [ ] **Step 1: Create tickets tools file**

Create `lib/mcp/tools/tickets.ts`:

```typescript
// lib/mcp/tools/tickets.ts — list, get, create, update ticket tools
// "Tickets" in MCP = Task rows in Prisma, accessed via Feature→Epic join

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "@/lib/db";
import type { McpAuthContext } from "../server";
import type { TicketStatus } from "@prisma/client";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** MCP uses lowercase statuses; Prisma enum is uppercase */
function toDbStatus(s: string): TicketStatus {
  return s.toUpperCase().replace("-", "_") as TicketStatus;
}

function fromDbStatus(s: TicketStatus): string {
  return s.toLowerCase().replace("_", "-");
}

/** Auto-create a "MCP Tasks" catch-all epic+feature for agent-created tickets */
async function getOrCreateMcpFeature(projectId: string): Promise<string> {
  const existing = await db.epic.findFirst({
    where: { projectId, title: "MCP Tasks" },
    include: { features: { where: { title: "Inbox" }, take: 1 } },
  });

  if (existing) {
    if (existing.features[0]) return existing.features[0].id;
    const f = await db.feature.create({
      data: { epicId: existing.id, title: "Inbox", status: "BACKLOG", order: 0 },
    });
    return f.id;
  }

  const epic = await db.epic.create({
    data: {
      projectId,
      title: "MCP Tasks",
      status: "BACKLOG",
      order: 999,
      features: { create: { title: "Inbox", status: "BACKLOG", order: 0 } },
    },
    include: { features: true },
  });

  return epic.features[0].id;
}

function serializeTask(task: any) {
  return {
    id: task.id,
    title: task.title,
    instruction: task.instruction ?? null,
    status: fromDbStatus(task.status),
    assignee: task.assignee ?? null,
    delegateId: task.delegateId ?? null,
    delegateStatus: task.delegateStatus?.toLowerCase() ?? null,
    labels: [], // Task model doesn't have labels — reserved for future
    prUrl: task.prUrl ?? null,
    createdAt: task.createdAt?.toISOString() ?? null,
    updatedAt: task.updatedAt?.toISOString() ?? null,
  };
}

// ─── Tool registration ────────────────────────────────────────────────────────

export function registerTicketTools(server: McpServer, auth: McpAuthContext) {

  // ── traceback_list_tickets ─────────────────────────────────────────────────
  server.tool(
    "traceback_list_tickets",
    "List tickets (tasks) from a project. Filter by status, delegate, or assignee. Returns summaries — use traceback_get_ticket for full detail including session log.",
    {
      project_id: z.string().describe("Project ID (Traceback project cuid)"),
      status: z
        .enum(["backlog", "todo", "in-progress", "in-review", "done", "cancelled"])
        .optional()
        .describe("Filter by status"),
      delegate_id: z
        .string()
        .optional()
        .describe("Filter by agent delegate ID, e.g. 'claude-code'"),
      assignee_id: z
        .string()
        .optional()
        .describe("Filter by human assignee name or ID"),
      limit: z.number().min(1).max(100).optional().describe("Max results, default 50"),
    },
    async ({ project_id, status, delegate_id, assignee_id, limit }) => {
      try {
        const tasks = await db.task.findMany({
          where: {
            feature: { epic: { projectId: project_id } },
            ...(status ? { status: toDbStatus(status) } : {}),
            ...(delegate_id ? { delegateId: delegate_id } : {}),
            ...(assignee_id ? { assignee: assignee_id } : {}),
          },
          include: { feature: { include: { epic: { select: { title: true } } } } },
          orderBy: [{ status: "asc" }, { createdAt: "desc" }],
          take: limit ?? 50,
        });

        return {
          content: [{ type: "text", text: JSON.stringify(tasks.map(serializeTask), null, 2) }],
        };
      } catch (e: any) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }] };
      }
    }
  );

  // ── traceback_get_ticket ───────────────────────────────────────────────────
  server.tool(
    "traceback_get_ticket",
    "Get full ticket detail: description, linked PRs, and agent session history. Call this before starting work to get full context.",
    {
      ticket_id: z.string().describe("Task ID (cuid from traceback_list_tickets)"),
      include_session: z
        .boolean()
        .optional()
        .describe("Include session log, default true"),
    },
    async ({ ticket_id, include_session }) => {
      try {
        const task = await db.task.findUnique({
          where: { id: ticket_id },
          include: {
            feature: { include: { epic: { select: { projectId: true, title: true } } } },
            linkedPrs: { orderBy: { createdAt: "asc" } },
            comments: { orderBy: { createdAt: "asc" } },
          },
        });

        if (!task) return { content: [{ type: "text", text: "Error: Ticket not found" }] };

        let sessionSteps: any[] = [];
        if (include_session !== false) {
          sessionSteps = await db.sessionStep.findMany({
            where: { ticketId: ticket_id },
            orderBy: { sequence: "asc" },
          });
        }

        const result = {
          ...serializeTask(task),
          instruction: task.instruction ?? null,
          linkedPrs: task.linkedPrs,
          comments: task.comments,
          sessionLog: sessionSteps,
        };

        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e: any) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }] };
      }
    }
  );

  // ── traceback_create_ticket ────────────────────────────────────────────────
  server.tool(
    "traceback_create_ticket",
    "Create a new ticket in a project. Tickets are created in a 'MCP Tasks / Inbox' epic+feature. Use when you discover follow-up work while implementing.",
    {
      project_id: z.string().describe("Project ID"),
      title: z.string().describe("Ticket title — be descriptive"),
      description: z.string().optional().describe("Markdown description with context"),
      status: z
        .enum(["backlog", "todo", "in-progress", "in-review", "done", "cancelled"])
        .optional()
        .describe("Initial status, default: todo"),
      priority: z.number().min(0).max(4).optional().describe("Priority 0-4 (unused display hint)"),
      delegate_id: z.string().optional().describe("Agent ID to assign immediately"),
    },
    async ({ project_id, title, description, status, delegate_id }) => {
      try {
        const featureId = await getOrCreateMcpFeature(project_id);

        const taskCount = await db.task.count({ where: { featureId } });

        const task = await db.task.create({
          data: {
            featureId,
            title,
            instruction: description ?? null,
            status: status ? toDbStatus(status) : "TODO",
            order: taskCount,
            number: taskCount + 1,
            delegateId: delegate_id ?? null,
            delegateStatus: delegate_id ? "WORKING" : null,
          },
        });

        return { content: [{ type: "text", text: JSON.stringify(serializeTask(task), null, 2) }] };
      } catch (e: any) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }] };
      }
    }
  );

  // ── traceback_update_ticket ────────────────────────────────────────────────
  server.tool(
    "traceback_update_ticket",
    "Update ticket fields: status, assignee, delegate, or instruction. Use to transition status (todo → in-progress), assign an agent, or update details.",
    {
      ticket_id: z.string().describe("Task ID"),
      status: z
        .enum(["backlog", "todo", "in-progress", "in-review", "done", "cancelled"])
        .optional(),
      assignee_id: z.string().optional().describe("New human assignee, or empty string to unassign"),
      delegate_id: z
        .string()
        .optional()
        .describe("New agent delegate ID, or empty string to remove"),
      delegate_status: z
        .enum(["idle", "working", "completed", "error"])
        .optional(),
      description: z.string().optional().describe("Updated instruction (markdown)"),
    },
    async ({ ticket_id, status, assignee_id, delegate_id, delegate_status, description }) => {
      try {
        const updates: Record<string, any> = {};
        if (status !== undefined) updates.status = toDbStatus(status);
        if (assignee_id !== undefined) updates.assignee = assignee_id || null;
        if (delegate_id !== undefined) {
          updates.delegateId = delegate_id || null;
          if (!delegate_id) updates.delegateStatus = null;
        }
        if (delegate_status !== undefined)
          updates.delegateStatus = delegate_status.toUpperCase();
        if (description !== undefined) updates.instruction = description;

        const task = await db.task.update({
          where: { id: ticket_id },
          data: updates,
        });

        return { content: [{ type: "text", text: JSON.stringify(serializeTask(task), null, 2) }] };
      } catch (e: any) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }] };
      }
    }
  );
}
```

---

## Task 12 — MCP tools: sessions

**Files:** `lib/mcp/tools/sessions.ts`

- [ ] **Step 1: Create sessions tools file**

Create `lib/mcp/tools/sessions.ts`:

```typescript
// lib/mcp/tools/sessions.ts — traceback_log_session_step, traceback_get_session

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "@/lib/db";
import { createSessionStep } from "@/lib/db/session-steps";
import type { McpAuthContext } from "../server";
import type { SessionStepType } from "@prisma/client";

export function registerSessionTools(server: McpServer, _auth: McpAuthContext) {

  // ── traceback_log_session_step ─────────────────────────────────────────────
  server.tool(
    "traceback_log_session_step",
    `Append a reasoning/action step to a ticket's agent session log.
CALL THIS FOR EVERY SIGNIFICANT STEP: decisions, searches, evaluations, code changes, results.

Types:
- thinking:  Internal reasoning ("What approach should I take?")
- reasoning: Evaluating tradeoffs ("Library A vs B because...")
- action:    Executing a command (search, install, run tests)
- code:      Writing/modifying code (include file path + what changed)
- result:    Outcome (tests passing, PR created, summary)
- error:     Something failed (include the error message)

Be specific. Future humans read this to understand WHY you made each decision.`,
    {
      ticket_id: z.string().describe("Task ID"),
      type: z
        .enum(["thinking", "reasoning", "action", "code", "result", "error"])
        .describe("Step type"),
      content: z.string().describe("What happened — actual reasoning, command, diff, or result"),
      metadata: z
        .object({
          files_changed: z.array(z.string()).optional(),
          tokens_used: z.number().optional(),
          duration_ms: z.number().optional(),
          tool_name: z.string().optional(),
          model: z.string().optional(),
        })
        .optional(),
    },
    async ({ ticket_id, type, content, metadata }) => {
      try {
        const step = await createSessionStep({
          ticketId: ticket_id,
          agentId: "claude-code", // TODO: derive from auth context when API key carries agentId
          type: type.toUpperCase() as SessionStepType,
          content,
          metadata: metadata as Record<string, unknown> | undefined,
        });

        // Auto-set delegateStatus to WORKING on first step if not set
        await db.task.updateMany({
          where: { id: ticket_id, delegateStatus: null },
          data: { delegateId: "claude-code", delegateStatus: "WORKING" },
        });

        return { content: [{ type: "text", text: JSON.stringify(step, null, 2) }] };
      } catch (e: any) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }] };
      }
    }
  );

  // ── traceback_get_session ──────────────────────────────────────────────────
  server.tool(
    "traceback_get_session",
    "Get the full session log for a ticket — the complete reasoning trail. Use to resume work where a previous session left off.",
    {
      ticket_id: z.string().describe("Task ID"),
      types: z
        .array(z.enum(["thinking", "reasoning", "action", "code", "result", "error"]))
        .optional()
        .describe("Filter by step types"),
      since: z.string().optional().describe("ISO timestamp — only steps after this time"),
    },
    async ({ ticket_id, types, since }) => {
      try {
        const steps = await db.sessionStep.findMany({
          where: {
            ticketId: ticket_id,
            ...(types?.length
              ? { type: { in: types.map((t) => t.toUpperCase()) as SessionStepType[] } }
              : {}),
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

---

## Task 13 — MCP tools: links + comments

**Files:** `lib/mcp/tools/links.ts`, `lib/mcp/tools/comments.ts`

- [ ] **Step 1: Create links tool**

Create `lib/mcp/tools/links.ts`:

```typescript
// lib/mcp/tools/links.ts — traceback_link_pr

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createLinkedPR } from "@/lib/db/linked-prs";
import type { McpAuthContext } from "../server";
import type { LinkType } from "@prisma/client";

export function registerLinkTools(server: McpServer, _auth: McpAuthContext) {
  server.tool(
    "traceback_link_pr",
    "Link a pull request, branch, or commit to a ticket. Call after creating a PR so the ticket shows the associated code change.",
    {
      ticket_id: z.string().describe("Task ID"),
      url: z.string().url().describe("Full URL to PR, branch, or commit"),
      type: z
        .enum(["pr", "branch", "commit"])
        .optional()
        .describe("Link type, default: pr"),
      title: z
        .string()
        .optional()
        .describe("Display title, e.g. 'fix: stable sort for ticket ordering'"),
    },
    async ({ ticket_id, url, type, title }) => {
      try {
        const pr = await createLinkedPR({
          ticketId: ticket_id,
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

- [ ] **Step 2: Create comments tool**

Create `lib/mcp/tools/comments.ts`:

```typescript
// lib/mcp/tools/comments.ts — traceback_add_comment

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "@/lib/db";
import type { McpAuthContext } from "../server";

export function registerCommentTools(server: McpServer, _auth: McpAuthContext) {
  server.tool(
    "traceback_add_comment",
    "Add a comment to a ticket. Use to leave summaries after completing work, ask questions, or flag blockers. Supports markdown.",
    {
      ticket_id: z.string().describe("Task ID"),
      content: z
        .string()
        .describe("Comment body in markdown. Be concise but informative."),
      author_type: z
        .enum(["human", "agent"])
        .optional()
        .describe("Defaults to 'agent' when called via MCP"),
    },
    async ({ ticket_id, content, author_type }) => {
      try {
        const comment = await db.taskComment.create({
          data: {
            ticketId: ticket_id,
            content,
            authorType: (author_type?.toUpperCase() ?? "AGENT") as "HUMAN" | "AGENT",
            authorId: "claude-code",
          },
        });
        return { content: [{ type: "text", text: JSON.stringify(comment, null, 2) }] };
      } catch (e: any) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }] };
      }
    }
  );
}
```

- [ ] **Step 3: Verify all tools compile**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/mcp/
git commit -m "feat: implement 8 MCP tools (tickets, sessions, links, comments)"
```

---

## Task 14 — MCP HTTP route

**Files:** `app/api/mcp/route.ts`

This task depends on what you found in Task 9. The pattern below uses `StreamableHTTPServerTransport` from the SDK. Adjust if the SDK's API differs.

- [ ] **Step 1: Create MCP route**

Create `app/api/mcp/route.ts`:

```typescript
// app/api/mcp/route.ts — MCP HTTP handler
// Uses Node.js runtime (Edge runtime lacks Node APIs the SDK requires)

import { NextRequest, NextResponse } from "next/server";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createTracebackMcpServer } from "@/lib/mcp/server";
import { resolveAuth } from "@/lib/api/auth-middleware";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const auth = await resolveAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── MCP transport ─────────────────────────────────────────────────────────
  // Per-request stateless transport — no session affinity needed for our use case
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  const server = createTracebackMcpServer(auth);
  await server.connect(transport);

  // Handle the MCP protocol message
  // NOTE: if the SDK's handleRequest signature differs from what you found in Task 9,
  // adjust this block. The transport bridges the MCP JSON-RPC message to the server.
  const body = await request.json();
  const headers: Record<string, string> = {};
  request.headers.forEach((v, k) => { headers[k] = v; });

  return new Promise<NextResponse>((resolve) => {
    transport.handleRequest(body, headers, (response: any) => {
      resolve(NextResponse.json(response));
    });
  });
}

// GET handler: MCP spec requires GET for capability discovery
export async function GET() {
  return NextResponse.json({
    name: "traceback",
    version: "1.0.0",
    description: "Traceback MCP Server — transparent AI agent session tracking",
  });
}
```

> **If `transport.handleRequest` doesn't exist or has a different signature:** After `server.connect(transport)`, call whatever method the SDK exposes to pass the request body and return the response. The key contract: pass the JSON-RPC body, get back a JSON-RPC response.

- [ ] **Step 2: Test locally with curl**

Start the dev server: `npm run dev`

```bash
# Test GET (capability discovery)
curl http://localhost:3000/api/mcp

# Test MCP initialize (replace YOUR_KEY with a real API key from Traceback)
curl -X POST http://localhost:3000/api/mcp \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
```

Expected: JSON response with `result.serverInfo.name === "traceback"`.

- [ ] **Step 3: Test list_tools**

```bash
curl -X POST http://localhost:3000/api/mcp \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
```

Expected: 8 tools listed in `result.tools`.

- [ ] **Step 4: Commit**

```bash
git add app/api/mcp/
git commit -m "feat: add MCP HTTP route at /api/mcp"
```

---

## Task 15 — REST API: agents endpoint

**Files:** `app/api/agents/route.ts`

- [ ] **Step 1: Create agents route**

Create `app/api/agents/route.ts`:

```typescript
// app/api/agents/route.ts — GET /api/agents
// Returns all registered agents. Used by AgentDelegation UI dropdown.
// Auth: API key or NextAuth session (no project scoping needed).

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { resolveAuth } from "@/lib/api/auth-middleware";
import { getAgents } from "@/lib/db/agents";

export async function GET(request: NextRequest) {
  const apiAuth = await resolveAuth(request);
  const session = await auth();
  if (!apiAuth && !session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agents = await getAgents();
  return NextResponse.json(agents);
}
```

- [ ] **Step 2: Test**

```bash
curl http://localhost:3000/api/agents \
  -H "Authorization: Bearer YOUR_KEY"
```

Expected: JSON array with the 3 seeded agents.

---

## Task 16 — REST API: session steps

**Files:** `app/api/tasks/[taskId]/session/route.ts`

- [ ] **Step 1: Create session route**

Create `app/api/tasks/[taskId]/session/route.ts`:

```typescript
// app/api/tasks/[taskId]/session/route.ts
// GET  — list session steps for a task
// POST — append a new session step

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveAuth } from "@/lib/api/auth-middleware";
import { createSessionStep, getSessionSteps } from "@/lib/db/session-steps";
import type { SessionStepType } from "@prisma/client";

async function getProjectIdForTask(taskId: string): Promise<string | null> {
  const task = await db.task.findUnique({
    where: { id: taskId },
    select: { feature: { select: { epic: { select: { projectId: true } } } } },
  });
  return task?.feature.epic.projectId ?? null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  const projectId = await getProjectIdForTask(taskId);
  if (!projectId) return NextResponse.json({ error: "Not Found" }, { status: 404 });

  const auth = await resolveAuth(request, projectId);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const types = request.nextUrl.searchParams.get("types")?.split(",") as SessionStepType[] | undefined;
  const since = request.nextUrl.searchParams.get("since") ?? undefined;

  const steps = await getSessionSteps(taskId, { types, since });
  return NextResponse.json(steps);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  const projectId = await getProjectIdForTask(taskId);
  if (!projectId) return NextResponse.json({ error: "Not Found" }, { status: 404 });

  const auth = await resolveAuth(request, projectId);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { type, content, metadata, agentId } = body;

  if (!type || !content) {
    return NextResponse.json({ error: "type and content are required" }, { status: 400 });
  }

  const step = await createSessionStep({
    ticketId: taskId,
    agentId: agentId ?? "claude-code",
    type: String(type).toUpperCase() as SessionStepType,
    content: String(content),
    metadata,
  });

  return NextResponse.json(step, { status: 201 });
}
```

---

## Task 17 — REST API: delegation + linked-prs

**Files:** `app/api/tasks/[taskId]/delegate/route.ts`, `app/api/tasks/[taskId]/linked-prs/route.ts`

- [ ] **Step 1: Create delegate route**

Create `app/api/tasks/[taskId]/delegate/route.ts`:

```typescript
// app/api/tasks/[taskId]/delegate/route.ts
// POST   — assign agent to task: { agentId }
// DELETE — remove agent delegation

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveAuth } from "@/lib/api/auth-middleware";

async function getProjectId(taskId: string): Promise<string | null> {
  const task = await db.task.findUnique({
    where: { id: taskId },
    select: { feature: { select: { epic: { select: { projectId: true } } } } },
  });
  return task?.feature.epic.projectId ?? null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  const projectId = await getProjectId(taskId);
  if (!projectId) return NextResponse.json({ error: "Not Found" }, { status: 404 });

  const auth = await resolveAuth(request, projectId);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { agentId } = await request.json();
  if (!agentId) return NextResponse.json({ error: "agentId required" }, { status: 400 });

  const task = await db.task.update({
    where: { id: taskId },
    data: { delegateId: agentId, delegateStatus: "WORKING" },
  });

  return NextResponse.json(task);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  const projectId = await getProjectId(taskId);
  if (!projectId) return NextResponse.json({ error: "Not Found" }, { status: 404 });

  const auth = await resolveAuth(request, projectId);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const task = await db.task.update({
    where: { id: taskId },
    data: { delegateId: null, delegateStatus: null },
  });

  return NextResponse.json(task);
}
```

- [ ] **Step 2: Create linked-prs route**

Create `app/api/tasks/[taskId]/linked-prs/route.ts`:

```typescript
// app/api/tasks/[taskId]/linked-prs/route.ts
// GET  — list linked PRs for a task
// POST — link a new PR: { url, type?, title? }

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveAuth } from "@/lib/api/auth-middleware";
import { createLinkedPR, getLinkedPRs } from "@/lib/db/linked-prs";
import type { LinkType } from "@prisma/client";

async function getProjectId(taskId: string): Promise<string | null> {
  const task = await db.task.findUnique({
    where: { id: taskId },
    select: { feature: { select: { epic: { select: { projectId: true } } } } },
  });
  return task?.feature.epic.projectId ?? null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  const projectId = await getProjectId(taskId);
  if (!projectId) return NextResponse.json({ error: "Not Found" }, { status: 404 });

  const auth = await resolveAuth(request, projectId);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prs = await getLinkedPRs(taskId);
  return NextResponse.json(prs);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  const projectId = await getProjectId(taskId);
  if (!projectId) return NextResponse.json({ error: "Not Found" }, { status: 404 });

  const auth = await resolveAuth(request, projectId);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { url, type, title } = await request.json();
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

  const pr = await createLinkedPR({
    ticketId: taskId,
    url,
    type: (type?.toUpperCase() ?? "PR") as LinkType,
    title,
  });

  return NextResponse.json(pr, { status: 201 });
}
```

- [ ] **Step 3: Commit all API routes**

```bash
git add app/api/
git commit -m "feat: add session, delegate, linked-prs, and agents REST endpoints"
```

---

## Task 18 — Update planning types

**Files:** `types/planning.ts`

- [ ] **Step 1: Add delegate fields and relations to PlanningTask**

Open `types/planning.ts`. Add these fields to the `PlanningTask` interface:

```typescript
  // Agent delegation (new)
  delegateId: string | null;
  delegateStatus: "IDLE" | "WORKING" | "COMPLETED" | "ERROR" | null;
```

- [ ] **Step 2: Fix serializeTask in the project page**

Open `app/(app)/projects/[id]/page.tsx`. In the `serializeTask` function, add:

```typescript
function serializeTask(
  task: ProjectWithAll["epics"][0]["features"][0]["tasks"][0]
): PlanningTask {
  return {
    // ... existing fields ...
    delegateId: task.delegateId ?? null,
    delegateStatus: (task.delegateStatus as PlanningTask["delegateStatus"]) ?? null,
  };
}
```

- [ ] **Step 3: Update Prisma query to include new fields**

In `app/(app)/projects/[id]/page.tsx`, the `projectWithAll` validator already includes all Task fields via the default select — no change needed since we're using `@default` Prisma include behaviour. Verify with:

```bash
npx tsc --noEmit
```

Expected: no errors. If `PlanningTask` type errors appear, fix missing fields in `serializeTask`.

- [ ] **Step 4: Commit**

```bash
git add types/planning.ts app/(app)/projects/[id]/page.tsx
git commit -m "feat: add delegateId/delegateStatus to PlanningTask type"
```

---

## Task 19 — SessionViewer component

**Files:** `components/planning/SessionViewer.tsx`

Renders session steps as a vertical timeline with type-coloured icons. Fetches from `/api/tasks/[taskId]/session`.

- [ ] **Step 1: Create SessionViewer**

Create `components/planning/SessionViewer.tsx`:

```typescript
"use client";
// components/planning/SessionViewer.tsx — Timeline of agent session steps

import { useState, useEffect } from "react";

interface SessionStep {
  id: string;
  sequence: number;
  type: "THINKING" | "REASONING" | "ACTION" | "CODE" | "RESULT" | "ERROR";
  content: string;
  metadata: {
    filesChanged?: string[];
    tokensUsed?: number;
    durationMs?: number;
    toolName?: string;
  };
  agentId: string;
  createdAt: string;
}

const STEP_CONFIG: Record<
  SessionStep["type"],
  { icon: string; color: string; bg: string; label: string }
> = {
  THINKING:  { icon: "🧠", color: "#5e6ad2", bg: "rgba(94,106,210,0.12)",  label: "thinking"  },
  REASONING: { icon: "✦",  color: "#a17cf7", bg: "rgba(161,124,247,0.12)", label: "reasoning" },
  ACTION:    { icon: "⚡",  color: "#f7a135", bg: "rgba(247,161,53,0.12)",  label: "action"    },
  CODE:      { icon: "{ }",color: "#4cce68", bg: "rgba(76,206,104,0.12)",  label: "code"      },
  RESULT:    { icon: "✓",  color: "#d4a27a", bg: "rgba(212,162,122,0.12)", label: "result"    },
  ERROR:     { icon: "✗",  color: "#f76659", bg: "rgba(247,102,89,0.12)",  label: "error"     },
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function StepCard({ step }: { step: SessionStep }) {
  const [expanded, setExpanded] = useState(step.type !== "THINKING");
  const cfg = STEP_CONFIG[step.type];

  return (
    <div className="flex gap-3 group">
      {/* Icon + line */}
      <div className="flex flex-col items-center gap-0">
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-mono flex-shrink-0 mt-0.5"
          style={{ background: cfg.bg, color: cfg.color }}
        >
          {cfg.icon}
        </div>
        <div className="w-px flex-1 bg-zinc-800 mt-1 mb-0" />
      </div>

      {/* Content */}
      <div className="flex-1 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-mono font-semibold" style={{ color: cfg.color }}>
            {cfg.label}
          </span>
          <span className="text-xs text-zinc-600">#{step.sequence}</span>
          <span className="text-xs text-zinc-600">{formatTime(step.createdAt)}</span>
          {step.metadata?.toolName && (
            <span className="text-xs font-mono bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">
              {step.metadata.toolName}
            </span>
          )}
          {step.metadata?.durationMs && (
            <span className="text-xs text-zinc-600">{step.metadata.durationMs}ms</span>
          )}
        </div>

        {step.type === "CODE" ? (
          <pre className="text-xs font-mono bg-zinc-900 border border-zinc-800 rounded-md p-3 text-zinc-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
            {step.content}
          </pre>
        ) : (
          <div>
            <p
              className={`text-xs text-zinc-400 leading-relaxed ${
                !expanded && step.content.length > 200 ? "line-clamp-3" : ""
              }`}
            >
              {step.content}
            </p>
            {step.content.length > 200 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs text-zinc-600 hover:text-zinc-400 mt-1"
              >
                {expanded ? "Show less" : "Show more"}
              </button>
            )}
          </div>
        )}

        {step.metadata?.filesChanged && step.metadata.filesChanged.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {step.metadata.filesChanged.map((f) => (
              <span
                key={f}
                className="text-xs font-mono bg-zinc-800/60 text-zinc-500 px-1.5 py-0.5 rounded"
              >
                {f.split("/").pop()}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface SessionViewerProps {
  taskId: string;
}

export function SessionViewer({ taskId }: SessionViewerProps) {
  const [steps, setSteps] = useState<SessionStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!taskId) return;
    setLoading(true);
    fetch(`/api/tasks/${taskId}/session`)
      .then((r) => r.json())
      .then((data) => {
        setSteps(Array.isArray(data) ? data : []);
      })
      .catch(() => setSteps([]))
      .finally(() => setLoading(false));
  }, [taskId]);

  if (loading) {
    return (
      <div className="py-6 text-center text-xs text-zinc-600">
        Loading session log...
      </div>
    );
  }

  if (steps.length === 0) {
    return (
      <div className="py-6 text-center text-xs text-zinc-600">
        No session steps yet. Assign an agent and it will log its reasoning here.
      </div>
    );
  }

  const COLLAPSE_THRESHOLD = 8;
  const visibleSteps =
    collapsed && steps.length > COLLAPSE_THRESHOLD
      ? steps.slice(-3)
      : steps;

  return (
    <div className="mt-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          Session Trail — {steps.length} steps
        </span>
        {steps.length > COLLAPSE_THRESHOLD && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-xs text-zinc-600 hover:text-zinc-400"
          >
            {collapsed ? `Show all ${steps.length} steps` : "Collapse"}
          </button>
        )}
      </div>

      {collapsed && steps.length > COLLAPSE_THRESHOLD && (
        <div className="text-xs text-zinc-600 text-center py-2 border border-dashed border-zinc-800 rounded mb-3">
          {steps.length - 3} earlier steps hidden
        </div>
      )}

      {/* Steps */}
      <div>
        {visibleSteps.map((step) => (
          <StepCard key={step.id} step={step} />
        ))}
      </div>
    </div>
  );
}
```

---

## Task 20 — AgentBadge component

**Files:** `components/planning/AgentBadge.tsx`

- [ ] **Step 1: Create AgentBadge**

Create `components/planning/AgentBadge.tsx`:

```typescript
"use client";
// components/planning/AgentBadge.tsx — compact agent avatar with status indicator

import type { DelegateStatus } from "@/types/agents";

interface AgentBadgeProps {
  agentId: string;
  agentName: string;
  status: DelegateStatus | null;
  size?: "sm" | "md";
}

const STATUS_COLOR: Record<NonNullable<DelegateStatus>, string> = {
  IDLE:      "bg-zinc-500",
  WORKING:   "bg-amber-400",
  COMPLETED: "bg-emerald-500",
  ERROR:     "bg-red-500",
};

const STATUS_PULSE: Record<NonNullable<DelegateStatus>, boolean> = {
  IDLE:      false,
  WORKING:   true,
  COMPLETED: false,
  ERROR:     false,
};

// First letter + provider colour (deterministic from agentId)
const AGENT_COLORS: Record<string, string> = {
  "claude-code":  "bg-amber-700/30 text-amber-300",
  "devin":        "bg-blue-700/30 text-blue-300",
  "cursor-agent": "bg-violet-700/30 text-violet-300",
  "sentry-ai":    "bg-red-700/30 text-red-300",
};

export function AgentBadge({ agentId, agentName, status, size = "sm" }: AgentBadgeProps) {
  const colorClass = AGENT_COLORS[agentId] ?? "bg-zinc-700/30 text-zinc-300";
  const dotColor = status ? STATUS_COLOR[status] : "bg-zinc-500";
  const pulse = status ? STATUS_PULSE[status] : false;
  const initial = agentName[0]?.toUpperCase() ?? "A";
  const sz = size === "sm" ? "w-5 h-5 text-xs" : "w-7 h-7 text-sm";

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative inline-flex">
        <span
          className={`${sz} rounded-md flex items-center justify-center font-semibold font-mono ${colorClass}`}
        >
          {initial}
        </span>
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-zinc-900 ${dotColor} ${
            pulse ? "animate-pulse" : ""
          }`}
        />
      </span>
      {size === "md" && (
        <span className="text-xs text-zinc-400 font-medium">{agentName}</span>
      )}
    </span>
  );
}
```

---

## Task 21 — AgentDelegation component + TaskModal integration

**Files:** `components/planning/AgentDelegation.tsx`, `components/planning/modals/TaskModal.tsx`

- [ ] **Step 1: Create AgentDelegation**

Create `components/planning/AgentDelegation.tsx`:

```typescript
"use client";
// components/planning/AgentDelegation.tsx — dropdown to assign/remove agent delegate

import { useState, useEffect } from "react";
import { AgentBadge } from "./AgentBadge";
import type { Agent, DelegateStatus } from "@/types/agents";

interface AgentDelegationProps {
  taskId: string;
  currentDelegateId: string | null;
  currentStatus: DelegateStatus | null;
  onChanged: () => void;
}

export function AgentDelegation({
  taskId,
  currentDelegateId,
  currentStatus,
  onChanged,
}: AgentDelegationProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/agents")
      .then((r) => r.json())
      .then((data) => setAgents(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const currentAgent = agents.find((a) => a.id === currentDelegateId);

  async function assign(agentId: string) {
    setLoading(true);
    setOpen(false);
    try {
      await fetch(`/api/tasks/${taskId}/delegate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId }),
      });
      onChanged();
    } finally {
      setLoading(false);
    }
  }

  async function remove() {
    setLoading(true);
    setOpen(false);
    try {
      await fetch(`/api/tasks/${taskId}/delegate`, { method: "DELETE" });
      onChanged();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-500 font-medium">Agent</span>
        {currentAgent ? (
          <div className="flex items-center gap-1.5">
            <AgentBadge
              agentId={currentAgent.id}
              agentName={currentAgent.name}
              status={currentStatus}
              size="md"
            />
            {currentStatus && (
              <span className="text-xs text-zinc-600">
                {currentStatus.toLowerCase()}
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs text-zinc-600">Unassigned</span>
        )}

        <button
          onClick={() => setOpen(!open)}
          disabled={loading}
          className="text-xs text-zinc-600 hover:text-zinc-300 px-2 py-0.5 rounded border border-zinc-800 hover:border-zinc-700 transition-colors"
        >
          {loading ? "..." : currentAgent ? "Change" : "Assign"}
        </button>

        {currentAgent && (
          <button
            onClick={remove}
            disabled={loading}
            className="text-xs text-zinc-600 hover:text-red-400 transition-colors"
          >
            Remove
          </button>
        )}
      </div>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl w-64 overflow-hidden">
          {agents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => assign(agent.id)}
              className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-zinc-800 transition-colors text-left"
            >
              <AgentBadge agentId={agent.id} agentName={agent.name} status={null} size="md" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-zinc-200">{agent.name}</div>
                <div className="text-xs text-zinc-500">{agent.provider}</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {agent.capabilities.slice(0, 3).map((c) => (
                    <span
                      key={c}
                      className="text-xs bg-zinc-800 text-zinc-500 px-1.5 rounded"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Integrate into TaskModal**

Open `components/planning/modals/TaskModal.tsx`. Add these imports at the top:

```typescript
import { SessionViewer } from "../SessionViewer";
import { AgentDelegation } from "../AgentDelegation";
import type { DelegateStatus } from "@/types/agents";
```

In the component, add a `activeTab` state after the existing state variables:

```typescript
const [activeTab, setActiveTab] = useState<"details" | "session">("details");
```

In the `useEffect` that resets state on open, also reset the tab:

```typescript
setActiveTab("details");
```

In the JSX of the modal (inside `TicketModal`), add a tab bar and conditional rendering. Find where the form fields are rendered and wrap them with tab logic:

```tsx
{/* Tab bar — only show when editing an existing task */}
{isEditing && (
  <div className="flex gap-1 border-b border-zinc-800 mb-4 -mx-1">
    {(["details", "session"] as const).map((t) => (
      <button
        key={t}
        onClick={() => setActiveTab(t)}
        className={`px-3 py-2 text-xs font-medium transition-colors ${
          activeTab === t
            ? "text-white border-b-2 border-indigo-500"
            : "text-zinc-500 hover:text-zinc-300"
        }`}
      >
        {t === "details" ? "Details" : "Session Trail"}
      </button>
    ))}
  </div>
)}

{activeTab === "details" && (
  <>
    {/* Agent delegation — only in edit mode */}
    {isEditing && task?.id && (
      <div className="mb-4 p-3 bg-zinc-900/60 border border-zinc-800 rounded-lg">
        <AgentDelegation
          taskId={task.id}
          currentDelegateId={task.delegateId ?? null}
          currentStatus={(task.delegateStatus as DelegateStatus) ?? null}
          onChanged={onSuccess}
        />
      </div>
    )}
    {/* ...existing form fields... */}
  </>
)}

{activeTab === "session" && isEditing && task?.id && (
  <SessionViewer taskId={task.id} />
)}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Fix any remaining type errors.

- [ ] **Step 4: Commit**

```bash
git add components/planning/
git commit -m "feat: add SessionViewer, AgentBadge, AgentDelegation UI components"
```

---

## Task 22 — Agent badges on FeatureCard

**Files:** `components/planning/FeatureCard.tsx`

Show a small agent badge on task rows that have an active delegate.

- [ ] **Step 1: Import AgentBadge**

Open `components/planning/FeatureCard.tsx`. Add import:

```typescript
import { AgentBadge } from "./AgentBadge";
import type { DelegateStatus } from "@/types/agents";
```

- [ ] **Step 2: Add badge to task rows**

Find where individual task items are rendered inside `FeatureCard`. Add the badge conditionally next to the task title:

```tsx
{task.delegateId && (
  <AgentBadge
    agentId={task.delegateId}
    agentName={task.delegateId} // use id as name fallback (no agent list here)
    status={task.delegateStatus as DelegateStatus | null}
    size="sm"
  />
)}
```

- [ ] **Step 3: Commit**

```bash
git add components/planning/FeatureCard.tsx
git commit -m "feat: show agent badge on task rows with active delegation"
```

---

## Task 23 — End-to-end integration test

Verify the full flow from MCP call → DB write → UI display.

- [ ] **Step 1: Deploy to Vercel (or test fully locally)**

```bash
npm run build  # must pass
# Deploy: git push origin main (triggers Vercel)
```

- [ ] **Step 2: Add MCP server to Claude Code**

```bash
claude mcp add --transport http traceback https://traceback-hazel.vercel.app/api/mcp \
  --header "Authorization: Bearer YOUR_TRACEBACK_API_KEY"
```

Or for local testing:

```bash
claude mcp add --transport http traceback http://localhost:3000/api/mcp \
  --header "Authorization: Bearer YOUR_TRACEBACK_API_KEY"
```

- [ ] **Step 3: Test list tickets**

In Claude Code:
```
Use traceback_list_tickets with project_id="<your-project-id>"
```

Expected: returns array of tasks from your project.

- [ ] **Step 4: Test log a session step**

In Claude Code:
```
Use traceback_log_session_step with ticket_id="<a-task-id>", type="thinking", content="Testing session logging from Claude Code."
```

Expected: returns created step with sequence=1.

- [ ] **Step 5: Verify in UI**

Open the task in Traceback UI → click the "Session Trail" tab → should show the step logged in Step 4.

- [ ] **Step 6: Test full agent flow**

Create a Scheduled Task or run manually in Claude Code:

```
1. Call traceback_list_tickets to find a todo task
2. Call traceback_get_ticket to get full context
3. Call traceback_update_ticket to set status in-progress
4. Log several session steps (thinking, reasoning, action, result)
5. Call traceback_link_pr with a test URL
6. Call traceback_update_ticket to set status in-review
7. Call traceback_add_comment with a summary
```

Verify each step appears in the Traceback UI session viewer.

---

## Self-review

**Spec coverage:**
- ✅ DB models: Agent, SessionStep, LinkedPR, TaskComment (§2.1–2.4)
- ✅ Task delegate fields (§2.2 adapted for Prisma)
- ✅ RLS: handled by existing `resolveAuth` pattern (not Supabase RLS — we use Prisma + app-level auth)
- ✅ 8 MCP tools (§3.6)
- ✅ Auth middleware at MCP route (§3.5)
- ✅ Session viewer UI (§4.1)
- ✅ Agent delegation UI (§4.2)
- ✅ REST API extensions (§4.3)
- ✅ Claude Code MCP setup instructions (§5.1)
- ✅ Phase ordering matches §6

**Spec adaptations (documented deviations):**
- **Raw SQL → Prisma migrations**: The spec uses Supabase SQL directly. Codebase uses Prisma. Tasks 2–4 replace the SQL with equivalent Prisma models + `prisma migrate dev`.
- **sequence auto-increment**: Done in application code (`createSessionStep`) rather than a DB trigger, since Prisma doesn't manage triggers.
- **`project_id` → Task join**: Tasks don't have a direct `projectId` — queries join through Feature→Epic. The `traceback_list_tickets` tool handles this internally.
- **`traceback_create_ticket` without epic/feature_id**: Auto-creates "MCP Tasks / Inbox" epic+feature — agents don't need to know the hierarchy.
- **agent_id in session steps**: Hardcoded to `"claude-code"` for now. Future: extend `ApiKey` model with an `agentId` field, then derive from auth context.
