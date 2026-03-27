// app/api/tasks/[taskId]/implement/route.ts
// POST /api/tasks/:taskId/implement
// Lässt Claude einen TODO-Task implementieren, erstellt einen GitHub-Branch und PR.
// Auth: NextAuth-Session (Browser-Aufruf vom eingeloggten User)

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveAuth } from "@/lib/api/auth-middleware";
import { anthropic } from "@/lib/anthropic";
import {
  getFileContent,
  createBranch,
  commitFiles,
  openPullRequest,
} from "@/lib/github-api";

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface ClaudeFileChange {
  path: string;
  content: string;
}

// ─── AUTH HELPER ──────────────────────────────────────────────────────────────

async function assertMember(userId: string, projectId: string): Promise<boolean> {
  const member = await db.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { id: true },
  });
  return !!member;
}

// ─── PROMPT BUILDER ──────────────────────────────────────────────────────────

function buildPrompt(params: {
  taskTitle: string;
  taskInstruction: string | null;
  featureTitle: string;
  epicTitle: string;
  contextFiles: { path: string; content: string }[];
}): { system: string; user: string } {
  const system = `You are an expert software engineer implementing a specific task in a real production codebase.

CRITICAL RULES:
- You MUST respond with a single valid JSON object — nothing else. No prose, no explanation, no markdown outside the JSON.
- The JSON shape is exactly: { "files": [ { "path": "...", "content": "..." }, ... ] }
- "path" is the file path relative to the repo root (e.g. "src/lib/auth.ts")
- "content" is the COMPLETE new content of the file (full file, not a diff or snippet)
- Only include files you are actually changing or creating
- Do NOT include files you are only reading
- Preserve all existing code that is unrelated to the task
- Write clean, production-quality TypeScript/JavaScript code
- Follow the existing code style and patterns from the context files`;

  const fileSection =
    params.contextFiles.length > 0
      ? params.contextFiles
          .map((f) => `\`\`\`\n// FILE: ${f.path}\n${f.content}\n\`\`\``)
          .join("\n\n")
      : "(no context files provided — use your best judgment based on the task description)";

  const user = `# Task to Implement

**Epic:** ${params.epicTitle}
**Feature:** ${params.featureTitle}
**Task:** ${params.taskTitle}

## Instruction
${params.taskInstruction ?? "(no detailed instruction — implement based on the task title)"}

## Context Files
Study these files carefully before making changes:

${fileSection}

## Required Output
Respond with ONLY the JSON object containing all file changes needed to complete this task.`;

  return { system, user };
}

// ─── RESPONSE PARSER ──────────────────────────────────────────────────────────

function parseClaudeResponse(text: string): ClaudeFileChange[] {
  // Entferne eventuell vorhandene Markdown-Code-Fences
  const cleaned = text
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/\s*```\s*$/m, "")
    .trim();

  const parsed = JSON.parse(cleaned) as { files?: unknown };

  if (!Array.isArray(parsed.files)) {
    throw new Error("Claude response missing 'files' array");
  }

  return parsed.files.filter(
    (f): f is ClaudeFileChange =>
      typeof (f as ClaudeFileChange).path === "string" &&
      typeof (f as ClaudeFileChange).content === "string" &&
      (f as ClaudeFileChange).path.length > 0
  );
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;

  // ── Auth ─────────────────────────────────────────────────────────────────
  const authResult = await resolveAuth(request);
  if (!authResult) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Task mit vollständiger Hierarchie laden ───────────────────────────────
  const task = await db.task.findUnique({
    where: { id: taskId },
    include: {
      feature: {
        include: {
          epic: {
            include: {
              project: {
                select: {
                  id: true,
                  repoOwner: true,
                  repoName: true,
                  defaultBranch: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const project = task.feature.epic.project;

  // ── Membership-Check ──────────────────────────────────────────────────────
  const isMember = await assertMember(authResult.userId, project.id);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── Guard: nur TODO-Tasks können implementiert werden ────────────────────
  if (task.status !== "TODO") {
    return NextResponse.json(
      { error: `Task muss den Status TODO haben (aktuell: ${task.status})` },
      { status: 422 }
    );
  }

  // ── Optimistisch: Status auf IN_PROGRESS setzen ──────────────────────────
  await db.task.update({
    where: { id: taskId },
    data: { status: "IN_PROGRESS" },
  });

  try {
    // ── Context Files von GitHub laden ────────────────────────────────────
    const contextFilePaths = Array.isArray(task.contextFiles)
      ? (task.contextFiles as string[])
      : [];

    const contextFiles = (
      await Promise.all(
        contextFilePaths.map(async (path) => {
          const content = await getFileContent(
            project.repoOwner,
            project.repoName,
            path,
            project.defaultBranch
          );
          return content !== null ? { path, content } : null;
        })
      )
    ).filter((f): f is { path: string; content: string } => f !== null);

    // ── Claude-Prompt aufbauen ────────────────────────────────────────────
    const { system, user } = buildPrompt({
      taskTitle: task.title,
      taskInstruction: task.instruction,
      featureTitle: task.feature.title,
      epicTitle: task.feature.epic.title,
      contextFiles,
    });

    // ── Claude aufrufen ───────────────────────────────────────────────────
    const message = await anthropic.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 8192,
      system,
      messages: [{ role: "user", content: user }],
    });

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";

    const fileChanges = parseClaudeResponse(responseText);

    if (fileChanges.length === 0) {
      throw new Error("Claude hat keine Dateiänderungen zurückgegeben");
    }

    // ── GitHub-Branch erstellen ───────────────────────────────────────────
    const branchName = `claude/task-${taskId}`;
    await createBranch(
      project.repoOwner,
      project.repoName,
      branchName,
      project.defaultBranch
    );

    // ── Dateien committen via Git Trees API ───────────────────────────────
    const commitSha = await commitFiles(
      project.repoOwner,
      project.repoName,
      branchName,
      `feat: implement "${task.title}" via Traceback Claude`,
      fileChanges
    );

    // ── Pull Request öffnen ───────────────────────────────────────────────
    const prBody = [
      `Automated implementation of task: **${task.title}**`,
      "",
      task.instruction
        ? `## Instruction\n\n${task.instruction}`
        : "",
      "",
      `## Changed Files`,
      "",
      fileChanges.map((f) => `- \`${f.path}\``).join("\n"),
      "",
      `---`,
      `Generated by [Traceback](https://traceback.dev) Claude | Task ID: \`${taskId}\``,
    ]
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    const prUrl = await openPullRequest(
      project.repoOwner,
      project.repoName,
      branchName,
      project.defaultBranch,
      `feat: ${task.title}`,
      prBody
    );

    // ── Task-Update: IN_REVIEW + PR-Daten speichern ───────────────────────
    const updated = await db.task.update({
      where: { id: taskId },
      data: {
        status: "IN_REVIEW",
        prUrl,
        diffRef: commitSha,
        changedFiles: fileChanges.map((f) => f.path),
        changedBy: "claude",
        changedAt: new Date(),
      },
    });

    return NextResponse.json({
      taskId,
      status: "IN_REVIEW",
      prUrl,
      commitSha,
      changedFiles: fileChanges.map((f) => f.path),
      task: updated,
    });
  } catch (err) {
    // Rollback: Task zurück auf TODO setzen
    await db.task.update({
      where: { id: taskId },
      data: { status: "TODO" },
    });

    console.error("[implement] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Implementierung fehlgeschlagen" },
      { status: 500 }
    );
  }
}
