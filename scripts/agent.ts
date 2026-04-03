#!/usr/bin/env npx tsx
// scripts/agent.ts — Local Traceback agent (uses Claude Code CLI, no API key needed)
// Usage: TRACEBACK_API_KEY=tb_xxx TRACEBACK_PROJECT_ID=xxx npm run agent

import { spawn } from "child_process";

const API_KEY = process.env.TRACEBACK_API_KEY;
const PROJECT_ID = process.env.TRACEBACK_PROJECT_ID;
const BASE_URL = process.env.TRACEBACK_URL ?? "https://traceback-hazel.vercel.app";
const REPO_DIR = process.env.REPO_DIR ?? process.cwd();

if (!API_KEY || !PROJECT_ID) {
  console.error("Missing env vars: TRACEBACK_API_KEY, TRACEBACK_PROJECT_ID");
  process.exit(1);
}

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${API_KEY}`,
};

// ─── Traceback API helpers ────────────────────────────────────────────────────

async function heartbeat() {
  try {
    await fetch(`${BASE_URL}/api/agent-tunnel/heartbeat`, {
      method: "POST",
      headers,
      body: JSON.stringify({ projectId: PROJECT_ID }),
    });
  } catch {
    // ignore network errors on heartbeat
  }
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

// ─── Task runner via Claude Code CLI ─────────────────────────────────────────

async function runTask(taskId: string, prompt: string): Promise<void> {
  console.log(`Running task ${taskId}: ${prompt.slice(0, 60)}...`);

  return new Promise((resolve, reject) => {
    const systemPrompt = `You are a coding agent working in the repository at ${REPO_DIR}. Complete the user's task. When done, output a final line: TASK_COMPLETE: <one-line summary of what you did>`;

    const proc = spawn(
      "claude",
      [
        "-p",
        `${systemPrompt}\n\nTask: ${prompt}`,
        "--output-format",
        "stream-json",
        "--allowedTools",
        "Bash,Read,Write,Edit,Glob,Grep,LS",
        "--no-auto-create-claude-md",
      ],
      {
        cwd: REPO_DIR,
        env: { ...process.env },
      }
    );

    let buffer = "";
    let summaryLine = "";

    proc.stdout.on("data", async (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          await handleStreamEvent(taskId, event);

          // Capture summary from assistant text
          if (event.type === "assistant" && event.message?.content) {
            for (const block of event.message.content) {
              if (block.type === "text" && block.text?.includes("TASK_COMPLETE:")) {
                const match = block.text.match(/TASK_COMPLETE:\s*(.+)/);
                if (match) summaryLine = match[1].trim();
              }
            }
          }
        } catch {
          // not JSON — plain text output
          if (line.trim()) {
            await pushChunk(taskId, line, "text");
          }
        }
      }
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString().trim();
      if (text) console.error("[agent stderr]", text);
    });

    proc.on("close", async (code) => {
      const summary = summaryLine || "Task completed";
      if (code === 0) {
        await pushChunk(taskId, `✓ ${summary}`, "done", true, false, undefined);
        resolve();
      } else {
        await pushChunk(taskId, `Process exited with code ${code}`, "text", false, true);
        reject(new Error(`claude exited with code ${code}`));
      }
    });

    proc.on("error", async (err) => {
      const msg = err.message.includes("ENOENT")
        ? "claude CLI not found. Make sure Claude Code is installed: https://claude.ai/code"
        : err.message;
      await pushChunk(taskId, `Error: ${msg}`, "text", false, true);
      reject(err);
    });
  });
}

// ─── Stream event handler ─────────────────────────────────────────────────────

async function handleStreamEvent(taskId: string, event: Record<string, unknown>) {
  // stream-json format from claude CLI
  if (event.type === "assistant") {
    const msg = event.message as { content?: Array<{ type: string; text?: string; name?: string; input?: unknown }> };
    if (!msg?.content) return;

    for (const block of msg.content) {
      if (block.type === "text" && block.text) {
        // Skip the TASK_COMPLETE line — shown as the done message
        const text = block.text.replace(/TASK_COMPLETE:.*$/m, "").trim();
        if (text) await pushChunk(taskId, text, "text");
      }
      if (block.type === "tool_use") {
        const input = JSON.stringify(block.input ?? {}).slice(0, 100);
        await pushChunk(taskId, `▶ ${block.name}(${input})`, "tool_use");
      }
    }
  }

  if (event.type === "tool_result") {
    const result = event.result as { content?: Array<{ type: string; text?: string }> };
    const text = result?.content?.find((c) => c.type === "text")?.text ?? "";
    if (text) await pushChunk(taskId, text.slice(0, 500), "tool_result");
  }
}

// ─── Main loop ────────────────────────────────────────────────────────────────

async function main() {
  console.log("Traceback agent started (Claude Code CLI)");
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
    } finally {
      busy = false;
    }
  }, 1_000);
}

main().catch(console.error);
