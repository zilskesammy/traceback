import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "@/lib/db";
import type { McpAuthContext } from "../server";
import type { TicketStatus } from "@prisma/client";

function toDbStatus(s: string): TicketStatus {
  return s.toUpperCase().replace(/-/g, "_") as TicketStatus;
}

function fromDbStatus(s: TicketStatus): string {
  return s.toLowerCase().replace(/_/g, "-");
}

async function getOrCreateMcpFeature(projectId: string): Promise<string> {
  const existing = await db.epic.findFirst({
    where: { projectId, title: "MCP Tasks" },
    include: { features: { where: { title: "Inbox" }, take: 1 } },
  });

  if (existing?.features[0]) return existing.features[0].id;

  if (existing) {
    const f = await db.feature.create({
      data: { epicId: existing.id, title: "Inbox", status: "BACKLOG", order: 0 },
    });
    return f.id;
  }

  const epic = await db.epic.create({
    data: {
      projectId,
      title: "MCP Tasks",
      status: "BACKLOG",
      order: 999,
      features: { create: { title: "Inbox", status: "BACKLOG", order: 0 } },
    },
    include: { features: true },
  });

  return epic.features[0].id;
}

function serializeTask(task: any) {
  return {
    id: task.id,
    title: task.title,
    instruction: task.instruction ?? null,
    status: fromDbStatus(task.status),
    assignee: task.assignee ?? null,
    delegateId: task.delegateId ?? null,
    delegateStatus: task.delegateStatus?.toLowerCase() ?? null,
    prUrl: task.prUrl ?? null,
    createdAt: task.createdAt?.toISOString() ?? null,
    updatedAt: task.updatedAt?.toISOString() ?? null,
  };
}

export function registerTicketTools(server: McpServer, _auth: McpAuthContext) {

  server.tool(
    "traceback_list_tickets",
    "List tickets (tasks) from a project. Filter by status, delegate, or assignee.",
    {
      project_id: z.string().describe("Project ID"),
      status: z.enum(["backlog", "todo", "in-progress", "in-review", "done", "cancelled"]).optional(),
      delegate_id: z.string().optional().describe("Filter by agent delegate ID"),
      assignee_id: z.string().optional().describe("Filter by human assignee"),
      limit: z.number().min(1).max(100).optional().describe("Max results, default 50"),
    },
    async ({ project_id, status, delegate_id, assignee_id, limit }) => {
      try {
        const tasks = await db.task.findMany({
          where: {
            feature: { epic: { projectId: project_id } },
            ...(status ? { status: toDbStatus(status) } : {}),
            ...(delegate_id ? { delegateId: delegate_id } : {}),
            ...(assignee_id ? { assignee: assignee_id } : {}),
          },
          orderBy: [{ status: "asc" }, { createdAt: "desc" }],
          take: limit ?? 50,
        });
        return { content: [{ type: "text", text: JSON.stringify(tasks.map(serializeTask), null, 2) }] };
      } catch (e: any) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }] };
      }
    }
  );

  server.tool(
    "traceback_get_ticket",
    "Get full ticket detail including session log, linked PRs, and comments.",
    {
      ticket_id: z.string().describe("Task ID"),
      include_session: z.boolean().optional().describe("Include session log, default true"),
    },
    async ({ ticket_id, include_session }) => {
      try {
        const task = await db.task.findUnique({
          where: { id: ticket_id },
          include: {
            feature: { include: { epic: { select: { projectId: true, title: true } } } },
            linkedPrs: { orderBy: { createdAt: "asc" } },
            comments: { orderBy: { createdAt: "asc" } },
          },
        });
        if (!task) return { content: [{ type: "text", text: "Error: Ticket not found" }] };

        let sessionLog: any[] = [];
        if (include_session !== false) {
          sessionLog = await db.sessionStep.findMany({
            where: { ticketId: ticket_id },
            orderBy: { sequence: "asc" },
          });
        }

        const result = { ...serializeTask(task), instruction: task.instruction ?? null, linkedPrs: task.linkedPrs, comments: task.comments, sessionLog };
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e: any) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }] };
      }
    }
  );

  server.tool(
    "traceback_create_ticket",
    "Create a new ticket in a project. Placed in 'MCP Tasks / Inbox' epic+feature automatically.",
    {
      project_id: z.string().describe("Project ID"),
      title: z.string().describe("Ticket title"),
      description: z.string().optional().describe("Markdown description"),
      status: z.enum(["backlog", "todo", "in-progress", "in-review", "done", "cancelled"]).optional(),
      delegate_id: z.string().optional().describe("Agent ID to assign immediately"),
    },
    async ({ project_id, title, description, status, delegate_id }) => {
      try {
        const featureId = await getOrCreateMcpFeature(project_id);
        const taskCount = await db.task.count({ where: { featureId } });
        const task = await db.task.create({
          data: {
            featureId,
            title,
            instruction: description ?? null,
            status: status ? toDbStatus(status) : "TODO",
            order: taskCount,
            number: taskCount + 1,
            delegateId: delegate_id ?? null,
            delegateStatus: delegate_id ? "WORKING" : null,
          },
        });
        return { content: [{ type: "text", text: JSON.stringify(serializeTask(task), null, 2) }] };
      } catch (e: any) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }] };
      }
    }
  );

  server.tool(
    "traceback_update_ticket",
    "Update ticket fields: status, assignee, delegate, or instruction.",
    {
      ticket_id: z.string().describe("Task ID"),
      status: z.enum(["backlog", "todo", "in-progress", "in-review", "done", "cancelled"]).optional(),
      assignee_id: z.string().optional().describe("New assignee, empty string to unassign"),
      delegate_id: z.string().optional().describe("New agent delegate, empty string to remove"),
      delegate_status: z.enum(["idle", "working", "completed", "error"]).optional(),
      description: z.string().optional().describe("Updated instruction"),
    },
    async ({ ticket_id, status, assignee_id, delegate_id, delegate_status, description }) => {
      try {
        const updates: Record<string, any> = {};
        if (status !== undefined) updates.status = toDbStatus(status);
        if (assignee_id !== undefined) updates.assignee = assignee_id || null;
        if (delegate_id !== undefined) {
          updates.delegateId = delegate_id || null;
          if (!delegate_id) updates.delegateStatus = null;
        }
        if (delegate_status !== undefined) updates.delegateStatus = delegate_status.toUpperCase();
        if (description !== undefined) updates.instruction = description;

        const task = await db.task.update({ where: { id: ticket_id }, data: updates });
        return { content: [{ type: "text", text: JSON.stringify(serializeTask(task), null, 2) }] };
      } catch (e: any) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }] };
      }
    }
  );
}
