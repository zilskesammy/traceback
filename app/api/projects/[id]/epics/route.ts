// app/api/projects/[id]/epics/route.ts
// GET  /api/projects/:id/epics  — list all epics with features+tasks
// POST /api/projects/:id/epics  — create a new epic

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveAuth } from "@/lib/api/auth-middleware";

// ─── Shared membership check ──────────────────────────────────────────────────

async function assertMember(userId: string, projectId: string): Promise<boolean> {
  const member = await db.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { id: true },
  });
  return !!member;
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  const authResult = await resolveAuth(request, projectId);
  if (!authResult) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isMember = await assertMember(authResult.userId, projectId);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const epics = await db.epic.findMany({
    where: { projectId },
    orderBy: { order: "asc" },
    include: {
      features: {
        orderBy: { order: "asc" },
        include: {
          tasks: {
            orderBy: { order: "asc" },
          },
        },
      },
    },
  });

  return NextResponse.json(epics);
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  const authResult = await resolveAuth(request, projectId);
  if (!authResult) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isMember = await assertMember(authResult.userId, projectId);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  if (!title || typeof title !== "string" || title.trim() === "") {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const epic = await db.epic.create({
    data: {
      projectId,
      title: title.trim(),
      description: typeof description === "string" ? description : undefined,
      status:
        typeof status === "string"
          ? (status as import("@prisma/client").TicketStatus)
          : undefined,
      order: typeof order === "number" ? order : undefined,
    },
    include: {
      features: {
        orderBy: { order: "asc" },
        include: { tasks: { orderBy: { order: "asc" } } },
      },
    },
  });

  return NextResponse.json(epic, { status: 201 });
}
