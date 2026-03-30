import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "@/lib/db";
import type { McpAuthContext } from "../server";

export function registerCommentTools(server: McpServer, _auth: McpAuthContext) {
  server.tool(
    "traceback_add_comment",
    "Add a comment to a ticket. Supports markdown.",
    {
      ticket_id: z.string(),
      content: z.string().describe("Comment body in markdown"),
      author_type: z.enum(["human", "agent"]).optional(),
    },
    async ({ ticket_id, content, author_type }) => {
      try {
        const comment = await db.taskComment.create({
          data: {
            ticketId: ticket_id,
            content,
            authorType: (author_type?.toUpperCase() ?? "AGENT") as "HUMAN" | "AGENT",
            authorId: "claude-code",
          },
        });
        return { content: [{ type: "text", text: JSON.stringify(comment, null, 2) }] };
      } catch (e: any) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }] };
      }
    }
  );
}
