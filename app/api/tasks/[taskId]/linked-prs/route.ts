import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveAuth } from "@/lib/api/auth-middleware";
import { createLinkedPR, getLinkedPRs } from "@/lib/db/linked-prs";
import type { LinkType } from "@prisma/client";

async function getProjectId(taskId: string): Promise<string | null> {
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
  const projectId = await getProjectId(taskId);
  if (!projectId) return NextResponse.json({ error: "Not Found" }, { status: 404 });

  const auth = await resolveAuth(request, projectId);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json(await getLinkedPRs(taskId));
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

  const { url, type, title } = await request.json();
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

  const pr = await createLinkedPR({
    ticketId: taskId,
    url,
    type: (type?.toUpperCase() ?? "PR") as LinkType,
    title,
  });

  return NextResponse.json(pr, { status: 201 });
}
