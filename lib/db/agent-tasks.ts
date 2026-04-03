// lib/db/agent-tasks.ts

import { db } from "@/lib/db";
import type { AgentTask, AgentTaskChunk } from "@prisma/client";

export async function createAgentTask(
  projectId: string,
  prompt: string
): Promise<AgentTask> {
  return db.agentTask.create({
    data: { projectId, prompt, status: "pending" },
  });
}

export async function getNextPendingTask(
  projectId: string
): Promise<AgentTask | null> {
  // Claim atomically: update status to "running" and return the row
  const tasks = await db.agentTask.findMany({
    where: { projectId, status: "pending" },
    orderBy: { createdAt: "asc" },
    take: 1,
  });
  if (tasks.length === 0) return null;
  const task = tasks[0];
  return db.agentTask.update({
    where: { id: task.id },
    data: { status: "running" },
  });
}

export async function pushChunk(
  taskId: string,
  content: string,
  chunkType: string
): Promise<AgentTaskChunk> {
  return db.agentTaskChunk.create({
    data: { taskId, content, chunkType },
  });
}

export async function getChunksAfter(
  taskId: string,
  afterId: string | null
): Promise<AgentTaskChunk[]> {
  return db.agentTaskChunk.findMany({
    where: {
      taskId,
      ...(afterId ? { id: { gt: afterId } } : {}),
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function completeTask(
  taskId: string,
  featureId?: string
): Promise<void> {
  await db.agentTask.update({
    where: { id: taskId },
    data: {
      status: "done",
      completedAt: new Date(),
      ...(featureId ? { featureId } : {}),
    },
  });
}

export async function failTask(taskId: string): Promise<void> {
  await db.agentTask.update({
    where: { id: taskId },
    data: { status: "error", completedAt: new Date() },
  });
}

export async function updateHeartbeat(projectId: string): Promise<void> {
  await db.project.update({
    where: { id: projectId },
    data: { agentLastSeenAt: new Date() },
  });
}

export async function getRecentTasks(
  projectId: string,
  limit = 20
): Promise<AgentTask[]> {
  return db.agentTask.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
