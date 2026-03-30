// app/(app)/projects/[id]/page.tsx — Server Component
// Lädt Projekt + Epics + Features + Tasks aus DB, serialisiert für Client

import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PlanningLayout } from "@/components/planning/PlanningLayout";
import type {
  PlanningProject,
  PlanningEpic,
  PlanningFeature,
  PlanningTask,
  TicketStatus,
} from "@/types/planning";
import { Prisma } from "@prisma/client";

// ─── PRISMA QUERY TYPES ───────────────────────────────────────────────────────

const projectWithAll = Prisma.validator<Prisma.ProjectDefaultArgs>()({
  include: {
    epics: {
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
    },
  },
});

type ProjectWithAll = Prisma.ProjectGetPayload<typeof projectWithAll>;

// ─── SERIALIZATION ────────────────────────────────────────────────────────────

function parseStringArray(value: Prisma.JsonValue | null): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function serializeTask(
  task: ProjectWithAll["epics"][0]["features"][0]["tasks"][0]
): PlanningTask {
  return {
    id: task.id,
    number: task.number,
    title: task.title,
    instruction: task.instruction,
    assignee: task.assignee,
    status: task.status as TicketStatus,
    contextFiles: parseStringArray(task.contextFiles),
    changedFiles: parseStringArray(task.changedFiles),
    diffRef: task.diffRef,
    prUrl: task.prUrl ?? null,
    changedBy: task.changedBy,
    changedAt: task.changedAt?.toISOString() ?? null,
    order: task.order,
    delegateId: task.delegateId ?? null,
    delegateStatus: task.delegateStatus as PlanningTask["delegateStatus"] ?? null,
  };
}

function serializeFeature(
  feature: ProjectWithAll["epics"][0]["features"][0]
): PlanningFeature {
  return {
    id: feature.id,
    title: feature.title,
    description: feature.description,
    status: feature.status as TicketStatus,
    assignee: feature.assignee,
    contextFiles: parseStringArray(feature.contextFiles),
    changedFiles: parseStringArray(feature.changedFiles),
    diffRef: feature.diffRef,
    diffSummary: feature.diffSummary,
    changedBy: feature.changedBy,
    changedAt: feature.changedAt?.toISOString() ?? null,
    order: feature.order,
    tasks: feature.tasks.map(serializeTask),
  };
}

function serializeProject(project: ProjectWithAll): PlanningProject {
  return {
    id: project.id,
    name: project.name,
    repoOwner: project.repoOwner,
    repoName: project.repoName,
    defaultBranch: project.defaultBranch,
    epics: project.epics.map(
      (epic): PlanningEpic => ({
        id: epic.id,
        title: epic.title,
        description: epic.description,
        status: epic.status as TicketStatus,
        order: epic.order,
        features: epic.features.map(serializeFeature),
      })
    ),
  };
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const project = await db.project.findUnique({
    where: { id },
    ...projectWithAll,
  });

  if (!project) notFound();

  const serialized = serializeProject(project);

  return <PlanningLayout project={serialized} />;
}
