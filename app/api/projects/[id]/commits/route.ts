// app/api/projects/[id]/commits/route.ts
// GET /api/projects/:id/commits — Gibt die letzten Commits des Projekts zurück,
// mit verlinkten Tasks/Features (via changedFiles-Overlap).

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveAuth } from "@/lib/api/auth-middleware";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  const authResult = await resolveAuth(request, projectId);
  if (!authResult) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isMember = await db.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: authResult.userId } },
    select: { id: true },
  });
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Letzte 50 Commits des Projekts
  const commits = await db.commit.findMany({
    where: { projectId },
    orderBy: { pushedAt: "desc" },
    take: 50,
  });

  // Tasks + Features die diffRef auf einen dieser Commits gesetzt haben
  const shas = commits.map((c) => c.sha);

  const [linkedTasks, linkedFeatures] = await Promise.all([
    db.task.findMany({
      where: { diffRef: { in: shas }, feature: { epic: { projectId } } },
      select: { id: true, title: true, status: true, diffRef: true, prUrl: true, changedFiles: true },
    }),
    db.feature.findMany({
      where: { diffRef: { in: shas }, epic: { projectId } },
      select: { id: true, title: true, status: true, diffRef: true, changedFiles: true },
    }),
  ]);

  // Index: sha → { tasks, features }
  const bySha: Record<string, { tasks: typeof linkedTasks; features: typeof linkedFeatures }> = {};
  for (const t of linkedTasks) {
    if (!t.diffRef) continue;
    if (!bySha[t.diffRef]) bySha[t.diffRef] = { tasks: [], features: [] };
    bySha[t.diffRef].tasks.push(t);
  }
  for (const f of linkedFeatures) {
    if (!f.diffRef) continue;
    if (!bySha[f.diffRef]) bySha[f.diffRef] = { tasks: [], features: [] };
    bySha[f.diffRef].features.push(f);
  }

  const result = commits.map((c) => ({
    id: c.id,
    sha: c.sha,
    message: c.message,
    author: c.author,
    branch: c.branch,
    pushedAt: c.pushedAt.toISOString(),
    filesChanged: c.filesChanged,
    linkedTasks: bySha[c.sha]?.tasks ?? [],
    linkedFeatures: bySha[c.sha]?.features ?? [],
  }));

  return NextResponse.json({ commits: result });
}
