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
