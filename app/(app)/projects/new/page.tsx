// app/(app)/projects/new/page.tsx — Neues Projekt aus GitHub-Repo anlegen

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { NewProjectForm } from "./NewProjectForm";
import { createGitHubWebhook } from "@/lib/github-api";

// GitHub-Repos des eingeloggten Users laden
async function fetchUserRepos(accessToken: string) {
  const repos: GitHubRepo[] = [];
  let page = 1;

  while (true) {
    const res = await fetch(
      `https://api.github.com/user/repos?sort=updated&per_page=100&page=${page}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        next: { revalidate: 60 },
      }
    );
    if (!res.ok) break;
    const batch: GitHubRepo[] = await res.json();
    if (batch.length === 0) break;
    repos.push(...batch);
    if (batch.length < 100) break;
    page++;
  }

  return repos;
}

export interface GitHubRepo {
  id: number;
  full_name: string;
  name: string;
  owner: { login: string };
  description: string | null;
  private: boolean;
  html_url: string;
  default_branch: string;
  updated_at: string;
  language: string | null;
}

export default async function NewProjectPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // GitHub Access Token aus der Account-Tabelle holen
  const account = await db.account.findFirst({
    where: { userId: session.user.id, provider: "github" },
    select: { access_token: true },
  });

  let repos: GitHubRepo[] = [];
  if (account?.access_token) {
    repos = await fetchUserRepos(account.access_token);
  }

  // Server Action: Projekt erstellen
  async function createProject(formData: FormData) {
    "use server";

    const session = await auth();
    if (!session?.user?.id) redirect("/login");

    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const repoUrl = formData.get("repoUrl") as string;
    const repoOwner = formData.get("repoOwner") as string;
    const repoName = formData.get("repoName") as string;
    const defaultBranch = (formData.get("defaultBranch") as string) || "main";

    if (!name?.trim() || !repoUrl?.trim() || !repoOwner?.trim() || !repoName?.trim()) return;

    // Starkes Webhook-Secret generieren
    const { randomBytes } = await import("crypto");
    const webhookSecret = randomBytes(32).toString("hex");

    const project = await db.project.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        repoUrl: repoUrl.trim(),
        repoOwner: repoOwner.trim(),
        repoName: repoName.trim(),
        githubInstallationId: "",
        webhookSecret,
        defaultBranch,
        members: {
          create: {
            userId: session.user.id,
            role: "OWNER",
          },
        },
      },
    });

    // Webhook automatisch auf GitHub registrieren
    const ghAccount = await db.account.findFirst({
      where: { userId: session.user.id, provider: "github" },
      select: { access_token: true },
    });
    if (ghAccount?.access_token && process.env.NEXT_PUBLIC_APP_URL) {
      const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/github`;
      await createGitHubWebhook(
        repoOwner.trim(),
        repoName.trim(),
        ghAccount.access_token,
        webhookUrl,
        webhookSecret
      ).catch(() => {
        // Webhook-Fehler sind nicht kritisch — Nutzer kann manuell einrichten
        console.warn("[new-project] Webhook-Registrierung fehlgeschlagen");
      });
    }

    redirect(`/projects/${project.id}`);
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      {/* Top Nav */}
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center gap-4">
        <Link
          href="/dashboard"
          className="text-zinc-400 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <span className="font-semibold text-sm">Traceback</span>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-xl font-semibold">Neues Projekt</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Wähle ein GitHub Repository aus und gib dem Projekt einen Namen.
          </p>
        </div>

        <NewProjectForm repos={repos} createProject={createProject} />
      </div>
    </main>
  );
}
