# Design: Task Creator (Vibe Coding Panel)

**Date:** 2026-04-03  
**Status:** Approved

## Problem

Traceback tracks what AI agents do, but there's no way to *start* an agent task from within the app. Users have to context-switch to a terminal, run Claude Code, and manually log results back into Traceback. This breaks the flow.

## Goal

Embed a full vibe coding panel directly in the Traceback project view. The user types a task in natural language, a local Claude agent executes it on their machine (files, bash, git), and results are automatically saved back to Traceback as changelog entries and feature updates.

## Design Decisions

### Architecture

Three components connected in series:

```
Browser (Chat Panel)
  ↕  POST task / SSE stream
Traceback Server (Vercel)
  ↕  HTTP polling (1s) + push output chunks
Local Agent (npx traceback-agent)
  ↕  tool calls
Claude API (claude-sonnet-4-6 + tools)
```

**Why polling instead of WebSockets:** Vercel serverless functions don't support persistent WebSocket connections. The local agent polls a `/api/agent-tunnel` endpoint every second for pending tasks, and pushes output chunks back to the same endpoint. The browser receives output via SSE (`/api/agent-tunnel/stream`).

**Why Postgres as queue:** Already provisioned. No additional infrastructure needed. Task rows have `status` (pending/running/done/error) and output is stored as append-only chunks.

### Local Agent

A standalone Node.js CLI script (`packages/agent/index.ts`) that users run once in their repo:

```bash
npx traceback-agent start --token <api-key> --project <project-id>
```

The agent:
1. Authenticates via existing Traceback API key system
2. Polls `/api/agent-tunnel?projectId=<id>` for pending tasks
3. On receiving a task, runs it through Claude SDK with tools
4. Streams output chunks back via POST to `/api/agent-tunnel/output`
5. On task completion, calls Traceback MCP tools to create/update data

**Claude tools available to the agent:**
- `read_file(path)` — read any file in the repo
- `write_file(path, content)` — write/create a file
- `bash(command)` — run shell commands (npm, git, tests, etc.)
- `list_files(path, pattern)` — list directory contents
- `traceback_create_feature(title, type, summary)` — create changelog entry
- `traceback_update_feature(id, status)` — update feature status
- `traceback_link_commit(featureId, sha)` — link git commits

### UI: Task Panel

Shown as a fixed panel on the right side of the Changelog view (alongside the feature table). The panel is always visible when the agent is connected; shows a "● offline" indicator when no agent is running.

**Panel sections (top → bottom):**
1. **Header** — "Task Creator" label + agent status badge (online/offline)
2. **Message history** — scrollable list of user messages + agent output (streaming, monospace)
3. **Input area** — multiline textarea, model label, send button (`↵`)

**Message types displayed:**
- User message (blue tinted bubble)
- Agent tool calls (monospace, green checkmarks for completed steps, amber for in-progress)
- Completion summary (green bubble, links to created changelog entry)
- Error state (red bubble)

### Agent Status in Sidebar

The sidebar shows a small status pill at the bottom:
- `● Agent verbunden` (green) — agent is polling, ready
- `○ Kein Agent` (gray) — no agent connected, shows setup hint on hover

The agent is considered "connected" if it has polled within the last 5 seconds (tracked via `lastSeenAt` timestamp in DB).

### Traceback Integration on Completion

When Claude finishes a task (tool call `task_complete` is invoked):
1. A `ChangelogFeature` is created with `status: "completed"`, `type` inferred from task text
2. Any git commits made during the task are linked via `ChangelogEntry`
3. The panel shows a success message with a link to the new feature

### Data Model

New Prisma models:

```prisma
model AgentTask {
  id          String   @id @default(cuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id])
  prompt      String
  status      String   @default("pending")  // pending | running | done | error
  output      AgentTaskChunk[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  completedAt DateTime?
  featureId   String?  // linked ChangelogFeature if created
}

model AgentTaskChunk {
  id        String    @id @default(cuid())
  taskId    String
  task      AgentTask @relation(fields: [taskId], references: [id])
  content   String
  type      String    // text | tool_use | tool_result | error
  createdAt DateTime  @default(now())
}
```

Existing `Project` model gets a `agentLastSeenAt DateTime?` field.

## Files Changed

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `AgentTask`, `AgentTaskChunk`, `agentLastSeenAt` on Project |
| `app/api/agent-tunnel/route.ts` | New — poll endpoint for local agent (GET = get pending task, POST = push output chunk) |
| `app/api/agent-tunnel/stream/route.ts` | New — SSE endpoint for browser to receive task output |
| `app/api/agent-tunnel/heartbeat/route.ts` | New — agent pings every 5s to stay "connected" |
| `components/changelog/TaskPanel.tsx` | New — chat panel UI component |
| `components/changelog/ProjectLayout.tsx` | Add TaskPanel alongside existing views |
| `components/changelog/ProjectSidebar.tsx` | Add agent status pill at bottom |
| `packages/agent/index.ts` | New — local agent CLI (separate from Next.js app) |
| `packages/agent/tools.ts` | New — Claude tool definitions (file, bash, git, traceback) |
| `packages/agent/package.json` | New — standalone package for `npx traceback-agent` |

## Out of Scope

- Multi-agent / parallel task execution
- Agent running on Vercel (security risk, not needed)
- Browser-side code execution
- Mobile layout
- Task history beyond the current session (pagination added later)
- Agent auto-start (user always runs it manually)
