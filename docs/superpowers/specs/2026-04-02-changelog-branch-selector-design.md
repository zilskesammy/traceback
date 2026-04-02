# Design: Changelog Branch Selector

**Date:** 2026-04-02  
**Status:** Approved

## Problem

The changelog sync in Traceback always reads from `project.defaultBranch` (usually `main`). But the `agent-changelog` skill writes entries to whatever branch the agent is currently working on. There is no way to tell Traceback "read the changelog from branch X instead."

## Goal

Allow users to select — per project — which Git branch the changelog sync reads from. Selection is persisted and configurable in Project Settings.

## Workflow Context

```
Agent works on branch feat/xyz
  → writes .agent-changelog/ YAML files into that branch
    → user selects feat/xyz as changelog branch in Traceback Settings
      → Sync reads .agent-changelog/ from feat/xyz
        → Features appear in ChangelogView
```

## Design

### 1. Data Model

Add a new optional field to the `Project` model in `prisma/schema.prisma`:

```prisma
changelogBranch  String?  // null = falls back to defaultBranch
```

- No default value — `null` means "not configured, use `defaultBranch`"
- `defaultBranch` remains unchanged (used for webhook tracking)
- Schema applied via `prisma db push`

### 2. API Routes

**`GET /api/projects/[id]/branches`**
- Fetches all branches from the connected GitHub repo via GitHub API
- Uses existing installation token system from `lib/github-api.ts`
- Returns `{ branches: string[] }`
- Auth via `resolveAuth`

**`PATCH /api/projects/[id]`**
- Body: `{ changelogBranch: string }`
- Validates field is non-empty
- Updates `db.project.update({ changelogBranch })`
- Returns updated project
- Auth via `resolveAuth`

### 3. UI — New `ChangelogSection` Component

New client component: `components/settings/ChangelogSection.tsx`

Props:
- `projectId: string`
- `currentBranch: string | null`
- `defaultBranch: string`

Behavior:
- On mount: fetches `GET /api/projects/[id]/branches`
- Shows a dropdown with all branches
- Pre-selects `currentBranch` if set, otherwise shows `defaultBranch` as fallback
- "Speichern" button → `PATCH /api/projects/[id]`
- Loading and error states handled inline

Integration in `app/(app)/projects/[id]/settings/page.tsx`:
- Add `changelogBranch` to the `db.project.findUnique` select
- Render `<ChangelogSection>` below `<RepoSection>`

### 4. Sync Route Change

`app/api/projects/[id]/changelog/sync/route.ts` — one line change:

```ts
// before:
const ref = project.defaultBranch;

// after:
const ref = project.changelogBranch ?? project.defaultBranch;
```

Also add `changelogBranch` to the `select` in `db.project.findUnique`.

## Files to Change

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `changelogBranch String?` to Project |
| `app/api/projects/[id]/branches/route.ts` | New — list GitHub branches |
| `app/api/projects/[id]/route.ts` | New — PATCH to update project fields |
| `components/settings/ChangelogSection.tsx` | New — branch selector UI |
| `app/(app)/projects/[id]/settings/page.tsx` | Add `changelogBranch` to query, render ChangelogSection |
| `app/api/projects/[id]/changelog/sync/route.ts` | Use `changelogBranch ?? defaultBranch` |

## Out of Scope

- Changing `defaultBranch` (used for webhooks) — untouched
- Fixing the `storage_path` config mismatch in `.agent-changelog/` — separate task
- Multi-branch changelog view — future feature
