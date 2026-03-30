import { db } from "@/lib/db";
import type { SessionStepType } from "@prisma/client";

export interface CreateSessionStepInput {
  ticketId: string;
  agentId: string;
  type: SessionStepType;
  content: string;
  metadata?: Record<string, unknown>;
}

export async function createSessionStep(input: CreateSessionStepInput) {
  const last = await db.sessionStep.findFirst({
    where: { ticketId: input.ticketId },
    orderBy: { sequence: "desc" },
    select: { sequence: true },
  });

  return db.sessionStep.create({
    data: {
      ticketId: input.ticketId,
      agentId: input.agentId,
      sequence: (last?.sequence ?? 0) + 1,
      type: input.type,
      content: input.content,
      metadata: (input.metadata ?? {}) as any,
    },
  });
}

export async function getSessionSteps(
  ticketId: string,
  opts?: { types?: SessionStepType[]; since?: string }
) {
  return db.sessionStep.findMany({
    where: {
      ticketId,
      ...(opts?.types?.length ? { type: { in: opts.types } } : {}),
      ...(opts?.since ? { createdAt: { gte: new Date(opts.since) } } : {}),
    },
    orderBy: { sequence: "asc" },
  });
}
