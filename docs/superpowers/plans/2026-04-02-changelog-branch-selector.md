# Changelog Branch Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to select which Git branch the changelog sync reads from, configured per project in Settings.

**Architecture:** New `changelogBranch` field on `Project` model; a `GET /branches` route fetches branches from GitHub via Octokit; a `PATCH /api/projects/[id]` route saves the selection; a new `ChangelogSection` client component renders the dropdown in Settings; the sync route uses `changelogBranch ?? defaultBranch`.

**Tech Stack:** Next.js App Router, Prisma (db push), Octokit (@octokit/rest), TypeScript, Tailwind CSS

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `prisma/schema.prisma` | Modify | Add `changelogBranch String?` to Project |
| `lib/github-api.ts` | Modify | Add `listBranches()` helper |
| `app/api/projects/[id]/branches/route.ts` | Create | GET — fetch GitHub branches for project |
| `app/api/projects/[id]/route.ts` | Create | PATCH — update `changelogBranch` |
| `components/settings/ChangelogSection.tsx` | Create | Branch dropdown UI with save |
| `app/(app)/projects/[id]/settings/page.tsx` | Modify | Add `changelogBranch` to query, render ChangelogSection |
| `app/api/projects/[id]/changelog/sync/route.ts` | Modify | Use `changelogBranch ?? defaultBranch` |

---

### Task 1: Add `changelogBranch` to Prisma schema and push

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add field to Project model**

In `prisma/schema.prisma`, find the `model Project` block and add the new field after `defaultBranch`:

```prisma
model Project {
  id                   String  @id @default(cuid())
  name                 String
  description          String?
  repoUrl              String
  repoOwner            String
  repoName             String
  githubInstallationId String?
  webhookSecret        String
  defaultBranch        String  @default("main")
  changelogBranch      String?

  members           ProjectMember[]
  invitations       ProjectInvitation[]
  commits           Commit[]
  apiKeys           ApiKey[]
  changelogFeatures ChangelogFeature[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

- [ ] **Step 2: Push schema to database**

```bash
npx prisma db push
```

Expected output: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 3: Verify Prisma client regenerated**

```bash
npx prisma generate
```

Expected: `Generated Prisma Client` message with no errors.

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add changelogBranch field to Project model"
```

---

### Task 2: Add `listBranches()` to GitHub API helper

**Files:**
- Modify: `lib/github-api.ts`

- [ ] **Step 1: Add `listBranches` function**

Append to `lib/github-api.ts` after the `listDirectory` export:

```ts
// ─── BRANCHES ────────────────────────────────────────────────────────────────

/**
 * Lists all branches for a GitHub repository.
 * Returns branch names sorted alphabetically.
 * Uses per_page=100 (GitHub max) — sufficient for most repos.
 */
export async function listBranches(
  owner: string,
  repo: string
): Promise<string[]> {
  const { data } = await octokit.repos.listBranches({
    owner,
    repo,
    per_page: 100,
  });
  return data.map((b) => b.name).sort();
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add lib/github-api.ts
git commit -m "feat: add listBranches helper to github-api"
```

---

### Task 3: Create `GET /api/projects/[id]/branches` route

**Files:**
- Create: `app/api/projects/[id]/branches/route.ts`

- [ ] **Step 1: Create the route file**

Create `app/api/projects/[id]/branches/route.ts`:

```ts
// app/api/projects/[id]/branches/route.ts — GET: list GitHub branches for project

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveAuth } from "@/lib/api/auth-middleware";
import { listBranches } from "@/lib/github-api";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id: projectId } = await params;

  const auth = await resolveAuth(req, projectId);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { repoOwner: true, repoName: true },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const branches = await listBranches(project.repoOwner, project.repoName);
  return NextResponse.json({ branches });
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add "app/api/projects/[id]/branches/route.ts"
git commit -m "feat: add GET /api/projects/[id]/branches route"
```

---

### Task 4: Create `PATCH /api/projects/[id]` route

**Files:**
- Create: `app/api/projects/[id]/route.ts`

- [ ] **Step 1: Create the route file**

Create `app/api/projects/[id]/route.ts`:

```ts
// app/api/projects/[id]/route.ts — PATCH: update project settings

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveAuth } from "@/lib/api/auth-middleware";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id: projectId } = await params;

  const auth = await resolveAuth(req, projectId);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { changelogBranch } = body as { changelogBranch?: unknown };

  if (typeof changelogBranch !== "string" || !changelogBranch.trim()) {
    return NextResponse.json(
      { error: "changelogBranch must be a non-empty string" },
      { status: 400 }
    );
  }

  const project = await db.project.update({
    where: { id: projectId },
    data: { changelogBranch: changelogBranch.trim() },
    select: { id: true, changelogBranch: true },
  });

  return NextResponse.json(project);
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add "app/api/projects/[id]/route.ts"
git commit -m "feat: add PATCH /api/projects/[id] route for project settings"
```

---

### Task 5: Create `ChangelogSection` component

**Files:**
- Create: `components/settings/ChangelogSection.tsx`

- [ ] **Step 1: Create the component**

Create `components/settings/ChangelogSection.tsx`:

```tsx
"use client";
// components/settings/ChangelogSection.tsx — Changelog branch selector for Settings

import { useState, useEffect } from "react";

interface ChangelogSectionProps {
  projectId: string;
  currentBranch: string | null;
  defaultBranch: string;
}

export function ChangelogSection({
  projectId,
  currentBranch,
  defaultBranch,
}: ChangelogSectionProps) {
  const [branches, setBranches] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>(currentBranch ?? defaultBranch);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/branches`)
      .then((r) => r.json())
      .then((data: { branches?: string[] }) => {
        const list = data.branches ?? [];
        setBranches(list);
        // If currentBranch is not in the list, keep it as manual entry
        if (currentBranch && !list.includes(currentBranch)) {
          setBranches([currentBranch, ...list]);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Branches konnten nicht geladen werden.");
        setLoading(false);
      });
  }, [projectId, currentBranch]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changelogBranch: selected }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Fehler beim Speichern.");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Netzwerkfehler.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mb-10">
      <h2 className="text-base font-semibold text-zinc-100 mb-1">Changelog</h2>
      <p className="text-sm text-zinc-500 mb-5">
        Branch aus dem der Changelog synchronisiert wird.
      </p>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4">
        <label className="text-xs font-medium text-zinc-400 block mb-2">
          Changelog Branch
        </label>

        {loading ? (
          <div className="h-9 bg-zinc-800 rounded-lg animate-pulse" />
        ) : (
          <div className="flex gap-2">
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
            >
              {branches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-medium text-white transition-colors"
            >
              {saved ? "✓ Gespeichert" : saving ? "..." : "Speichern"}
            </button>
          </div>
        )}

        {error && (
          <p className="text-xs text-red-400 mt-2">{error}</p>
        )}

        <p className="text-[11px] text-zinc-600 mt-2">
          Standard:{" "}
          <code className="text-zinc-500">{defaultBranch}</code>
          {!currentBranch && " (aktuell aktiv)"}
        </p>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add components/settings/ChangelogSection.tsx
git commit -m "feat: add ChangelogSection component for branch selection"
```

---

### Task 6: Update Settings page

**Files:**
- Modify: `app/(app)/projects/[id]/settings/page.tsx`

- [ ] **Step 1: Add `changelogBranch` to DB query and render ChangelogSection**

Replace the full contents of `app/(app)/projects/[id]/settings/page.tsx`:

```ts
// app/(app)/projects/[id]/settings/page.tsx — Server Component

import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ApiKeysSection } from "@/components/settings/ApiKeysSection";
import { RepoSection } from "@/components/settings/RepoSection";
import { ChangelogSection } from "@/components/settings/ChangelogSection";

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = await params;

  const [project, commitStats] = await Promise.all([
    db.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        repoOwner: true,
        repoName: true,
        repoUrl: true,
        defaultBranch: true,
        changelogBranch: true,
        apiKeys: {
          select: {
            id: true,
            label: true,
            keyPrefix: true,
            lastUsedAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    db.commit.aggregate({
      where: { projectId },
      _count: { id: true },
      _max: { pushedAt: true },
    }),
  ]);

  if (!project) notFound();

  const initialKeys = project.apiKeys.map((k) => ({
    id: k.id,
    label: k.label,
    keyPrefix: k.keyPrefix,
    lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
    createdAt: k.createdAt.toISOString(),
  }));

  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const webhookUrl = `${protocol}://${host}/api/webhook/github`;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-xl font-semibold text-zinc-100">
            {project.name}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">Projekteinstellungen</p>
        </div>

        <RepoSection
          repoOwner={project.repoOwner}
          repoName={project.repoName}
          repoUrl={project.repoUrl}
          defaultBranch={project.defaultBranch}
          lastCommitAt={commitStats._max.pushedAt?.toISOString() ?? null}
          commitCount={commitStats._count.id}
          webhookUrl={webhookUrl}
        />

        <ChangelogSection
          projectId={project.id}
          currentBranch={project.changelogBranch}
          defaultBranch={project.defaultBranch}
        />

        <ApiKeysSection projectId={projectId} initialKeys={initialKeys} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/projects/[id]/settings/page.tsx"
git commit -m "feat: integrate ChangelogSection into settings page"
```

---

### Task 7: Update sync route to use `changelogBranch`

**Files:**
- Modify: `app/api/projects/[id]/changelog/sync/route.ts`

- [ ] **Step 1: Add `changelogBranch` to select and use it as ref**

Replace the full contents of `app/api/projects/[id]/changelog/sync/route.ts`:

```ts
// app/api/projects/[id]/changelog/sync/route.ts — POST: Sync changelog from GitHub

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
    select: {
      repoOwner: true,
      repoName: true,
      defaultBranch: true,
      changelogBranch: true,
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const ref = project.changelogBranch ?? project.defaultBranch;

  try {
    const features = await fetchChangelogFromGitHub(
      project.repoOwner,
      project.repoName,
      ref
    );

    let synced = 0;
    for (const feature of features) {
      await upsertChangelogFeature(projectId, feature);
      synced++;
    }

    return NextResponse.json({ ok: true, synced, total: features.length, branch: ref });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[changelog-sync] Error:", message, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add "app/api/projects/[id]/changelog/sync/route.ts"
git commit -m "feat: use changelogBranch for changelog sync, fallback to defaultBranch"
```

---

### Task 8: Manual verification

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Navigate to Settings**

Open `http://localhost:3000/projects/[id]/settings`. Verify:
- "Changelog" section appears below "GitHub Repository"
- Dropdown loads and shows available branches from the connected repo
- Currently saved branch (or `defaultBranch` if null) is pre-selected

- [ ] **Step 3: Save a branch**

Select a different branch from the dropdown, click "Speichern". Verify:
- Button briefly shows "✓ Gespeichert"
- Refreshing the page shows the newly selected branch still selected

- [ ] **Step 4: Verify sync uses selected branch**

In ChangelogView, click "↓ Sync". Verify in server logs:
- `[changelog-sync]` reads from the selected branch (not `main`)

- [ ] **Step 5: Deploy**

```bash
vercel deploy --prod
```
