// RFC 9728 — OAuth Protected Resource Metadata
// Claude Code fetches this to discover auth requirements before connecting via MCP HTTP.
// Returning empty authorization_servers signals: use pre-provisioned Bearer tokens.

import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const host = new URL(request.url).origin;
  return NextResponse.json(
    {
      resource: host,
      bearer_methods_supported: ["header"],
      authorization_servers: [],
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}
