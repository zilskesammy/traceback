import { NextRequest, NextResponse } from "next/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createTracebackMcpServer } from "@/lib/mcp/server";
import { resolveAuth } from "@/lib/api/auth-middleware";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await resolveAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  const server = createTracebackMcpServer(auth);
  await server.connect(transport);

  // handleRequest nimmt den Web-Standard Request und gibt Response zurück
  return transport.handleRequest(request);
}

export async function GET() {
  return NextResponse.json({
    name: "traceback",
    version: "1.0.0",
    description: "Traceback MCP Server",
  });
}
