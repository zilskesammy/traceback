// app/api/agent-tunnel/chunks/route.ts

import { NextRequest, NextResponse } from "next/server";
import { resolveAuth } from "@/lib/api/auth-middleware";
import {
  pushChunk,
  getChunksAfter,
  completeTask,
  failTask,
} from "@/lib/db/agent-tasks";
import { db } from "@/lib/db";
import { z } from "zod/v4";

const PushSchema = z.object({
  taskId: z.string(),
  projectId: z.string(),
  content: z.string(),
  chunkType: z.string(),
  done: z.boolean().optional(),
  error: z.boolean().optional(),
  featureId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = PushSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { taskId, projectId, content, chunkType, done, error, featureId } =
    parsed.data;

  const auth = await resolveAuth(req, projectId);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (content) {
    await pushChunk(taskId, content, chunkType);
  }
  if (done) {
    await completeTask(taskId, featureId);
  } else if (error) {
    await failTask(taskId);
  }

  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const taskId = req.nextUrl.searchParams.get("taskId");
  const afterId = req.nextUrl.searchParams.get("after") ?? null;

  if (!taskId) {
    return NextResponse.json({ error: "taskId required" }, { status: 400 });
  }

  // Resolve auth via task's projectId
  const task = await db.agentTask.findUnique({
    where: { id: taskId },
    select: { projectId: true, status: true },
  });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const auth = await resolveAuth(req, task.projectId);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const chunks = await getChunksAfter(taskId, afterId);
  return NextResponse.json({ chunks, taskStatus: task.status });
}
