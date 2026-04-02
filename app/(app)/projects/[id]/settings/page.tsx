// app/(app)/projects/[id]/settings/page.tsx — Server Component

import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ApiKeysSection } from "@/components/settings/ApiKeysSection";
import { RepoSection } from "@/components/settings/RepoSection";
import { ChangelogSection } from "@/components/settings/ChangelogSection";

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = await params;

  const [project, commitStats] = await Promise.all([
    db.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        repoOwner: true,
        repoName: true,
        repoUrl: true,
        defaultBranch: true,
        changelogBranch: true,
        apiKeys: {
          select: {
            id: true,
            label: true,
            keyPrefix: true,
            lastUsedAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    db.commit.aggregate({
      where: { projectId },
      _count: { id: true },
      _max: { pushedAt: true },
    }),
  ]);

  if (!project) notFound();

  const initialKeys = project.apiKeys.map((k) => ({
    id: k.id,
    label: k.label,
    keyPrefix: k.keyPrefix,
    lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
    createdAt: k.createdAt.toISOString(),
  }));

  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const webhookUrl = `${protocol}://${host}/api/webhook/github`;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-xl font-semibold text-zinc-100">
            {project.name}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">Projekteinstellungen</p>
        </div>

        <RepoSection
          repoOwner={project.repoOwner}
          repoName={project.repoName}
          repoUrl={project.repoUrl}
          defaultBranch={project.defaultBranch}
          lastCommitAt={commitStats._max.pushedAt?.toISOString() ?? null}
          commitCount={commitStats._count.id}
          webhookUrl={webhookUrl}
        />

        <ChangelogSection
          projectId={project.id}
          currentBranch={project.changelogBranch}
          defaultBranch={project.defaultBranch}
        />

        <ApiKeysSection projectId={projectId} initialKeys={initialKeys} />
      </div>
    </div>
  );
}
