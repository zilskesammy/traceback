import { db } from "@/lib/db";
import type { SessionStepType } from "@prisma/client";

export interface CreateSessionStepInput {
  featureId: string;
  agentId: string;
  type: SessionStepType;
  content: string;
  metadata?: Record<string, unknown>;
}

export async function createSessionStep(input: CreateSessionStepInput) {
  const last = await db.sessionStep.findFirst({
    where: { featureId: input.featureId },
    orderBy: { sequence: "desc" },
    select: { sequence: true },
  });

  return db.sessionStep.create({
    data: {
      featureId: input.featureId,
      agentId: input.agentId,
      sequence: (last?.sequence ?? 0) + 1,
      type: input.type,
      content: input.content,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      metadata: (input.metadata ?? {}) as any,
    },
  });
}

export async function getSessionSteps(
  featureId: string,
  opts?: { types?: SessionStepType[]; since?: string }
) {
  return db.sessionStep.findMany({
    where: {
      featureId,
      ...(opts?.types?.length ? { type: { in: opts.types } } : {}),
      ...(opts?.since ? { createdAt: { gte: new Date(opts.since) } } : {}),
    },
    orderBy: { sequence: "asc" },
  });
}
