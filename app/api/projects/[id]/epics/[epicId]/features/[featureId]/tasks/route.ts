// app/api/projects/[id]/epics/[epicId]/features/[featureId]/tasks/route.ts
// GET  /api/projects/:id/epics/:epicId/features/:featureId/tasks
// POST /api/projects/:id/epics/:epicId/features/:featureId/tasks

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

async function findFeature(featureId: string, epicId: string, projectId: string) {
  return db.feature.findFirst({
    where: { id: featureId, epicId, epic: { projectId } },
    select: { id: true },
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
    }>;
  }
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

  const tasks = await db.task.findMany({
    where: { featureId },
    orderBy: { order: "asc" },
  });

  return NextResponse.json(tasks);
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      id: string;
      epicId: string;
      featureId: string;
    }>;
  }
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { title, instruction, assignee, status, contextFiles, order } = body as {
    title?: unknown;
    instruction?: unknown;
    assignee?: unknown;
    status?: unknown;
    contextFiles?: unknown;
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

  // Auto-assign sequential number per project
  const lastTask = await db.task.findFirst({
    where: { feature: { epic: { projectId } } },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const nextNumber = (lastTask?.number ?? 0) + 1;

  const task = await db.task.create({
    data: {
      featureId,
      number: nextNumber,
      title: title.trim(),
      instruction: typeof instruction === "string" ? instruction : undefined,
      assignee: typeof assignee === "string" ? assignee : undefined,
      status: status !== undefined ? (status as TicketStatus) : undefined,
      contextFiles: Array.isArray(contextFiles) ? contextFiles : undefined,
      order: typeof order === "number" ? order : undefined,
    },
  });

  return NextResponse.json(task, { status: 201 });
}
