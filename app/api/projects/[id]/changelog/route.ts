// app/api/projects/[id]/changelog/route.ts — GET: List all changelog features

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveAuth } from "@/lib/api/auth-middleware";
import { listChangelogFeatures } from "@/lib/db/changelog";
import type { ChangelogItemType, ChangelogStatus, ChangelogPriority } from "@/types/changelog";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id: projectId } = await params;

  const auth = await resolveAuth(req, projectId);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") as ChangelogItemType | null;
  const status = searchParams.get("status") as ChangelogStatus | null;
  const priority = searchParams.get("priority") as ChangelogPriority | null;
  const tags = searchParams.get("tags")?.split(",").filter(Boolean);
  const limit = Number(searchParams.get("limit") ?? "50");
  const offset = Number(searchParams.get("offset") ?? "0");

  const features = await listChangelogFeatures(projectId, {
    ...(type ? { type } : {}),
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
    ...(tags?.length ? { tags } : {}),
    limit,
    offset,
  });

  return NextResponse.json(features);
}
