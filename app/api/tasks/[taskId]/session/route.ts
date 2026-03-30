import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveAuth } from "@/lib/api/auth-middleware";
import { createSessionStep, getSessionSteps } from "@/lib/db/session-steps";
import type { SessionStepType } from "@prisma/client";

async function getProjectIdForTask(taskId: string): Promise<string | null> {
  const task = await db.task.findUnique({
    where: { id: taskId },
    select: { feature: { select: { epic: { select: { projectId: true } } } } },
  });
  return task?.feature.epic.projectId ?? null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  const projectId = await getProjectIdForTask(taskId);
  if (!projectId) return NextResponse.json({ error: "Not Found" }, { status: 404 });

  const auth = await resolveAuth(request, projectId);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const typesParam = request.nextUrl.searchParams.get("types");
  const types = typesParam ? (typesParam.split(",") as SessionStepType[]) : undefined;
  const since = request.nextUrl.searchParams.get("since") ?? undefined;

  const steps = await getSessionSteps(taskId, { types, since });
  return NextResponse.json(steps);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  const projectId = await getProjectIdForTask(taskId);
  if (!projectId) return NextResponse.json({ error: "Not Found" }, { status: 404 });

  const auth = await resolveAuth(request, projectId);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { type, content, metadata, agentId } = body;

  if (!type || !content) {
    return NextResponse.json({ error: "type and content are required" }, { status: 400 });
  }

  const step = await createSessionStep({
    ticketId: taskId,
    agentId: agentId ?? "claude-code",
    type: String(type).toUpperCase() as SessionStepType,
    content: String(content),
    metadata,
  });

  return NextResponse.json(step, { status: 201 });
}
