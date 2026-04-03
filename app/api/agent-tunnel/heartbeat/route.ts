// app/api/agent-tunnel/heartbeat/route.ts

import { NextRequest, NextResponse } from "next/server";
import { resolveAuth } from "@/lib/api/auth-middleware";
import { updateHeartbeat } from "@/lib/db/agent-tasks";
import { z } from "zod/v4";

const Schema = z.object({ projectId: z.string() });

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const auth = await resolveAuth(req, parsed.data.projectId);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await updateHeartbeat(parsed.data.projectId);
  return NextResponse.json({ ok: true });
}
