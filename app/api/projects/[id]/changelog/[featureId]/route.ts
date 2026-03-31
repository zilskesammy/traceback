// app/api/projects/[id]/changelog/[featureId]/route.ts — GET: Feature + Entries + CodeChanges

import { NextRequest, NextResponse } from "next/server";
import { resolveAuth } from "@/lib/api/auth-middleware";
import { getChangelogFeature } from "@/lib/db/changelog";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; featureId: string }> }
): Promise<NextResponse> {
  const { id: projectId, featureId } = await params;

  const auth = await resolveAuth(req, projectId);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const feature = await getChangelogFeature(featureId);
  if (!feature || feature.projectId !== projectId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(feature);
}
