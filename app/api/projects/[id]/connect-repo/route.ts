// app/api/projects/[id]/connect-repo/route.ts
// Verbindet ein Projekt mit einem GitHub Repository:
//  — erstellt den Webhook auf GitHub
//  — speichert webhookSecret + installationId im Project-Record

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { randomBytes } from "crypto";
import type {
  GitHubWebhookCreateResponse,
  GitHubApiError,
} from "@/types/github";

// ─── REQUEST BODY ─────────────────────────────────────────────────────────────

interface ConnectRepoBody {
  repoFullName: string;   // "owner/repo"
  installationId: string; // GitHub App Installation ID
}

// ─── ROUTE HANDLER ───────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  // 1. Session prüfen
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId } = await params;

  // 2. Projekt laden + Ownership prüfen
  const member = await db.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId: session.user.id,
      },
    },
    select: { role: true },
  });

  if (!member || member.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 3. Body validieren
  let body: ConnectRepoBody;
  try {
    body = (await req.json()) as ConnectRepoBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { repoFullName, installationId } = body;

  if (!repoFullName || !installationId) {
    return NextResponse.json(
      { error: "Missing required fields: repoFullName, installationId" },
      { status: 400 }
    );
  }

  // Repo-Owner und Name aus "owner/repo" splitten
  const slashIndex = repoFullName.indexOf("/");
  if (slashIndex === -1 || slashIndex === repoFullName.length - 1) {
    return NextResponse.json(
      { error: "repoFullName must be in format owner/repo" },
      { status: 400 }
    );
  }
  const repoOwner = repoFullName.slice(0, slashIndex);
  const repoName = repoFullName.slice(slashIndex + 1);

  // 4. GitHub Access Token des Users aus Account-Tabelle laden
  const account = await db.account.findFirst({
    where: {
      userId: session.user.id,
      provider: "github",
    },
    select: { access_token: true },
  });

  if (!account?.access_token) {
    return NextResponse.json(
      {
        error:
          "GitHub access token not found. Please re-authenticate with GitHub.",
      },
      { status: 401 }
    );
  }

  const githubToken = account.access_token;

  // 5. Webhook Secret generieren (32 zufällige Bytes als Hex)
  const webhookSecret = randomBytes(32).toString("hex");

  // 6. Webhook auf GitHub erstellen
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/github`;

  const githubRes = await fetch(
    `https://api.github.com/repos/${repoOwner}/${repoName}/hooks`,
    {
      method: "POST",
      headers: {
        Authorization: `token ${githubToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "web",
        active: true,
        events: ["push", "pull_request"],
        config: {
          url: webhookUrl,
          content_type: "json",
          secret: webhookSecret,
          insecure_ssl: "0",
        },
      }),
    }
  );

  if (!githubRes.ok) {
    const errBody = (await githubRes.json().catch(() => ({}))) as GitHubApiError;
    const message = errBody.message ?? `GitHub API error ${githubRes.status}`;

    // Sprechende Fehlermeldungen für häufige Fälle
    if (githubRes.status === 404) {
      return NextResponse.json(
        {
          error: `Repository ${repoFullName} not found or GitHub token has insufficient permissions (needs repo scope).`,
        },
        { status: 422 }
      );
    }
    if (githubRes.status === 422) {
      return NextResponse.json(
        {
          error: `Webhook could not be created: ${message}. A webhook for this URL may already exist.`,
        },
        { status: 422 }
      );
    }

    return NextResponse.json(
      { error: `Failed to create GitHub webhook: ${message}` },
      { status: 502 }
    );
  }

  const webhook = (await githubRes.json()) as GitHubWebhookCreateResponse;

  // 7. Projekt in DB aktualisieren
  const updatedProject = await db.project.update({
    where: { id: projectId },
    data: {
      repoOwner,
      repoName,
      repoUrl: `https://github.com/${repoFullName}`,
      githubInstallationId: installationId,
      webhookSecret,
    },
    select: {
      id: true,
      name: true,
      repoUrl: true,
      repoOwner: true,
      repoName: true,
      githubInstallationId: true,
    },
  });

  return NextResponse.json(
    {
      ok: true,
      webhookId: webhook.id,
      project: updatedProject,
    },
    { status: 200 }
  );
}
