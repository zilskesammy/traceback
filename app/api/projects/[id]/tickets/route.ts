// app/api/projects/[id]/tickets/route.ts
// GET /api/projects/:id/tickets
// Gibt den vollen Projekt-Baum (Epics → Features → Tasks) als JSON oder YAML zurück.
// Auth: x-api-key Header, Key muss zum angefragten Projekt gehören.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateApiKey } from "@/lib/apiKey";
import yaml from "js-yaml";
import { Prisma } from "@prisma/client";

// ─── Typen ────────────────────────────────────────────────────────────────────

const projectWithTree = Prisma.validator<Prisma.ProjectDefaultArgs>()({
  include: {
    epics: {
      orderBy: { order: "asc" as const },
      include: {
        features: {
          orderBy: { order: "asc" as const },
          include: {
            tasks: {
              orderBy: { order: "asc" as const },
            },
          },
        },
      },
    },
  },
});

type ProjectWithTree = Prisma.ProjectGetPayload<typeof projectWithTree>;

// ─── Serialisierung ───────────────────────────────────────────────────────────

function parseJsonArray(value: Prisma.JsonValue | null | undefined): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((v): v is string => typeof v === "string");
}

function isoOrNull(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function buildDoc(project: ProjectWithTree) {
  return {
    project: {
      id: project.id,
      name: project.name,
    },
    epics: project.epics.map((epic) => ({
      id: epic.id,
      title: epic.title,
      description: epic.description ?? null,
      status: epic.status,
      order: epic.order,
      features: epic.features.map((feature) => ({
        id: feature.id,
        title: feature.title,
        description: feature.description ?? null,
        status: feature.status,
        assignee: feature.assignee ?? null,
        acceptanceCriteria: feature.acceptanceCriteria ?? null,
        contextFiles: parseJsonArray(feature.contextFiles),
        changedFiles: parseJsonArray(feature.changedFiles),
        diffRef: feature.diffRef ?? null,
        diffSummary: feature.diffSummary ?? null,
        changedBy: feature.changedBy ?? null,
        changedAt: isoOrNull(feature.changedAt),
        tasks: feature.tasks.map((task) => ({
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
        })),
      })),
    })),
  };
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  // ── Auth: x-api-key Header ────────────────────────────────────────────────
  const rawKey = request.headers.get("x-api-key");
  if (!rawKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { valid, projectId: keyProjectId } = await validateApiKey(rawKey);
  if (!valid || keyProjectId !== projectId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Daten laden ───────────────────────────────────────────────────────────
  const project = await db.project.findUnique({
    where: { id: projectId },
    ...projectWithTree,
  });

  if (!project) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  const doc = buildDoc(project);

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
