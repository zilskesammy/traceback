// app/(app)/projects/new/page.tsx — Neues Projekt anlegen

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function NewProjectPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  async function createProject(formData: FormData) {
    "use server";

    const session = await auth();
    if (!session?.user?.id) redirect("/login");

    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const repoUrl = formData.get("repoUrl") as string;

    if (!name?.trim() || !repoUrl?.trim()) return;

    // GitHub URL parsen: https://github.com/owner/repo
    const match = repoUrl.trim().match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/.*)?$/);
    if (!match) return;

    const [, repoOwner, repoName] = match;

    const project = await db.project.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        repoUrl: repoUrl.trim(),
        repoOwner,
        repoName,
        githubInstallationId: "",
        webhookSecret: crypto.randomUUID(),
        defaultBranch: "main",
        members: {
          create: {
            userId: session.user.id,
            role: "OWNER",
          },
        },
      },
    });

    redirect(`/projects/${project.id}`);
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      {/* Top Nav */}
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard" className="text-zinc-400 hover:text-white transition-colors">
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

      {/* Form */}
      <div className="max-w-lg mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-xl font-semibold">Neues Projekt</h1>
          <p className="text-sm text-zinc-400 mt-1">Verbinde ein GitHub Repository mit Traceback.</p>
        </div>

        <form action={createProject} className="space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Projektname <span className="text-red-400">*</span>
            </label>
            <input
              name="name"
              type="text"
              required
              placeholder="Mein Projekt"
              className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Beschreibung <span className="text-zinc-600 font-normal">(optional)</span>
            </label>
            <textarea
              name="description"
              rows={3}
              placeholder="Kurze Beschreibung des Projekts..."
              className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-indigo-500 transition-colors resize-none"
            />
          </div>

          {/* Repo URL */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              GitHub Repository URL <span className="text-red-400">*</span>
            </label>
            <input
              name="repoUrl"
              type="url"
              required
              placeholder="https://github.com/username/repository"
              className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-600 text-sm font-mono focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <p className="mt-1.5 text-xs text-zinc-600">
              Webhook-Integration kann später in den Projekteinstellungen konfiguriert werden.
            </p>
          </div>

          {/* Submit */}
          <div className="pt-2 flex items-center gap-3">
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium transition-colors"
            >
              Projekt anlegen
            </button>
            <Link
              href="/dashboard"
              className="px-4 py-2.5 rounded-lg border border-zinc-800 hover:border-zinc-700 text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Abbrechen
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
