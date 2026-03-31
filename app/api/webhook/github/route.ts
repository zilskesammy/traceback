// app/api/webhook/github/route.ts — GitHub Webhook Receiver

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { extractFilesFromPush, extractBranchFromRef } from "@/lib/webhook/extractFilesFromPush";
import { fetchChangelogFromGitHub } from "@/lib/changelog/parser";
import { upsertChangelogFeature } from "@/lib/db/changelog";
import type { GitHubPushPayload } from "@/types/github";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");
  const eventType = req.headers.get("x-github-event");
  const deliveryId = req.headers.get("x-github-delivery");

  if (!signature || !eventType) {
    return error(400, "Missing required GitHub headers");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return error(400, "Invalid JSON payload");
  }

  const repoFullName = getRepoFullName(payload);
  if (!repoFullName) return error(400, "Cannot determine repository from payload");

  const [repoOwner, repoName] = repoFullName.split("/");
  const project = await db.project.findFirst({
    where: { repoOwner, repoName },
    select: { id: true, webhookSecret: true, defaultBranch: true },
  });

  if (!project) return NextResponse.json({ ok: true }, { status: 200 });

  const signatureValid = verifySignature(rawBody, signature, project.webhookSecret);
  if (!signatureValid) return error(401, "Invalid signature");

  console.log(`[webhook] event=${eventType} delivery=${deliveryId} repo=${repoFullName}`);

  try {
    switch (eventType) {
      case "push":
        await handlePush(project.id, project.defaultBranch, payload as GitHubPushPayload, repoOwner, repoName);
        break;
      case "ping":
        break;
      default:
        console.log(`[webhook] Unhandled event type: ${eventType}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[webhook] Processing failed: ${message}`, err);
    return error(500, `Processing failed: ${message}`);
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

async function handlePush(
  projectId: string,
  defaultBranch: string,
  payload: GitHubPushPayload,
  repoOwner: string,
  repoName: string
): Promise<void> {
  if (!payload.commits || payload.commits.length === 0) return;

  const headSha = payload.after;
  const branch = extractBranchFromRef(payload.ref);
  const changedFiles = extractFilesFromPush(payload);

  const headCommit = payload.head_commit ?? payload.commits[payload.commits.length - 1];
  const message = headCommit?.message ?? "";
  const author = headCommit?.author.name ?? payload.pusher.name;
  const pushedAt = headCommit?.timestamp ? new Date(headCommit.timestamp) : new Date();

  await db.commit.upsert({
    where: { projectId_sha: { projectId, sha: headSha } },
    create: { projectId, sha: headSha, message, author, pushedAt, branch, filesChanged: changedFiles },
    update: { filesChanged: changedFiles },
  });

  const hasChangelogChanges = changedFiles.some((f: string) =>
    f.startsWith(".agent-changelog/")
  );

  if (hasChangelogChanges) {
    console.log(`[webhook] .agent-changelog/ changed — syncing changelog for project ${projectId}`);
    try {
      const features = await fetchChangelogFromGitHub(repoOwner, repoName, branch || defaultBranch);
      for (const feature of features) {
        await upsertChangelogFeature(projectId, feature);
      }
      console.log(`[webhook] Synced ${features.length} changelog features`);
    } catch (err) {
      console.error("[webhook] Changelog sync failed:", err);
      // Don't re-throw — commit was saved regardless
    }
  }
}

function verifySignature(rawBody: string, receivedSignature: string, secret: string): boolean {
  const expected = "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    const a = Buffer.from(receivedSignature, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function getRepoFullName(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  const repo = p.repository;
  if (typeof repo !== "object" || repo === null) return null;
  const fullName = (repo as Record<string, unknown>).full_name;
  return typeof fullName === "string" ? fullName : null;
}

function error(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}
