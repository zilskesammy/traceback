import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "@/lib/db";
import type { McpAuthContext } from "../server";
import type { ChangelogItemType, ChangelogStatus } from "@/types/changelog";

function toDbStatus(s: string): ChangelogStatus {
  const map: Record<string, ChangelogStatus> = {
    planned: "PLANNED",
    in_progress: "IN_PROGRESS",
    "in-progress": "IN_PROGRESS",
    completed: "COMPLETED",
  };
  return map[s.toLowerCase()] ?? "PLANNED";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeFeature(f: any) {
  return {
    id: f.id,
    type: f.type,
    status: f.status?.toLowerCase(),
    priority: f.priority?.toLowerCase(),
    title: f.title,
    summary: f.summary,
    tags: f.tags,
    createdAt: f.createdAt?.toISOString() ?? null,
    updatedAt: f.updatedAt?.toISOString() ?? null,
  };
}

export function registerTicketTools(server: McpServer, _auth: McpAuthContext) {

  server.tool(
    "traceback_list_tickets",
    "List changelog features from a project. Filter by type, status, or tags.",
    {
      project_id: z.string().describe("Project ID"),
      type: z.enum(["feature", "bugfix", "epic", "task"]).optional(),
      status: z.enum(["planned", "in-progress", "completed"]).optional(),
      limit: z.number().min(1).max(100).optional().describe("Max results, default 50"),
    },
    async ({ project_id, type, status, limit }) => {
      try {
        const features = await db.changelogFeature.findMany({
          where: {
            projectId: project_id,
            ...(type ? { type: type.toUpperCase() as ChangelogItemType } : {}),
            ...(status ? { status: toDbStatus(status) } : {}),
          },
          orderBy: { updatedAt: "desc" },
          take: limit ?? 50,
        });
        return { content: [{ type: "text", text: JSON.stringify(features.map(serializeFeature), null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }] };
      }
    }
  );

  server.tool(
    "traceback_get_ticket",
    "Get full changelog feature with all entries and code changes.",
    {
      ticket_id: z.string().describe("ChangelogFeature ID"),
      include_session: z.boolean().optional().describe("Include session log, default true"),
    },
    async ({ ticket_id, include_session }) => {
      try {
        const feature = await db.changelogFeature.findUnique({
          where: { id: ticket_id },
          include: {
            entries: {
              orderBy: { timestamp: "asc" },
              include: { codeChanges: true },
            },
            linkedPrs: { orderBy: { createdAt: "asc" } },
          },
        });
        if (!feature) return { content: [{ type: "text", text: "Error: Feature not found" }] };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let sessionLog: any[] = [];
        if (include_session !== false) {
          sessionLog = await db.sessionStep.findMany({
            where: { featureId: ticket_id },
            orderBy: { sequence: "asc" },
          });
        }

        const result = { ...serializeFeature(feature), entries: feature.entries, linkedPrs: feature.linkedPrs, sessionLog };
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }] };
      }
    }
  );

  server.tool(
    "traceback_create_ticket",
    "Create a new changelog feature in a project.",
    {
      project_id: z.string().describe("Project ID"),
      title: z.string().describe("Feature title"),
      summary: z.string().optional().describe("Short summary"),
      type: z.enum(["feature", "bugfix", "task"]).optional(),
      status: z.enum(["planned", "in-progress", "completed"]).optional(),
    },
    async ({ project_id, title, summary, type, status }) => {
      try {
        const id = `feat-${Date.now()}-ui`;
        const feature = await db.changelogFeature.create({
          data: {
            id,
            projectId: project_id,
            type: (type?.toUpperCase() ?? "FEATURE") as ChangelogItemType,
            status: status ? toDbStatus(status) : "PLANNED",
            priority: "MEDIUM",
            title,
            summary: summary ?? title,
            affectedComponents: [],
            acceptanceCriteria: [],
            tags: [],
            source: "UI",
          },
        });
        return { content: [{ type: "text", text: JSON.stringify(serializeFeature(feature), null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }] };
      }
    }
  );

  server.tool(
    "traceback_update_ticket",
    "Update a changelog feature's status or other fields.",
    {
      ticket_id: z.string().describe("ChangelogFeature ID"),
      status: z.enum(["planned", "in-progress", "completed"]).optional(),
      title: z.string().optional(),
      summary: z.string().optional(),
    },
    async ({ ticket_id, status, title, summary }) => {
      try {
        const updates: Record<string, unknown> = {};
        if (status !== undefined) updates.status = toDbStatus(status);
        if (title !== undefined) updates.title = title;
        if (summary !== undefined) updates.summary = summary;

        const feature = await db.changelogFeature.update({
          where: { id: ticket_id },
          data: updates,
        });
        return { content: [{ type: "text", text: JSON.stringify(serializeFeature(feature), null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }] };
      }
    }
  );
}
