import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createLinkedPR } from "@/lib/db/linked-prs";
import type { McpAuthContext } from "../server";
import type { LinkType } from "@prisma/client";

export function registerLinkTools(server: McpServer, _auth: McpAuthContext) {
  server.tool(
    "traceback_link_pr",
    "Link a PR, branch, or commit to a changelog feature.",
    {
      feature_id: z.string(),
      url: z.string().url(),
      type: z.enum(["pr", "branch", "commit"]).optional(),
      title: z.string().optional(),
    },
    async ({ feature_id, url, type, title }) => {
      try {
        const pr = await createLinkedPR({
          featureId: feature_id,
          url,
          type: (type?.toUpperCase() ?? "PR") as LinkType,
          title,
        });
        return { content: [{ type: "text", text: JSON.stringify(pr, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }] };
      }
    }
  );
}
