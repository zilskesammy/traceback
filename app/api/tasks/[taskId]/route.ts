// app/api/tasks/[taskId]/route.ts
// GET /api/tasks/:taskId
// Returns a single task as YAML with parent feature + epic context.
// Auth: API key or session.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveAuth } from "@/lib/api/auth-middleware";
import { serializeTaskToYaml } from "@/lib/api/yaml";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;

  // ── Fetch the task with its parent hierarchy ─────────────────────────────
  // We need the projectId before we can call resolveAuth, so fetch the task
  // first (without auth) to retrieve projectId, then validate membership.
  const task = await db.task.findUnique({
    where: { id: taskId },
    include: {
      feature: {
        include: {
          epic: {
            include: {
              project: { select: { id: true } },
            },
          },
        },
      },
    },
  });

  if (!task) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const projectId = task.feature.epic.project.id;

  // ── Auth ──────────────────────────────────────────────────────────────────
  const authResult = await resolveAuth(request, projectId);
  if (!authResult) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // If auth resolved via API key, verify the key is scoped to this project
  // (resolveAuth returns the projectId from the ApiKey row for key auth, or
  //  the passed-in projectId for session auth — either way must match).
  if (authResult.projectId !== projectId) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Verify project membership
  const member = await db.projectMember.findUnique({
    where: {
      projectId_userId: { projectId, userId: authResult.userId },
    },
    select: { id: true },
  });
  if (!member) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // ── Serialize to YAML ─────────────────────────────────────────────────────
  const feature = task.feature;
  const epic = feature.epic;

  const yamlString = serializeTaskToYaml(task, feature, epic);

  return new NextResponse(yamlString, {
    status: 200,
    headers: {
      "Content-Type": "text/yaml; charset=utf-8",
    },
  });
}
