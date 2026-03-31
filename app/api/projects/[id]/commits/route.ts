// app/api/projects/[id]/commits/route.ts
// GET /api/projects/:id/commits — Returns the latest commits for a project.

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

  const commits = await db.commit.findMany({
    where: { projectId },
    orderBy: { pushedAt: "desc" },
    take: 50,
  });

  const result = commits.map((c) => ({
    id: c.id,
    sha: c.sha,
    message: c.message,
    author: c.author,
    branch: c.branch,
    pushedAt: c.pushedAt.toISOString(),
    filesChanged: c.filesChanged,
  }));

  return NextResponse.json({ commits: result });
}
