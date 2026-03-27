// app/api/tasks/[taskId]/route.ts
// GET /api/tasks/:taskId
// Gibt einen einzelnen Task als JSON oder YAML zurück, mit Feature + Epic Kontext.
// Auth: x-api-key Header, Key muss zum Projekt des Tasks gehören.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateApiKey } from "@/lib/apiKey";
import yaml from "js-yaml";
import { Prisma } from "@prisma/client";

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function parseJsonArray(value: Prisma.JsonValue | null | undefined): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((v): v is string => typeof v === "string");
}

function isoOrNull(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;

  // ── Task mit Eltern-Hierarchie laden ─────────────────────────────────────
  // projectId wird erst nach dem Laden bekannt, daher zuerst ohne Auth fetchen,
  // dann Key gegen projectId prüfen.
  const task = await db.task.findUnique({
    where: { id: taskId },
    include: {
      feature: {
        include: {
          epic: {
            select: {
              id: true,
              title: true,
              projectId: true,
            },
          },
        },
      },
    },
  });

  if (!task) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  const projectId = task.feature.epic.projectId;

  // ── Auth: x-api-key Header ────────────────────────────────────────────────
  const rawKey = request.headers.get("x-api-key");
  if (!rawKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { valid, projectId: keyProjectId } = await validateApiKey(rawKey);
  if (!valid || keyProjectId !== projectId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Response-Dokument aufbauen ────────────────────────────────────────────
  const doc = {
    id: task.id,
    title: task.title,
    instruction: task.instruction ?? null,
    status: task.status,
    assignee: task.assignee ?? null,
    contextFiles: parseJsonArray(task.contextFiles),
    changedFiles: parseJsonArray(task.changedFiles),
    diffRef: task.diffRef ?? null,
    changedBy: task.changedBy ?? null,
    changedAt: isoOrNull(task.changedAt),
    feature: {
      id: task.feature.id,
      title: task.feature.title,
    },
    epic: {
      id: task.feature.epic.id,
      title: task.feature.epic.title,
    },
    projectId,
  };

  // ── Serialisierung: YAML oder JSON je nach Accept-Header ─────────────────
  const accept = request.headers.get("accept") ?? "";
  if (accept.includes("application/yaml")) {
    return new NextResponse(yaml.dump(doc, { lineWidth: 120, noRefs: true }), {
      status: 200,
      headers: { "Content-Type": "application/yaml; charset=utf-8" },
    });
  }

  return NextResponse.json(doc);
}
