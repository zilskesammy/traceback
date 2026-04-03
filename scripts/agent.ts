#!/usr/bin/env npx tsx
// scripts/agent.ts — Local Traceback agent
// Usage: TRACEBACK_API_KEY=tb_xxx TRACEBACK_PROJECT_ID=xxx ANTHROPIC_API_KEY=sk-ant-xxx npx tsx scripts/agent.ts

import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const API_KEY = process.env.TRACEBACK_API_KEY;
const PROJECT_ID = process.env.TRACEBACK_PROJECT_ID;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const BASE_URL = process.env.TRACEBACK_URL ?? "https://traceback-hazel.vercel.app";
const REPO_DIR = process.env.REPO_DIR ?? process.cwd();

if (!API_KEY || !PROJECT_ID || !ANTHROPIC_KEY) {
  console.error(
    "Missing env vars: TRACEBACK_API_KEY, TRACEBACK_PROJECT_ID, ANTHROPIC_API_KEY"
  );
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${API_KEY}`,
};

// ─── Traceback API helpers ────────────────────────────────────────────────────

async function heartbeat() {
  await fetch(`${BASE_URL}/api/agent-tunnel/heartbeat`, {
    method: "POST",
    headers,
    body: JSON.stringify({ projectId: PROJECT_ID }),
  });
}

async function pollTask() {
  const res = await fetch(
    `${BASE_URL}/api/agent-tunnel/poll?projectId=${PROJECT_ID}`,
    { headers }
  );
  const data = await res.json();
  return data.task as { id: string; prompt: string } | null;
}

async function pushChunk(
  taskId: string,
  content: string,
  chunkType: string,
  done = false,
  error = false,
  featureId?: string
) {
  await fetch(`${BASE_URL}/api/agent-tunnel/chunks`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      taskId,
      projectId: PROJECT_ID,
      content,
      chunkType,
      done,
      error,
      featureId,
    }),
  });
}

async function createFeature(
  title: string,
  type: string,
  summary: string
): Promise<string | null> {
  const res = await fetch(
    `${BASE_URL}/api/projects/${PROJECT_ID}/changelog`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: `task-${Date.now()}`,
        type: type.toUpperCase(),
        status: "COMPLETED",
        priority: "MEDIUM",
        title,
        summary,
        source: "UI",
        tags: ["agent"],
        affectedComponents: [],
        acceptanceCriteria: [],
      }),
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.id ?? null;
}

// ─── Claude tools ─────────────────────────────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: "read_file",
    description: "Read a file from the repository",
    input_schema: {
      type: "object" as const,
      properties: { path: { type: "string", description: "Relative path from repo root" } },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Write content to a file (creates or overwrites)",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "Relative path from repo root" },
        content: { type: "string", description: "Full file content" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "bash",
    description: "Run a shell command in the repository root",
    input_schema: {
      type: "object" as const,
      properties: { command: { type: "string", description: "Shell command to run" } },
      required: ["command"],
    },
  },
  {
    name: "list_files",
    description: "List files in a directory",
    input_schema: {
      type: "object" as const,
      properties: {
        dir: { type: "string", description: "Directory path relative to repo root, default '.'" },
      },
      required: [],
    },
  },
  {
    name: "task_complete",
    description: "Mark the task as done. Optionally create a Traceback changelog entry.",
    input_schema: {
      type: "object" as const,
      properties: {
        summary: { type: "string", description: "What was accomplished" },
        createEntry: {
          type: "object",
          description: "If provided, creates a Traceback changelog entry",
          properties: {
            title: { type: "string" },
            type: { type: "string", enum: ["FEATURE", "BUGFIX", "TASK", "EPIC"] },
            summary: { type: "string" },
          },
          required: ["title", "type", "summary"],
        },
      },
      required: ["summary"],
    },
  },
];

// ─── Tool executor ────────────────────────────────────────────────────────────

function executeTool(
  name: string,
  input: Record<string, unknown>
): { result: string; featureId?: string } {
  try {
    if (name === "read_file") {
      const filePath = path.join(REPO_DIR, input.path as string);
      const content = fs.readFileSync(filePath, "utf-8");
      return { result: content.slice(0, 8000) }; // limit output
    }

    if (name === "write_file") {
      const filePath = path.join(REPO_DIR, input.path as string);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, input.content as string, "utf-8");
      return { result: `Written: ${input.path}` };
    }

    if (name === "bash") {
      const output = execSync(input.command as string, {
        cwd: REPO_DIR,
        timeout: 60_000,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      return { result: output.slice(0, 4000) };
    }

    if (name === "list_files") {
      const dir = path.join(REPO_DIR, (input.dir as string) ?? ".");
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const result = entries
        .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
        .join("\n");
      return { result };
    }

    return { result: "Unknown tool" };
  } catch (e: unknown) {
    return { result: `Error: ${e instanceof Error ? e.message : String(e)}` };
  }
}

// ─── Task runner ──────────────────────────────────────────────────────────────

async function runTask(taskId: string, prompt: string) {
  console.log(`Running task ${taskId}: ${prompt.slice(0, 60)}...`);

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: prompt },
  ];

  let featureId: string | undefined;
  let done = false;

  while (!done) {
    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 8096,
      tools: TOOLS,
      messages,
      system: `You are a coding agent working in the repository at ${REPO_DIR}.
Complete the user's task using the available tools.
When you are finished, call task_complete with a summary of what you did.
If the task involved creating a feature or fixing a bug, also provide createEntry.`,
    });

    // Stream text chunks to the browser as they arrive
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        await pushChunk(taskId, event.delta.text, "text");
      }
    }

    const response = await stream.finalMessage();

    // Add full assistant turn to history BEFORE processing tool calls
    messages.push({ role: "assistant", content: response.content });

    // Now process tool use blocks
    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );

    if (toolUseBlocks.length === 0) {
      // No tool calls — model is done (shouldn't happen without task_complete, but handle gracefully)
      done = true;
      break;
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolBlock of toolUseBlocks) {
      const toolInput = toolBlock.input as Record<string, unknown>;

      if (toolBlock.name === "task_complete") {
        const inp = toolInput as {
          summary: string;
          createEntry?: { title: string; type: string; summary: string };
        };

        if (inp.createEntry) {
          featureId =
            (await createFeature(
              inp.createEntry.title,
              inp.createEntry.type,
              inp.createEntry.summary
            )) ?? undefined;
        }

        await pushChunk(taskId, `✓ ${inp.summary}`, "done", true, false, featureId);
        done = true;
        break;
      }

      await pushChunk(
        taskId,
        `▶ ${toolBlock.name}(${JSON.stringify(toolInput).slice(0, 100)})`,
        "tool_use"
      );
      const { result } = executeTool(toolBlock.name, toolInput);
      await pushChunk(taskId, result.slice(0, 500), "tool_result");

      toolResults.push({
        type: "tool_result",
        tool_use_id: toolBlock.id,
        content: result,
      });
    }

    if (!done && toolResults.length > 0) {
      messages.push({ role: "user", content: toolResults });
    }
  }

  console.log(`Task ${taskId} complete`);
}

// ─── Main loop ────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Traceback agent started`);
  console.log(`   Project: ${PROJECT_ID}`);
  console.log(`   Repo: ${REPO_DIR}`);
  console.log(`   Server: ${BASE_URL}`);

  // Heartbeat every 5 seconds
  setInterval(heartbeat, 5_000);
  await heartbeat();

  // Poll for tasks every 1 second
  let busy = false;
  setInterval(async () => {
    if (busy) return;
    const task = await pollTask();
    if (!task) return;

    busy = true;
    try {
      await runTask(task.id, task.prompt);
    } catch (e) {
      console.error(`Task ${task.id} failed:`, e);
      await pushChunk(task.id, `Error: ${e instanceof Error ? e.message : String(e)}`, "text", false, true);
    } finally {
      busy = false;
    }
  }, 1_000);
}

main().catch(console.error);
