// app/api/agent-tunnel/status/route.ts

import { NextRequest, NextResponse } from "next/server";
import { resolveAuth } from "@/lib/api/auth-middleware";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  const auth = await resolveAuth(req, projectId);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { agentLastSeenAt: true },
  });

  const online =
    project?.agentLastSeenAt != null &&
    Date.now() - new Date(project.agentLastSeenAt).getTime() < 10_000;

  return NextResponse.json({ online });
}
