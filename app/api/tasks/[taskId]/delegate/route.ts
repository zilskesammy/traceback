import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveAuth } from "@/lib/api/auth-middleware";

async function getProjectId(taskId: string): Promise<string | null> {
  const task = await db.task.findUnique({
    where: { id: taskId },
    select: { feature: { select: { epic: { select: { projectId: true } } } } },
  });
  return task?.feature.epic.projectId ?? null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  const projectId = await getProjectId(taskId);
  if (!projectId) return NextResponse.json({ error: "Not Found" }, { status: 404 });

  const auth = await resolveAuth(request, projectId);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { agentId } = await request.json();
  if (!agentId) return NextResponse.json({ error: "agentId required" }, { status: 400 });

  const task = await db.task.update({
    where: { id: taskId },
    data: { delegateId: agentId, delegateStatus: "WORKING" },
  });

  return NextResponse.json(task);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  const projectId = await getProjectId(taskId);
  if (!projectId) return NextResponse.json({ error: "Not Found" }, { status: 404 });

  const auth = await resolveAuth(request, projectId);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const task = await db.task.update({
    where: { id: taskId },
    data: { delegateId: null, delegateStatus: null },
  });

  return NextResponse.json(task);
}
