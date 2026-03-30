import { db } from "@/lib/db";
import type { Agent } from "@prisma/client";

export async function getAgents(): Promise<Agent[]> {
  return db.agent.findMany({ orderBy: { name: "asc" } });
}

export async function getAgent(id: string): Promise<Agent | null> {
  return db.agent.findUnique({ where: { id } });
}
