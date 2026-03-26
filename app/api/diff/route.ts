// app/api/diff/route.ts — GitHub Commit Diff Proxy
// GET ?sha=<commitSha>&file=<filePath>&projectId=<id>
// Lädt den Patch aus der GitHub API und parst ihn in typisierte DiffLines

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { DiffLine, FileDiff } from "@/types/planning";

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface GitHubCommitFile {
  filename: string;
  additions: number;
  deletions: number;
  changes: number;
  status: string;
  patch?: string;
}

interface GitHubCommitResponse {
  sha: string;
  files: GitHubCommitFile[];
}

// ─── DIFF PARSER ─────────────────────────────────────────────────────────────

function parsePatch(patch: string): DiffLine[] {
  if (!patch) return [];

  return patch.split("\n").map((raw): DiffLine => {
    if (raw.startsWith("@@")) {
      return { type: "header", content: raw };
    }
    if (raw.startsWith("+")) {
      return { type: "add", content: raw.slice(1) };
    }
    if (raw.startsWith("-")) {
      return { type: "remove", content: raw.slice(1) };
    }
    // Kontextzeile: beginnt mit Leerzeichen oder ist leer
    return { type: "context", content: raw.startsWith(" ") ? raw.slice(1) : raw };
  });
}

// ─── ROUTE HANDLER ───────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  // 1. Auth
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Query params
  const { searchParams } = req.nextUrl;
  const sha = searchParams.get("sha");
  const file = searchParams.get("file");
  const projectId = searchParams.get("projectId");

  if (!sha || !file || !projectId) {
    return NextResponse.json(
      { error: "Missing required query params: sha, file, projectId" },
      { status: 400 }
    );
  }

  // 3. Projekt laden (Owner + Repo)
  const project = await db.project.findFirst({
    where: {
      id: projectId,
      // Sicherstellen dass der User Zugriff auf dieses Projekt hat
      members: { some: { userId: session.user.id } },
    },
    select: { repoOwner: true, repoName: true },
  });

  if (!project) {
    return NextResponse.json(
      { error: "Project not found or access denied" },
      { status: 404 }
    );
  }

  // 4. GitHub Access Token des Users laden
  const account = await db.account.findFirst({
    where: {
      userId: session.user.id,
      provider: "github",
    },
    select: { access_token: true },
  });

  // 5. GitHub API aufrufen
  const apiUrl = `https://api.github.com/repos/${project.repoOwner}/${project.repoName}/commits/${sha}`;

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (account?.access_token) {
    headers.Authorization = `token ${account.access_token}`;
  }

  let githubRes: Response;
  try {
    githubRes = await fetch(apiUrl, { headers });
  } catch {
    return NextResponse.json(
      { error: "Failed to reach GitHub API" },
      { status: 502 }
    );
  }

  if (githubRes.status === 404) {
    return NextResponse.json(
      { error: `Commit ${sha.slice(0, 7)} not found in ${project.repoOwner}/${project.repoName}` },
      { status: 404 }
    );
  }

  if (!githubRes.ok) {
    return NextResponse.json(
      { error: `GitHub API returned ${githubRes.status}` },
      { status: 502 }
    );
  }

  const commit = (await githubRes.json()) as GitHubCommitResponse;

  // 6. Datei aus Commit extrahieren
  const fileData = commit.files?.find((f) => f.filename === file);

  if (!fileData) {
    // Datei war in diesem Commit nicht betroffen — leerer Diff
    const result: FileDiff = {
      file,
      additions: 0,
      deletions: 0,
      lines: [],
    };
    return NextResponse.json(result, { status: 200 });
  }

  // 7. Patch parsen
  const lines = parsePatch(fileData.patch ?? "");

  const result: FileDiff = {
    file,
    additions: fileData.additions,
    deletions: fileData.deletions,
    lines,
  };

  return NextResponse.json(result, {
    status: 200,
    headers: {
      // 5-Minuten Cache — Commit-Diffs ändern sich nie
      "Cache-Control": "private, max-age=300",
    },
  });
}
