// app/api/agent-tunnel/poll/route.ts

import { NextRequest, NextResponse } from "next/server";
import { resolveAuth } from "@/lib/api/auth-middleware";
import { getNextPendingTask } from "@/lib/db/agent-tasks";

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  const auth = await resolveAuth(req, projectId);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const task = await getNextPendingTask(projectId);
  return NextResponse.json({ task: task ?? null });
}
