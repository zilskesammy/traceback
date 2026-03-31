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
