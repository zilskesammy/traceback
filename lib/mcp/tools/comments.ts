import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpAuthContext } from "../server";

// TaskComment model was removed. Comments are now ChangelogEntry records.
// This tool is no longer registered.
export function registerCommentTools(_server: McpServer, _auth: McpAuthContext) {
  // intentionally empty
}
