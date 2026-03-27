// app/api/projects/[id]/epics/[epicId]/route.ts
// GET    /api/projects/:id/epics/:epicId  — single epic with features+tasks
// PATCH  /api/projects/:id/epics/:epicId  — update epic fields
// DELETE /api/projects/:id/epics/:epicId  — delete epic (cascades)

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

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; epicId: string }> }
) {
  const { id: projectId, epicId } = await params;

  const authResult = await resolveAuth(request, projectId);
  if (!authResult) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isMember = await assertMember(authResult.userId, projectId);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const epic = await db.epic.findFirst({
    where: { id: epicId, projectId },
    include: {
      features: {
        orderBy: { order: "asc" },
        include: { tasks: { orderBy: { order: "asc" } } },
      },
    },
  });

  if (!epic) {
    return NextResponse.json({ error: "Epic not found" }, { status: 404 });
  }

  return NextResponse.json(epic);
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; epicId: string }> }
) {
  const { id: projectId, epicId } = await params;

  const authResult = await resolveAuth(request, projectId);
  if (!authResult) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isMember = await assertMember(authResult.userId, projectId);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await db.epic.findFirst({
    where: { id: epicId, projectId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Epic not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { title, description, status, order } = body as {
    title?: unknown;
    description?: unknown;
    status?: unknown;
    order?: unknown;
  };

  if (status !== undefined && !VALID_STATUSES.includes(status as TicketStatus)) {
    return NextResponse.json(
      { error: `status must be one of: ${VALID_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  const updated = await db.epic.update({
    where: { id: epicId },
    data: {
      ...(typeof title === "string" && title.trim() !== "" && { title: title.trim() }),
      ...(description !== undefined && { description: description as string | null }),
      ...(status !== undefined && { status: status as TicketStatus }),
      ...(typeof order === "number" && { order }),
    },
    include: {
      features: {
        orderBy: { order: "asc" },
        include: { tasks: { orderBy: { order: "asc" } } },
      },
    },
  });

  return NextResponse.json(updated);
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; epicId: string }> }
) {
  const { id: projectId, epicId } = await params;

  const authResult = await resolveAuth(request, projectId);
  if (!authResult) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isMember = await assertMember(authResult.userId, projectId);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await db.epic.findFirst({
    where: { id: epicId, projectId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Epic not found" }, { status: 404 });
  }

  await db.epic.delete({ where: { id: epicId } });

  return new NextResponse(null, { status: 204 });
}
