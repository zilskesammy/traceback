import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTicketTools } from "./tools/tickets";
import { registerSessionTools } from "./tools/sessions";
import { registerLinkTools } from "./tools/links";
import { registerCommentTools } from "./tools/comments";

export interface McpAuthContext {
  userId: string;
  projectId: string;
}

export function createTracebackMcpServer(auth: McpAuthContext) {
  const server = new McpServer({
    name: "traceback",
    version: "1.0.0",
    description: "Traceback — transparent AI agent session tracking",
  });

  registerTicketTools(server, auth);
  registerSessionTools(server, auth);
  registerLinkTools(server, auth);
  registerCommentTools(server, auth);

  return server;
}
