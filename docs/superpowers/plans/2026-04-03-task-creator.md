# Task Creator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Embed a vibe-coding chat panel in the Changelog view that sends tasks to a local Claude agent, streams the output back to the browser, and saves results as Traceback changelog entries.

**Architecture:** Browser POSTs a task to Vercel → saves `AgentTask` row in Postgres → local agent polls for it every second → runs Claude with file/bash/git tools → pushes output chunks back to Vercel → browser polls for chunks and renders them live. On completion the agent creates a `ChangelogFeature` via the existing Traceback API.

**Tech Stack:** Next.js 16 App Router, Prisma + Postgres, `@anthropic-ai/sdk` (already installed), `zod` (already installed), `lucide-react`, Tailwind v4

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `prisma/schema.prisma` | Modify | Add `AgentTask`, `AgentTaskChunk`, `agentLastSeenAt` on Project |
| `lib/db/agent-tasks.ts` | Create | DB helpers for AgentTask / AgentTaskChunk |
| `app/api/agent-tunnel/tasks/route.ts` | Create | Browser: POST create task, GET list recent tasks |
| `app/api/agent-tunnel/poll/route.ts` | Create | Agent: GET next pending task for a project |
| `app/api/agent-tunnel/chunks/route.ts` | Create | Agent: POST push chunk · Browser: GET poll for new chunks |
| `app/api/agent-tunnel/heartbeat/route.ts` | Create | Agent: POST update `agentLastSeenAt` |
| `components/changelog/TaskPanel.tsx` | Create | Chat panel UI — message list + input |
| `components/changelog/ProjectLayout.tsx` | Modify | Add `TaskPanel` alongside `ChangelogView` |
| `components/changelog/ProjectSidebar.tsx` | Modify | Add agent status pill at bottom |
| `app/(app)/projects/[id]/page.tsx` | Modify | Pass `agentLastSeenAt` to `ProjectLayout` |
| `scripts/agent.ts` | Create | Local agent CLI — polling loop + Claude + tools |

---

## Task 1: Prisma schema + migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add models to schema**

Add at the bottom of `prisma/schema.prisma`, after the `CodeChange` model:

```prisma
// ─── AGENT TASKS ─────────────────────────────────────────────────────────────

model AgentTask {
  id          String   @id @default(cuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  prompt      String   @db.Text
  status      String   @default("pending")
  featureId   String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  completedAt DateTime?

  chunks AgentTaskChunk[]

  @@index([projectId, status])
}

model AgentTaskChunk {
  id        String    @id @default(cuid())
  taskId    String
  task      AgentTask @relation(fields: [taskId], references: [id], onDelete: Cascade)
  content   String    @db.Text
  chunkType String
  createdAt DateTime  @default(now())

  @@index([taskId, createdAt])
}
```

Also add to the `Project` model (after the `changelogBranch` field):

```prisma
  agentLastSeenAt  DateTime?
  agentTasks       AgentTask[]
```

- [ ] **Step 2: Run migration**

```bash
cd /Users/sam_zahra_shop/traceback && npx prisma migrate dev --name add-agent-tasks
```

Expected: Migration file created and applied, `prisma generate` runs automatically.

- [ ] **Step 3: Verify**

```bash
cd /Users/sam_zahra_shop/traceback && npx prisma studio &
# Check AgentTask and AgentTaskChunk tables exist — then kill it
```

Or just verify the migration file was created:

```bash
ls prisma/migrations/ | tail -3
```

Expected: A new migration folder ending in `_add_agent_tasks`.

- [ ] **Step 4: Commit**

```bash
cd /Users/sam_zahra_shop/traceback && git add prisma/ && git commit -m "feat: add AgentTask, AgentTaskChunk schema + agentLastSeenAt"
```

---

## Task 2: DB helpers

**Files:**
- Create: `lib/db/agent-tasks.ts`

- [ ] **Step 1: Create the file**

```typescript
// lib/db/agent-tasks.ts

import { db } from "@/lib/db";
import type { AgentTask, AgentTaskChunk } from "@prisma/client";

export async function createAgentTask(
  projectId: string,
  prompt: string
): Promise<AgentTask> {
  return db.agentTask.create({
    data: { projectId, prompt, status: "pending" },
  });
}

export async function getNextPendingTask(
  projectId: string
): Promise<AgentTask | null> {
  // Claim atomically: update status to "running" and return the row
  const tasks = await db.agentTask.findMany({
    where: { projectId, status: "pending" },
    orderBy: { createdAt: "asc" },
    take: 1,
  });
  if (tasks.length === 0) return null;
  const task = tasks[0];
  return db.agentTask.update({
    where: { id: task.id },
    data: { status: "running" },
  });
}

export async function pushChunk(
  taskId: string,
  content: string,
  chunkType: string
): Promise<AgentTaskChunk> {
  return db.agentTaskChunk.create({
    data: { taskId, content, chunkType },
  });
}

export async function getChunksAfter(
  taskId: string,
  afterId: string | null
): Promise<AgentTaskChunk[]> {
  return db.agentTaskChunk.findMany({
    where: {
      taskId,
      ...(afterId ? { id: { gt: afterId } } : {}),
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function completeTask(
  taskId: string,
  featureId?: string
): Promise<void> {
  await db.agentTask.update({
    where: { id: taskId },
    data: {
      status: "done",
      completedAt: new Date(),
      ...(featureId ? { featureId } : {}),
    },
  });
}

export async function failTask(taskId: string): Promise<void> {
  await db.agentTask.update({
    where: { id: taskId },
    data: { status: "error", completedAt: new Date() },
  });
}

export async function updateHeartbeat(projectId: string): Promise<void> {
  await db.project.update({
    where: { id: projectId },
    data: { agentLastSeenAt: new Date() },
  });
}

export async function getRecentTasks(
  projectId: string,
  limit = 20
): Promise<AgentTask[]> {
  return db.agentTask.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/sam_zahra_shop/traceback && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors related to `lib/db/agent-tasks.ts`.

- [ ] **Step 3: Commit**

```bash
cd /Users/sam_zahra_shop/traceback && git add lib/db/agent-tasks.ts && git commit -m "feat: add agent-tasks DB helpers"
```

---

## Task 3: API routes (4 endpoints)

**Files:**
- Create: `app/api/agent-tunnel/tasks/route.ts`
- Create: `app/api/agent-tunnel/poll/route.ts`
- Create: `app/api/agent-tunnel/chunks/route.ts`
- Create: `app/api/agent-tunnel/heartbeat/route.ts`

- [ ] **Step 1: Create `tasks/route.ts` (browser creates + lists tasks)**

```typescript
// app/api/agent-tunnel/tasks/route.ts

import { NextRequest, NextResponse } from "next/server";
import { resolveAuth } from "@/lib/api/auth-middleware";
import { createAgentTask, getRecentTasks } from "@/lib/db/agent-tasks";
import { z } from "zod/v4";

const CreateSchema = z.object({
  projectId: z.string(),
  prompt: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { projectId, prompt } = parsed.data;

  const auth = await resolveAuth(req, projectId);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const task = await createAgentTask(projectId, prompt);
  return NextResponse.json(task, { status: 201 });
}

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  const auth = await resolveAuth(req, projectId);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tasks = await getRecentTasks(projectId);
  return NextResponse.json(tasks);
}
```

- [ ] **Step 2: Create `poll/route.ts` (agent polls for pending task)**

```typescript
// app/api/agent-tunnel/poll/route.ts

import { NextRequest, NextResponse } from "next/server";
import { resolveAuth } from "@/lib/api/auth-middleware";
import { getNextPendingTask } from "@/lib/db/agent-tasks";

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  const auth = await resolveAuth(req, projectId);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const task = await getNextPendingTask(projectId);
  return NextResponse.json({ task: task ?? null });
}
```

- [ ] **Step 3: Create `chunks/route.ts` (agent pushes + browser polls chunks)**

```typescript
// app/api/agent-tunnel/chunks/route.ts

import { NextRequest, NextResponse } from "next/server";
import { resolveAuth } from "@/lib/api/auth-middleware";
import {
  pushChunk,
  getChunksAfter,
  completeTask,
  failTask,
} from "@/lib/db/agent-tasks";
import { db } from "@/lib/db";
import { z } from "zod/v4";

const PushSchema = z.object({
  taskId: z.string(),
  projectId: z.string(),
  content: z.string(),
  chunkType: z.string(),
  done: z.boolean().optional(),
  error: z.boolean().optional(),
  featureId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = PushSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { taskId, projectId, content, chunkType, done, error, featureId } =
    parsed.data;

  const auth = await resolveAuth(req, projectId);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (content) {
    await pushChunk(taskId, content, chunkType);
  }
  if (done) await completeTask(taskId, featureId);
  if (error) await failTask(taskId);

  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const taskId = req.nextUrl.searchParams.get("taskId");
  const afterId = req.nextUrl.searchParams.get("after") ?? null;

  if (!taskId) {
    return NextResponse.json({ error: "taskId required" }, { status: 400 });
  }

  // Resolve auth via task's projectId
  const task = await db.agentTask.findUnique({
    where: { id: taskId },
    select: { projectId: true, status: true },
  });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const auth = await resolveAuth(req, task.projectId);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const chunks = await getChunksAfter(taskId, afterId);
  return NextResponse.json({ chunks, taskStatus: task.status });
}
```

- [ ] **Step 4: Create `heartbeat/route.ts` (agent pings every 5s)**

```typescript
// app/api/agent-tunnel/heartbeat/route.ts

import { NextRequest, NextResponse } from "next/server";
import { resolveAuth } from "@/lib/api/auth-middleware";
import { updateHeartbeat } from "@/lib/db/agent-tasks";
import { z } from "zod/v4";

const Schema = z.object({ projectId: z.string() });

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const auth = await resolveAuth(req, parsed.data.projectId);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await updateHeartbeat(parsed.data.projectId);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Verify build**

```bash
cd /Users/sam_zahra_shop/traceback && npm run build 2>&1 | tail -20
```

Expected: Clean build.

- [ ] **Step 6: Commit**

```bash
cd /Users/sam_zahra_shop/traceback && git add app/api/agent-tunnel/ && git commit -m "feat: add agent-tunnel API routes (tasks, poll, chunks, heartbeat)"
```

---

## Task 4: TaskPanel UI component

**Files:**
- Create: `components/changelog/TaskPanel.tsx`

- [ ] **Step 1: Create the component**

```typescript
"use client";
// components/changelog/TaskPanel.tsx

import { useState, useRef, useEffect } from "react";
import { SendHorizontal, Loader2, CheckCircle, XCircle, Bot } from "lucide-react";

interface Chunk {
  id: string;
  content: string;
  chunkType: string;
}

interface Message {
  role: "user" | "agent";
  taskId?: string;
  text?: string;
  chunks?: Chunk[];
  status?: "running" | "done" | "error";
}

export function TaskPanel({
  projectId,
  agentOnline,
}: {
  projectId: string;
  agentOnline: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  async function sendTask() {
    const prompt = input.trim();
    if (!prompt || sending) return;

    setInput("");
    setSending(true);

    // Add user message
    setMessages((prev) => [...prev, { role: "user", text: prompt }]);

    // Create task
    const res = await fetch("/api/agent-tunnel/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, prompt }),
    });
    const task = await res.json();
    const taskId: string = task.id;

    // Add agent placeholder
    setMessages((prev) => [
      ...prev,
      { role: "agent", taskId, chunks: [], status: "running" },
    ]);

    setSending(false);

    // Start polling for chunks
    let lastId: string | null = null;
    pollRef.current = setInterval(async () => {
      const url = `/api/agent-tunnel/chunks?taskId=${taskId}${lastId ? `&after=${lastId}` : ""}`;
      const r = await fetch(url);
      const data = await r.json();

      if (data.chunks?.length > 0) {
        lastId = data.chunks[data.chunks.length - 1].id;
        setMessages((prev) =>
          prev.map((m) =>
            m.taskId === taskId
              ? { ...m, chunks: [...(m.chunks ?? []), ...data.chunks] }
              : m
          )
        );
      }

      if (data.taskStatus === "done" || data.taskStatus === "error") {
        setMessages((prev) =>
          prev.map((m) =>
            m.taskId === taskId
              ? { ...m, status: data.taskStatus }
              : m
          )
        );
        stopPolling();
      }
    }, 1000);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendTask();
    }
  }

  return (
    <div className="flex flex-col h-full border-l border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 w-72 flex-shrink-0">
      {/* Header */}
      <div className="flex-shrink-0 h-10 flex items-center justify-between px-3 border-b border-gray-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Bot className="w-3.5 h-3.5 text-indigo-500" />
          <span className="text-xs font-semibold text-gray-900 dark:text-slate-100">Task Creator</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
              agentOnline ? "bg-emerald-500" : "bg-gray-300 dark:bg-slate-600"
            }`}
          />
          <span className="text-[10px] text-gray-400 dark:text-slate-500">
            {agentOnline ? "online" : "offline"}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-2 py-8">
            <Bot className="w-8 h-8 text-gray-200 dark:text-slate-700" />
            <p className="text-xs text-gray-400 dark:text-slate-500">
              {agentOnline
                ? "Beschreibe eine Aufgabe für den Agent."
                : "Starte den lokalen Agent mit:\nnpx traceback-agent"}
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i}>
            {msg.role === "user" && (
              <div className="flex justify-end">
                <div className="max-w-[85%] bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900 rounded-xl px-3 py-2 text-xs text-indigo-900 dark:text-indigo-200">
                  {msg.text}
                </div>
              </div>
            )}

            {msg.role === "agent" && (
              <div className="space-y-1">
                {(msg.chunks ?? []).map((chunk) => (
                  <div
                    key={chunk.id}
                    className={`text-xs font-mono rounded-lg px-3 py-1.5 ${
                      chunk.chunkType === "tool_use"
                        ? "bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-100 dark:border-amber-900/50"
                        : chunk.chunkType === "tool_result"
                        ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/50"
                        : "bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-300 border border-gray-100 dark:border-slate-700"
                    }`}
                  >
                    {chunk.content}
                  </div>
                ))}

                {msg.status === "running" && (
                  <div className="flex items-center gap-1.5 text-[10px] text-gray-400 dark:text-slate-500 px-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    läuft…
                  </div>
                )}
                {msg.status === "done" && (
                  <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 px-1">
                    <CheckCircle className="w-3 h-3" />
                    Abgeschlossen
                  </div>
                )}
                {msg.status === "error" && (
                  <div className="flex items-center gap-1.5 text-[10px] text-red-500 dark:text-red-400 px-1">
                    <XCircle className="w-3 h-3" />
                    Fehler
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 p-2 border-t border-gray-200 dark:border-slate-800">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={agentOnline ? "Aufgabe beschreiben…" : "Agent offline"}
            disabled={!agentOnline || sending}
            rows={2}
            className="flex-1 resize-none bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 outline-none focus:border-indigo-400 dark:focus:border-indigo-600 disabled:opacity-50 transition-colors"
          />
          <button
            onClick={sendTask}
            disabled={!agentOnline || !input.trim() || sending}
            className="mb-0.5 flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {sending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <SendHorizontal className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
        <p className="mt-1 text-[10px] text-gray-300 dark:text-slate-600 px-1">
          claude-sonnet-4-6 · ↵ senden
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/sam_zahra_shop/traceback && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/sam_zahra_shop/traceback && git add components/changelog/TaskPanel.tsx && git commit -m "feat: add TaskPanel chat UI component"
```

---

## Task 5: Wire TaskPanel into ProjectLayout + Sidebar

**Files:**
- Modify: `components/changelog/ProjectLayout.tsx`
- Modify: `components/changelog/ProjectSidebar.tsx`
- Modify: `app/(app)/projects/[id]/page.tsx`

- [ ] **Step 1: Update `app/(app)/projects/[id]/page.tsx`**

Add `agentLastSeenAt` to the project query select and pass it to `ProjectLayout`. Read the current file first, then apply:

In the `db.project.findUnique` select block, add:
```typescript
      agentLastSeenAt: true,
```

Pass it to `ProjectLayout`:
```typescript
      agentLastSeenAt={project.agentLastSeenAt}
```

Full updated file:

```typescript
// app/(app)/projects/[id]/page.tsx — Server Component

import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
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
      agentLastSeenAt: true,
    },
  });

  if (!project) notFound();

  const rawFeatures = await db.changelogFeature.findMany({
    where: { projectId: id },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { entries: true } },
    },
  });

  const features: UIChangelogFeature[] = rawFeatures.map((f) => ({
    id: f.id,
    projectId: f.projectId,
    type: f.type,
    status: f.status,
    priority: f.priority,
    title: f.title,
    summary: f.summary,
    tags: f.tags,
    updatedAt: f.updatedAt.toISOString(),
    _entryCount: f._count.entries,
  }));

  const uiProject: UIProject = {
    id: project.id,
    name: project.name,
    repoOwner: project.repoOwner,
    repoName: project.repoName,
    defaultBranch: project.defaultBranch,
  };

  const session = await auth();

  return (
    <ProjectLayout
      project={uiProject}
      initialFeatures={features}
      userName={session?.user?.name ?? null}
      userEmail={session?.user?.email ?? null}
      agentLastSeenAt={project.agentLastSeenAt?.toISOString() ?? null}
    />
  );
}
```

- [ ] **Step 2: Update `ProjectLayout.tsx`**

Add `agentLastSeenAt` prop, compute `agentOnline`, add `TaskPanel` next to the views:

```typescript
"use client";
// components/changelog/ProjectLayout.tsx

import { useState } from "react";
import { PanelLeft, ChevronRight, Home } from "lucide-react";
import Link from "next/link";
import { ProjectSidebar } from "./ProjectSidebar";
import { ChangelogView } from "./ChangelogView";
import { CommitsView } from "@/components/planning/CommitsView";
import { TaskPanel } from "./TaskPanel";
import type { UIProject, UIChangelogFeature } from "@/types/changelog";

type View = "changelog" | "commits";

const VIEW_LABELS: Record<View, string> = {
  changelog: "Changelog",
  commits: "Commits",
};

export function ProjectLayout({
  project,
  initialFeatures,
  userName,
  userEmail,
  agentLastSeenAt,
}: {
  project: UIProject;
  initialFeatures: UIChangelogFeature[];
  userName: string | null;
  userEmail: string | null;
  agentLastSeenAt: string | null;
}) {
  const [view, setView] = useState<View>("changelog");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const agentOnline =
    agentLastSeenAt !== null &&
    Date.now() - new Date(agentLastSeenAt).getTime() < 10_000;

  return (
    <div className="flex h-full overflow-hidden bg-gray-50 dark:bg-slate-950">
      {/* Sidebar */}
      <aside
        className={`flex-shrink-0 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 overflow-hidden transition-all duration-200 ${
          sidebarOpen ? "w-52" : "w-0 border-r-0"
        }`}
      >
        <ProjectSidebar
          project={project}
          view={view}
          onViewChange={setView}
          userName={userName}
          userEmail={userEmail}
          agentOnline={agentOnline}
        />
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Breadcrumb bar */}
        <div className="flex-shrink-0 h-10 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 flex items-center px-3 gap-2">
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            className="w-7 h-7 rounded-md border border-gray-200 dark:border-slate-700 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors text-gray-500 dark:text-slate-400 flex-shrink-0"
            title="Sidebar ein-/ausblenden"
          >
            <PanelLeft className="w-3.5 h-3.5" />
          </button>
          <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-slate-500">
            <Link href="/dashboard" className="hover:text-gray-600 dark:hover:text-slate-300 transition-colors flex items-center gap-1">
              <Home className="w-3 h-3" />
              Dashboard
            </Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-gray-600 dark:text-slate-300">{project.name}</span>
            <ChevronRight className="w-3 h-3" />
            <span className="font-medium text-gray-900 dark:text-slate-100">{VIEW_LABELS[view]}</span>
          </div>
        </div>

        {/* Content + Task Panel */}
        <div className="flex-1 flex overflow-hidden min-w-0">
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            <div className={`flex-1 overflow-hidden ${view === "changelog" ? "" : "hidden"}`}>
              <ChangelogView projectId={project.id} initialFeatures={initialFeatures} />
            </div>
            <div className={`flex-1 overflow-hidden ${view === "commits" ? "" : "hidden"}`}>
              <CommitsView
                projectId={project.id}
                repoUrl={`https://github.com/${project.repoOwner}/${project.repoName}`}
              />
            </div>
          </div>
          <TaskPanel projectId={project.id} agentOnline={agentOnline} />
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Update `ProjectSidebar.tsx`**

Add `agentOnline` prop and status pill at the bottom (before the user row). Read the file fully before editing. In the existing `ProjectSidebar` function signature, add the prop:

```typescript
interface ProjectSidebarProps {
  project: UIProject;
  view: View;
  onViewChange: (v: View) => void;
  userName: string | null;
  userEmail: string | null;
  agentOnline: boolean;  // ← add this
}
```

Add the agent status pill between the `</nav>` and the user row `<div>`:

```typescript
      {/* Agent status */}
      <div className="px-3 pb-1 flex-shrink-0">
        <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs ${
          agentOnline
            ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
            : "bg-gray-50 dark:bg-slate-800 text-gray-400 dark:text-slate-500"
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${agentOnline ? "bg-emerald-500" : "bg-gray-300 dark:bg-slate-600"}`} />
          {agentOnline ? "Agent verbunden" : "Kein Agent"}
        </div>
      </div>
```

- [ ] **Step 4: Verify build**

```bash
cd /Users/sam_zahra_shop/traceback && npm run build 2>&1 | tail -20
```

Expected: Clean build.

- [ ] **Step 5: Commit**

```bash
cd /Users/sam_zahra_shop/traceback && git add components/changelog/ProjectLayout.tsx components/changelog/ProjectSidebar.tsx "app/(app)/projects/[id]/page.tsx" && git commit -m "feat: wire TaskPanel into ProjectLayout, agent status in sidebar"
```

---

## Task 6: Local agent CLI

**Files:**
- Create: `scripts/agent.ts`

This script runs on the developer's local machine. It authenticates via API key, polls for tasks, runs Claude with tools, and streams output back.

- [ ] **Step 1: Create `scripts/agent.ts`**

```typescript
#!/usr/bin/env npx tsx
// scripts/agent.ts — Local Traceback agent
// Usage: TRACEBACK_API_KEY=tb_xxx TRACEBACK_PROJECT_ID=xxx ANTHROPIC_API_KEY=sk-ant-xxx npx tsx scripts/agent.ts

import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const API_KEY = process.env.TRACEBACK_API_KEY;
const PROJECT_ID = process.env.TRACEBACK_PROJECT_ID;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const BASE_URL = process.env.TRACEBACK_URL ?? "https://traceback-hazel.vercel.app";
const REPO_DIR = process.env.REPO_DIR ?? process.cwd();

if (!API_KEY || !PROJECT_ID || !ANTHROPIC_KEY) {
  console.error(
    "Missing env vars: TRACEBACK_API_KEY, TRACEBACK_PROJECT_ID, ANTHROPIC_API_KEY"
  );
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${API_KEY}`,
};

// ─── Traceback API helpers ────────────────────────────────────────────────────

async function heartbeat() {
  await fetch(`${BASE_URL}/api/agent-tunnel/heartbeat`, {
    method: "POST",
    headers,
    body: JSON.stringify({ projectId: PROJECT_ID }),
  });
}

async function pollTask() {
  const res = await fetch(
    `${BASE_URL}/api/agent-tunnel/poll?projectId=${PROJECT_ID}`,
    { headers }
  );
  const data = await res.json();
  return data.task as { id: string; prompt: string } | null;
}

async function pushChunk(
  taskId: string,
  content: string,
  chunkType: string,
  done = false,
  error = false,
  featureId?: string
) {
  await fetch(`${BASE_URL}/api/agent-tunnel/chunks`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      taskId,
      projectId: PROJECT_ID,
      content,
      chunkType,
      done,
      error,
      featureId,
    }),
  });
}

async function createFeature(
  title: string,
  type: string,
  summary: string
): Promise<string | null> {
  const res = await fetch(
    `${BASE_URL}/api/projects/${PROJECT_ID}/changelog`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: `task-${Date.now()}`,
        type: type.toUpperCase(),
        status: "COMPLETED",
        priority: "MEDIUM",
        title,
        summary,
        source: "UI",
        tags: ["agent"],
        affectedComponents: [],
        acceptanceCriteria: [],
      }),
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.id ?? null;
}

// ─── Claude tools ─────────────────────────────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: "read_file",
    description: "Read a file from the repository",
    input_schema: {
      type: "object" as const,
      properties: { path: { type: "string", description: "Relative path from repo root" } },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Write content to a file (creates or overwrites)",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "Relative path from repo root" },
        content: { type: "string", description: "Full file content" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "bash",
    description: "Run a shell command in the repository root",
    input_schema: {
      type: "object" as const,
      properties: { command: { type: "string", description: "Shell command to run" } },
      required: ["command"],
    },
  },
  {
    name: "list_files",
    description: "List files in a directory",
    input_schema: {
      type: "object" as const,
      properties: {
        dir: { type: "string", description: "Directory path relative to repo root, default '.'" },
      },
      required: [],
    },
  },
  {
    name: "task_complete",
    description: "Mark the task as done. Optionally create a Traceback changelog entry.",
    input_schema: {
      type: "object" as const,
      properties: {
        summary: { type: "string", description: "What was accomplished" },
        createEntry: {
          type: "object",
          description: "If provided, creates a Traceback changelog entry",
          properties: {
            title: { type: "string" },
            type: { type: "string", enum: ["FEATURE", "BUGFIX", "TASK", "EPIC"] },
            summary: { type: "string" },
          },
          required: ["title", "type", "summary"],
        },
      },
      required: ["summary"],
    },
  },
];

// ─── Tool executor ────────────────────────────────────────────────────────────

function executeTool(
  name: string,
  input: Record<string, unknown>
): { result: string; featureId?: string } {
  try {
    if (name === "read_file") {
      const filePath = path.join(REPO_DIR, input.path as string);
      const content = fs.readFileSync(filePath, "utf-8");
      return { result: content.slice(0, 8000) }; // limit output
    }

    if (name === "write_file") {
      const filePath = path.join(REPO_DIR, input.path as string);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, input.content as string, "utf-8");
      return { result: `Written: ${input.path}` };
    }

    if (name === "bash") {
      const output = execSync(input.command as string, {
        cwd: REPO_DIR,
        timeout: 60_000,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      return { result: output.slice(0, 4000) };
    }

    if (name === "list_files") {
      const dir = path.join(REPO_DIR, (input.dir as string) ?? ".");
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const result = entries
        .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
        .join("\n");
      return { result };
    }

    return { result: "Unknown tool" };
  } catch (e: unknown) {
    return { result: `Error: ${e instanceof Error ? e.message : String(e)}` };
  }
}

// ─── Task runner ──────────────────────────────────────────────────────────────

async function runTask(taskId: string, prompt: string) {
  console.log(`▶ Running task ${taskId}: ${prompt.slice(0, 60)}…`);

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: prompt },
  ];

  let featureId: string | undefined;
  let done = false;

  while (!done) {
    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 8096,
      tools: TOOLS,
      messages,
      system: `You are a coding agent working in the repository at ${REPO_DIR}. 
Complete the user's task using the available tools.
When you are finished, call task_complete with a summary of what you did.
If the task involved creating a feature or fixing a bug, also provide createEntry.`,
    });

    let textBuffer = "";
    let currentToolName = "";
    let currentToolInput = "";
    let currentToolId = "";

    for await (const event of stream) {
      if (event.type === "content_block_start") {
        if (event.content_block.type === "tool_use") {
          currentToolName = event.content_block.name;
          currentToolId = event.content_block.id;
          currentToolInput = "";
        }
      }

      if (event.type === "content_block_delta") {
        if (event.delta.type === "text_delta") {
          textBuffer += event.delta.text;
          // Push text in chunks of ~200 chars
          if (textBuffer.length > 200) {
            await pushChunk(taskId, textBuffer, "text");
            textBuffer = "";
          }
        }
        if (event.delta.type === "input_json_delta") {
          currentToolInput += event.delta.partial_json;
        }
      }

      if (event.type === "content_block_stop" && currentToolName) {
        // Flush remaining text
        if (textBuffer) {
          await pushChunk(taskId, textBuffer, "text");
          textBuffer = "";
        }

        // Parse and execute tool
        let toolInput: Record<string, unknown> = {};
        try {
          toolInput = JSON.parse(currentToolInput);
        } catch {
          toolInput = {};
        }

        if (currentToolName === "task_complete") {
          const inp = toolInput as {
            summary: string;
            createEntry?: { title: string; type: string; summary: string };
          };

          if (inp.createEntry) {
            featureId =
              (await createFeature(
                inp.createEntry.title,
                inp.createEntry.type,
                inp.createEntry.summary
              )) ?? undefined;
          }

          await pushChunk(taskId, `✓ ${inp.summary}`, "done", true, false, featureId);
          done = true;
        } else {
          await pushChunk(taskId, `▶ ${currentToolName}(${JSON.stringify(toolInput).slice(0, 100)})`, "tool_use");
          const { result } = executeTool(currentToolName, toolInput);
          await pushChunk(taskId, result.slice(0, 500), "tool_result");

          // Add tool result to message history
          const lastMessage = messages[messages.length - 1];
          if (lastMessage.role === "assistant") {
            messages.push({
              role: "user",
              content: [
                {
                  type: "tool_result",
                  tool_use_id: currentToolId,
                  content: result,
                },
              ],
            });
          }
        }

        currentToolName = "";
        currentToolInput = "";
        currentToolId = "";
      }
    }

    // Flush remaining text
    if (textBuffer) {
      await pushChunk(taskId, textBuffer, "text");
    }

    // Add assistant response to history if not done
    if (!done) {
      const response = await stream.finalMessage();
      messages.push({ role: "assistant", content: response.content });
    }
  }

  console.log(`✓ Task ${taskId} complete`);
}

// ─── Main loop ────────────────────────────────────────────────────────────────

async function main() {
  console.log(`🤖 Traceback agent started`);
  console.log(`   Project: ${PROJECT_ID}`);
  console.log(`   Repo: ${REPO_DIR}`);
  console.log(`   Server: ${BASE_URL}`);

  // Heartbeat every 5 seconds
  setInterval(heartbeat, 5_000);
  await heartbeat();

  // Poll for tasks every 1 second
  let busy = false;
  setInterval(async () => {
    if (busy) return;
    const task = await pollTask();
    if (!task) return;

    busy = true;
    try {
      await runTask(task.id, task.prompt);
    } catch (e) {
      console.error(`Task ${task.id} failed:`, e);
      await pushChunk(task.id, `Error: ${e instanceof Error ? e.message : String(e)}`, "text", false, true);
    } finally {
      busy = false;
    }
  }, 1_000);
}

main().catch(console.error);
```

- [ ] **Step 2: Add `tsx` as dev dependency (needed to run the script)**

```bash
cd /Users/sam_zahra_shop/traceback && npm install --save-dev tsx
```

- [ ] **Step 3: Add agent script to `package.json`**

In `package.json`, add to `"scripts"`:
```json
"agent": "tsx scripts/agent.ts"
```

So the user can run: `npm run agent`

- [ ] **Step 4: Add env vars to `.env.example`**

Append to `.env.example`:
```
# ─── LOCAL AGENT ─────────────────────────────────────────────────────────────

# API Key from your Traceback project (Settings → API Keys)
TRACEBACK_API_KEY="tb_xxxxxxxxxxxxxxxxxxxxx"

# Your Traceback project ID (from the URL: /projects/<id>)
TRACEBACK_PROJECT_ID="your-project-id"

# Traceback server URL (production or local)
TRACEBACK_URL="https://traceback-hazel.vercel.app"

# Directory of the repository to work in (defaults to current directory)
REPO_DIR="/path/to/your/repo"
```

- [ ] **Step 5: Verify the script type-checks**

```bash
cd /Users/sam_zahra_shop/traceback && npx tsc --noEmit scripts/agent.ts 2>&1 | head -30
```

Expected: No errors (or only "Cannot find module" for path resolution — acceptable since `scripts/` is outside `tsconfig` paths).

- [ ] **Step 6: Verify full build still passes**

```bash
cd /Users/sam_zahra_shop/traceback && npm run build 2>&1 | tail -20
```

Expected: Clean build.

- [ ] **Step 7: Commit**

```bash
cd /Users/sam_zahra_shop/traceback && git add scripts/agent.ts package.json package-lock.json .env.example && git commit -m "feat: add local agent CLI script (scripts/agent.ts)"
```

---

## Task 7: Deploy + end-to-end smoke test

**Files:**
- No code changes — verify the full system works

- [ ] **Step 1: Push and deploy**

```bash
cd /Users/sam_zahra_shop/traceback && git push && vercel --prod 2>&1 | tail -5
```

Expected: Deployment URL printed.

- [ ] **Step 2: Create an API key in the UI**

Open the deployed app → project settings → API Keys → create a key. Copy the value.

- [ ] **Step 3: Start the local agent**

In a terminal in a test repository:

```bash
TRACEBACK_API_KEY=<your-key> \
TRACEBACK_PROJECT_ID=<your-project-id> \
ANTHROPIC_API_KEY=<your-anthropic-key> \
TRACEBACK_URL=https://traceback-hazel.vercel.app \
npm run agent
```

Expected output:
```
🤖 Traceback agent started
   Project: <id>
   Repo: /path/to/repo
   Server: https://traceback-hazel.vercel.app
```

- [ ] **Step 4: Check agent status in UI**

Open the project in the browser. The sidebar should show `● Agent verbunden` and the Task Panel header should show `● online`.

- [ ] **Step 5: Send a test task**

Type `list the files in the current directory` in the Task Panel input and press Enter.

Expected: Agent picks it up within 1 second, runs `list_files`, streams output chunks back, shows `✓ Abgeschlossen`.

- [ ] **Step 6: Final commit**

```bash
cd /Users/sam_zahra_shop/traceback && git push
```

---

## Zod import note

This codebase uses `zod` v4 (`"zod": "^4.3.6"`). In zod v4, import as:
```typescript
import { z } from "zod/v4";
```
Not `from "zod"` — that resolves to the v3 compat layer. Use `"zod/v4"` throughout.
