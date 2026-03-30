import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { resolveAuth } from "@/lib/api/auth-middleware";
import { getAgents } from "@/lib/db/agents";

export async function GET(request: NextRequest) {
  const apiAuth = await resolveAuth(request);
  const session = await auth();
  if (!apiAuth && !session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agents = await getAgents();
  return NextResponse.json(agents);
}
