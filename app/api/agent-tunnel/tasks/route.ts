// app/api/agent-tunnel/tasks/route.ts

import { NextRequest, NextResponse } from "next/server";
import { resolveAuth } from "@/lib/api/auth-middleware";
import { createAgentTask, getRecentTasks } from "@/lib/db/agent-tasks";
import { z } from "zod/v4";

const CreateSchema = z.object({
  projectId: z.string(),
  prompt: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { projectId, prompt } = parsed.data;

  const auth = await resolveAuth(req, projectId);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const task = await createAgentTask(projectId, prompt);
  return NextResponse.json(task, { status: 201 });
}

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  const auth = await resolveAuth(req, projectId);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tasks = await getRecentTasks(projectId);
  return NextResponse.json(tasks);
}
