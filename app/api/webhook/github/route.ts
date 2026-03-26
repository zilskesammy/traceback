// app/api/webhook/github/route.ts — GitHub Webhook Receiver
// Verifiziert HMAC SHA-256, verarbeitet push + pull_request Events,
// schreibt Commits in DB und matched Dateien gegen Tickets.

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { extractFilesFromPush, extractBranchFromRef } from "@/lib/webhook/extractFilesFromPush";
import { matchFilesToTickets } from "@/lib/webhook/matchFilesToTickets";
import type { GitHubPushPayload, GitHubPullRequestPayload } from "@/types/github";

// Next.js soll den Body nicht parsen — wir brauchen den Raw-String für HMAC
export const dynamic = "force-dynamic";

// ─── ENTRY POINT ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Raw Body lesen (muss VOR json() passieren — danach nicht mehr lesbar)
  const rawBody = await req.text();

  // 2. GitHub Event-Header lesen
  const signature = req.headers.get("x-hub-signature-256");
  const eventType = req.headers.get("x-github-event");
  const deliveryId = req.headers.get("x-github-delivery");

  if (!signature || !eventType) {
    return error(400, "Missing required GitHub headers");
  }

  // 3. Payload parsen um Repository-Info zu bekommen (für Projekt-Lookup)
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return error(400, "Invalid JSON payload");
  }

  // 4. Repository Full Name aus Payload lesen
  const repoFullName = getRepoFullName(payload);
  if (!repoFullName) {
    return error(400, "Cannot determine repository from payload");
  }

  // 5. Projekt anhand des Repo-Namens finden
  const [repoOwner, repoName] = repoFullName.split("/");
  const project = await db.project.findFirst({
    where: { repoOwner, repoName },
    select: { id: true, webhookSecret: true },
  });

  if (!project) {
    // Kein Log — verhindert Enumeration von bekannten Repos
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // 6. HMAC SHA-256 Signatur verifizieren
  const signatureValid = verifySignature(rawBody, signature, project.webhookSecret);
  if (!signatureValid) {
    return error(401, "Invalid signature");
  }

  // 7. Delivery-ID loggen (hilfreich für Debugging)
  console.log(`[webhook] event=${eventType} delivery=${deliveryId} repo=${repoFullName}`);

  // 8. Event dispatchen
  try {
    switch (eventType) {
      case "push":
        await handlePush(project.id, payload as GitHubPushPayload);
        break;

      case "pull_request":
        await handlePullRequest(project.id, payload as GitHubPullRequestPayload);
        break;

      case "ping":
        // GitHub sendet ping beim Erstellen des Webhooks — immer 200 zurück
        break;

      default:
        // Unbekannte Events werden ignoriert (nicht mit Fehler abbrechen)
        console.log(`[webhook] Unhandled event type: ${eventType}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[webhook] Processing failed: ${message}`, err);
    return error(500, `Processing failed: ${message}`);
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

// ─── EVENT HANDLER ────────────────────────────────────────────────────────────

async function handlePush(
  projectId: string,
  payload: GitHubPushPayload
): Promise<void> {
  // Leere Pushes ignorieren (z.B. bei Branch-Deletion)
  if (!payload.commits || payload.commits.length === 0) {
    return;
  }

  const headSha = payload.after;
  const branch = extractBranchFromRef(payload.ref);
  const changedFiles = extractFilesFromPush(payload);

  // Erster Commit als Repräsentant für Author + Message
  const headCommit = payload.head_commit ?? payload.commits[payload.commits.length - 1];
  const message = headCommit?.message ?? "";
  const author = headCommit?.author.name ?? payload.pusher.name;
  const pushedAt = headCommit?.timestamp
    ? new Date(headCommit.timestamp)
    : new Date();

  // Commit in DB schreiben (upsert: verhindert Duplikate bei Re-Delivery)
  await db.commit.upsert({
    where: {
      projectId_sha: { projectId, sha: headSha },
    },
    create: {
      projectId,
      sha: headSha,
      message,
      author,
      pushedAt,
      branch,
      filesChanged: changedFiles,
    },
    update: {
      // Bei Re-Delivery: Daten aktualisieren falls nötig
      filesChanged: changedFiles,
    },
  });

  // Dateien gegen Tickets matchen + betroffene Tickets updaten
  const result = await matchFilesToTickets(
    projectId,
    headSha,
    changedFiles,
    payload.pusher.name
  );

  console.log(
    `[webhook] push sha=${headSha.slice(0, 7)} files=${changedFiles.length} matched=${result.total} (features=${result.featuresMatched}, tasks=${result.tasksMatched})`
  );
}

async function handlePullRequest(
  projectId: string,
  payload: GitHubPullRequestPayload
): Promise<void> {
  const { action, pull_request } = payload;

  // Nur relevante Actions verarbeiten
  if (!["opened", "synchronize", "closed"].includes(action)) {
    return;
  }

  const headSha = pull_request.head.sha;

  // Bei geschlossenen + gemergten PRs: Tickets matchen (Merge-Commit)
  if (action === "closed" && pull_request.merged) {
    const result = await matchFilesToTickets(
      projectId,
      headSha,
      [], // Keine Dateiliste — nur diffRef aktualisieren
      pull_request.user.login
    );
    console.log(
      `[webhook] PR #${pull_request.number} merged sha=${headSha.slice(0, 7)} matched=${result.total}`
    );
  }

  // Bei neuen Commits auf einem PR: sha als diffRef in passende Tasks schreiben
  if (action === "synchronize" || action === "opened") {
    console.log(
      `[webhook] PR #${pull_request.number} ${action} sha=${headSha.slice(0, 7)}`
    );
  }
}

// ─── HILFSFUNKTIONEN ─────────────────────────────────────────────────────────

/**
 * Verifiziert HMAC SHA-256 Signatur mit constantem Zeitvergleich
 * (verhindert Timing-Angriffe).
 */
function verifySignature(
  rawBody: string,
  receivedSignature: string,
  secret: string
): boolean {
  const expected =
    "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");

  try {
    // timingSafeEqual erfordert gleiche Buffer-Länge
    const a = Buffer.from(receivedSignature, "utf8");
    const b = Buffer.from(expected, "utf8");

    if (a.length !== b.length) return false;

    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Liest den Repository-Fullname (owner/repo) aus einem beliebigen Payload.
 */
function getRepoFullName(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  const repo = p.repository;
  if (typeof repo !== "object" || repo === null) return null;
  const fullName = (repo as Record<string, unknown>).full_name;
  return typeof fullName === "string" ? fullName : null;
}

/**
 * Erstellt eine strukturierte Fehler-Response.
 */
function error(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}
