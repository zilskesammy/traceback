// lib/github-api.ts — GitHub file read/write helpers via @octokit/rest
// Verwendet einen GitHub Personal Access Token (GITHUB_TOKEN env var).

import { Octokit } from "@octokit/rest";

// Singleton Octokit — GITHUB_TOKEN Personal Access Token mit `repo` Scope
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

// ─── READ ─────────────────────────────────────────────────────────────────────

/**
 * Liest eine Datei aus GitHub und gibt ihren UTF-8-Inhalt zurück.
 * Gibt null zurück, wenn die Datei nicht existiert (404).
 */
export async function getFileContent(
  owner: string,
  repo: string,
  path: string,
  ref: string
): Promise<string | null> {
  try {
    const { data } = await octokit.repos.getContent({ owner, repo, path, ref });
    if (Array.isArray(data) || data.type !== "file") return null;
    return Buffer.from(data.content, "base64").toString("utf-8");
  } catch (err: unknown) {
    if ((err as { status?: number }).status === 404) return null;
    throw err;
  }
}

// ─── BRANCH ───────────────────────────────────────────────────────────────────

/**
 * Erstellt einen neuen Branch, der auf den Tip von baseBranch zeigt.
 * Idempotent: wenn der Branch bereits existiert (422), wird kein Fehler geworfen.
 */
export async function createBranch(
  owner: string,
  repo: string,
  branchName: string,
  baseBranch: string
): Promise<void> {
  const { data: ref } = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${baseBranch}`,
  });
  const sha = ref.object.sha;

  try {
    await octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha,
    });
  } catch (err: unknown) {
    // 422 = Branch existiert bereits — idempotent behandeln
    if ((err as { status?: number }).status !== 422) throw err;
  }
}

// ─── COMMIT ───────────────────────────────────────────────────────────────────

/**
 * Committet mehrere Dateiänderungen auf einen Branch via Git Trees API.
 * Alle Dateien werden in einem einzigen atomaren Commit zusammengefasst.
 *
 * @param files Array von { path, content } (vollständige Dateiinhalte, kein Diff)
 * @returns SHA des neuen Commits
 */
export async function commitFiles(
  owner: string,
  repo: string,
  branch: string,
  message: string,
  files: { path: string; content: string }[]
): Promise<string> {
  // 1. Aktuellen HEAD-Commit-SHA des Branch holen
  const { data: refData } = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${branch}`,
  });
  const parentSha = refData.object.sha;

  // 2. Tree-SHA des HEAD-Commits holen
  const { data: commitData } = await octokit.git.getCommit({
    owner,
    repo,
    commit_sha: parentSha,
  });
  const baseTreeSha = commitData.tree.sha;

  // 3. Blobs für jede Datei parallel erstellen
  const treeItems = await Promise.all(
    files.map(async ({ path, content }) => {
      const { data: blob } = await octokit.git.createBlob({
        owner,
        repo,
        content,
        encoding: "utf-8",
      });
      return {
        path,
        mode: "100644" as const,
        type: "blob" as const,
        sha: blob.sha,
      };
    })
  );

  // 4. Neuen Tree erstellen (überlagert geänderte Dateien auf base tree)
  const { data: newTree } = await octokit.git.createTree({
    owner,
    repo,
    base_tree: baseTreeSha,
    tree: treeItems,
  });

  // 5. Commit-Objekt erstellen
  const { data: newCommit } = await octokit.git.createCommit({
    owner,
    repo,
    message,
    tree: newTree.sha,
    parents: [parentSha],
    author: {
      name: "Traceback Claude",
      email: "claude@traceback.dev",
      date: new Date().toISOString(),
    },
  });

  // 6. Branch-Ref auf neuen Commit zeigen lassen
  await octokit.git.updateRef({
    owner,
    repo,
    ref: `heads/${branch}`,
    sha: newCommit.sha,
  });

  return newCommit.sha;
}

// ─── PULL REQUEST ─────────────────────────────────────────────────────────────

/**
 * Öffnet einen Pull Request von head → base.
 * Gibt die PR-URL zurück.
 */
export async function openPullRequest(
  owner: string,
  repo: string,
  head: string,
  base: string,
  title: string,
  body: string
): Promise<string> {
  const { data: pr } = await octokit.pulls.create({
    owner,
    repo,
    head,
    base,
    title,
    body,
  });
  return pr.html_url;
}
