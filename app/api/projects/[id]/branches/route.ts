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
