// app/api/projects/[id]/epics/[epicId]/features/[featureId]/tasks/[taskId]/route.ts
// GET    /api/projects/:id/epics/:epicId/features/:featureId/tasks/:taskId
// PATCH  /api/projects/:id/epics/:epicId/features/:featureId/tasks/:taskId
// DELETE /api/projects/:id/epics/:epicId/features/:featureId/tasks/:taskId

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveAuth } from "@/lib/api/auth-middleware";
import type { TicketStatus } from "@prisma/client";

// ─── Shared helpers ───────────────────────────────────────────────────────────

async function assertMember(userId: string, projectId: string): Promise<boolean> {
  const member = await db.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { id: true },
  });
  return !!member;
}

const VALID_STATUSES: TicketStatus[] = [
  "BACKLOG",
  "TODO",
  "IN_PROGRESS",
  "IN_REVIEW",
  "DONE",
  "CANCELLED",
];

async function findTask(
  taskId: string,
  featureId: string,
  epicId: string,
  projectId: string
) {
  return db.task.findFirst({
    where: {
      id: taskId,
      featureId,
      feature: { epicId, epic: { projectId } },
    },
  });
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      id: string;
      epicId: string;
      featureId: string;
      taskId: string;
    }>;
  }
) {
  const { id: projectId, epicId, featureId, taskId } = await params;

  const authResult = await resolveAuth(request, projectId);
  if (!authResult) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isMember = await assertMember(authResult.userId, projectId);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const task = await findTask(taskId, featureId, epicId, projectId);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json(task);
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      id: string;
      epicId: string;
      featureId: string;
      taskId: string;
    }>;
  }
) {
  const { id: projectId, epicId, featureId, taskId } = await params;

  const authResult = await resolveAuth(request, projectId);
  if (!authResult) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isMember = await assertMember(authResult.userId, projectId);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await findTask(taskId, featureId, epicId, projectId);
  if (!existing) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    title,
    instruction,
    assignee,
    status,
    contextFiles,
    changedFiles,
    diffRef,
    changedBy,
    changedAt,
    order,
  } = body as {
    title?: unknown;
    instruction?: unknown;
    assignee?: unknown;
    status?: unknown;
    contextFiles?: unknown;
    changedFiles?: unknown;
    diffRef?: unknown;
    changedBy?: unknown;
    changedAt?: unknown;
    order?: unknown;
  };

  if (status !== undefined && !VALID_STATUSES.includes(status as TicketStatus)) {
    return NextResponse.json(
      { error: `status must be one of: ${VALID_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  // Auto-set changedAt when diffRef or changedFiles are provided
  const autoChangedAt =
    diffRef !== undefined || changedFiles !== undefined ? new Date() : undefined;

  const updated = await db.task.update({
    where: { id: taskId },
    data: {
      ...(typeof title === "string" && title.trim() !== "" && { title: title.trim() }),
      ...(instruction !== undefined && { instruction: instruction as string | null }),
      ...(assignee !== undefined && { assignee: assignee as string | null }),
      ...(status !== undefined && { status: status as TicketStatus }),
      ...(contextFiles !== undefined && {
        contextFiles: Array.isArray(contextFiles) ? contextFiles : undefined,
      }),
      ...(changedFiles !== undefined && {
        changedFiles: Array.isArray(changedFiles) ? changedFiles : undefined,
      }),
      ...(diffRef !== undefined && { diffRef: diffRef as string | null }),
      ...(changedBy !== undefined && { changedBy: changedBy as string | null }),
      // Explicit changedAt from body takes precedence; otherwise auto-set
      changedAt:
        changedAt !== undefined
          ? changedAt
            ? new Date(changedAt as string)
            : null
          : autoChangedAt,
      ...(typeof order === "number" && { order }),
    },
  });

  return NextResponse.json(updated);
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      id: string;
      epicId: string;
      featureId: string;
      taskId: string;
    }>;
  }
) {
  const { id: projectId, epicId, featureId, taskId } = await params;

  const authResult = await resolveAuth(request, projectId);
  if (!authResult) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isMember = await assertMember(authResult.userId, projectId);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await findTask(taskId, featureId, epicId, projectId);
  if (!existing) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  await db.task.delete({ where: { id: taskId } });

  return new NextResponse(null, { status: 204 });
}
