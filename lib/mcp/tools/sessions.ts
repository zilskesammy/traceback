import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "@/lib/db";
import { createSessionStep } from "@/lib/db/session-steps";
import type { McpAuthContext } from "../server";
import type { SessionStepType } from "@prisma/client";

export function registerSessionTools(server: McpServer, _auth: McpAuthContext) {

  server.tool(
    "traceback_log_session_step",
    `Append a reasoning/action step to a feature's agent session log.
CALL THIS FOR EVERY SIGNIFICANT STEP: decisions, searches, code changes, results, errors.
Types: thinking | reasoning | action | code | result | error`,
    {
      feature_id: z.string().describe("ChangelogFeature ID"),
      type: z.enum(["thinking", "reasoning", "action", "code", "result", "error"]),
      content: z.string().describe("What happened — actual reasoning, command, diff, or result"),
      metadata: z.object({
        files_changed: z.array(z.string()).optional(),
        tokens_used: z.number().optional(),
        duration_ms: z.number().optional(),
        tool_name: z.string().optional(),
        model: z.string().optional(),
      }).optional(),
    },
    async ({ feature_id, type, content, metadata }) => {
      try {
        const step = await createSessionStep({
          featureId: feature_id,
          agentId: "claude-code",
          type: type.toUpperCase() as SessionStepType,
          content,
          metadata: metadata as Record<string, unknown> | undefined,
        });
        return { content: [{ type: "text", text: JSON.stringify(step, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }] };
      }
    }
  );

  server.tool(
    "traceback_get_session",
    "Get the full session log for a feature.",
    {
      feature_id: z.string().describe("ChangelogFeature ID"),
      types: z.array(z.enum(["thinking", "reasoning", "action", "code", "result", "error"])).optional(),
      since: z.string().optional().describe("ISO timestamp — only steps after this time"),
    },
    async ({ feature_id, types, since }) => {
      try {
        const steps = await db.sessionStep.findMany({
          where: {
            featureId: feature_id,
            ...(types?.length ? { type: { in: types.map((t) => t.toUpperCase()) as SessionStepType[] } } : {}),
            ...(since ? { createdAt: { gte: new Date(since) } } : {}),
          },
          orderBy: { sequence: "asc" },
        });
        return { content: [{ type: "text", text: JSON.stringify(steps, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }] };
      }
    }
  );
}
