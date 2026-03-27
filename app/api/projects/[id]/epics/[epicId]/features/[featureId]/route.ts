// app/api/projects/[id]/epics/[epicId]/features/[featureId]/route.ts
// GET    /api/projects/:id/epics/:epicId/features/:featureId
// PATCH  /api/projects/:id/epics/:epicId/features/:featureId
// DELETE /api/projects/:id/epics/:epicId/features/:featureId

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveAuth } from "@/lib/api/auth-middleware";
import { Prisma, type TicketStatus } from "@prisma/client";

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

async function findFeature(featureId: string, epicId: string, projectId: string) {
  return db.feature.findFirst({
    where: {
      id: featureId,
      epicId,
      epic: { projectId },
    },
    include: { tasks: { orderBy: { order: "asc" } } },
  });
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; epicId: string; featureId: string }> }
) {
  const { id: projectId, epicId, featureId } = await params;

  const authResult = await resolveAuth(request, projectId);
  if (!authResult) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isMember = await assertMember(authResult.userId, projectId);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const feature = await findFeature(featureId, epicId, projectId);
  if (!feature) {
    return NextResponse.json({ error: "Feature not found" }, { status: 404 });
  }

  return NextResponse.json(feature);
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; epicId: string; featureId: string }> }
) {
  const { id: projectId, epicId, featureId } = await params;

  const authResult = await resolveAuth(request, projectId);
  if (!authResult) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isMember = await assertMember(authResult.userId, projectId);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await db.feature.findFirst({
    where: { id: featureId, epicId, epic: { projectId } },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Feature not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    title,
    description,
    status,
    assignee,
    contextFiles,
    changedFiles,
    diffRef,
    diffSummary,
    changedBy,
    changedAt,
    acceptanceCriteria,
    order,
  } = body as {
    title?: unknown;
    description?: unknown;
    status?: unknown;
    assignee?: unknown;
    contextFiles?: unknown;
    changedFiles?: unknown;
    diffRef?: unknown;
    diffSummary?: unknown;
    changedBy?: unknown;
    changedAt?: unknown;
    acceptanceCriteria?: unknown;
    order?: unknown;
  };

  if (status !== undefined && !VALID_STATUSES.includes(status as TicketStatus)) {
    return NextResponse.json(
      { error: `status must be one of: ${VALID_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  const updated = await db.feature.update({
    where: { id: featureId },
    data: {
      ...(typeof title === "string" && title.trim() !== "" && { title: title.trim() }),
      ...(description !== undefined && { description: description as string | null }),
      ...(status !== undefined && { status: status as TicketStatus }),
      ...(assignee !== undefined && { assignee: assignee as string | null }),
      ...(contextFiles !== undefined && {
        contextFiles: Array.isArray(contextFiles) ? contextFiles : undefined,
      }),
      ...(changedFiles !== undefined && {
        changedFiles: Array.isArray(changedFiles) ? changedFiles : undefined,
      }),
      ...(diffRef !== undefined && { diffRef: diffRef as string | null }),
      ...(diffSummary !== undefined && { diffSummary: diffSummary as string | null }),
      ...(changedBy !== undefined && { changedBy: changedBy as string | null }),
      ...(changedAt !== undefined && {
        changedAt: changedAt ? new Date(changedAt as string) : null,
      }),
      ...(acceptanceCriteria !== undefined && {
        acceptanceCriteria:
          acceptanceCriteria === null
            ? Prisma.JsonNull
            : (acceptanceCriteria as Prisma.InputJsonValue),
      }),
      ...(typeof order === "number" && { order }),
    },
    include: { tasks: { orderBy: { order: "asc" } } },
  });

  return NextResponse.json(updated);
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; epicId: string; featureId: string }> }
) {
  const { id: projectId, epicId, featureId } = await params;

  const authResult = await resolveAuth(request, projectId);
  if (!authResult) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isMember = await assertMember(authResult.userId, projectId);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await db.feature.findFirst({
    where: { id: featureId, epicId, epic: { projectId } },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Feature not found" }, { status: 404 });
  }

  await db.feature.delete({ where: { id: featureId } });

  return new NextResponse(null, { status: 204 });
}
