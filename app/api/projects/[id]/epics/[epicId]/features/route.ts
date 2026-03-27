// app/api/projects/[id]/epics/[epicId]/features/route.ts
// GET  /api/projects/:id/epics/:epicId/features  — list all features with tasks
// POST /api/projects/:id/epics/:epicId/features  — create a new feature

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
    select: { id: true },
  });
  if (!epic) {
    return NextResponse.json({ error: "Epic not found" }, { status: 404 });
  }

  const features = await db.feature.findMany({
    where: { epicId },
    orderBy: { order: "asc" },
    include: { tasks: { orderBy: { order: "asc" } } },
  });

  return NextResponse.json(features);
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(
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
    select: { id: true },
  });
  if (!epic) {
    return NextResponse.json({ error: "Epic not found" }, { status: 404 });
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
    acceptanceCriteria,
    order,
  } = body as {
    title?: unknown;
    description?: unknown;
    status?: unknown;
    assignee?: unknown;
    contextFiles?: unknown;
    acceptanceCriteria?: unknown;
    order?: unknown;
  };

  if (!title || typeof title !== "string" || title.trim() === "") {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  if (status !== undefined && !VALID_STATUSES.includes(status as TicketStatus)) {
    return NextResponse.json(
      { error: `status must be one of: ${VALID_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  const feature = await db.feature.create({
    data: {
      epicId,
      title: title.trim(),
      description: typeof description === "string" ? description : undefined,
      status: status !== undefined ? (status as TicketStatus) : undefined,
      assignee: typeof assignee === "string" ? assignee : undefined,
      contextFiles: Array.isArray(contextFiles) ? contextFiles : undefined,
      acceptanceCriteria:
        acceptanceCriteria !== undefined
          ? acceptanceCriteria === null
            ? Prisma.JsonNull
            : (acceptanceCriteria as Prisma.InputJsonValue)
          : undefined,
      order: typeof order === "number" ? order : undefined,
    },
    include: { tasks: { orderBy: { order: "asc" } } },
  });

  return NextResponse.json(feature, { status: 201 });
}
