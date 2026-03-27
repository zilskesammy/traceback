// app/(app)/projects/[id]/settings/page.tsx — Server Component
// Lädt API-Keys des Projekts (ohne keyHash) und rendert die Settings-Seite.

import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ApiKeysSection } from "@/components/settings/ApiKeysSection";

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = await params;

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
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
  });

  if (!project) notFound();

  const initialKeys = project.apiKeys.map((k) => ({
    id: k.id,
    label: k.label,
    keyPrefix: k.keyPrefix,
    lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
    createdAt: k.createdAt.toISOString(),
  }));

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-xl font-semibold text-zinc-100">
            {project.name}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">Projekteinstellungen</p>
        </div>

        {/* API Keys */}
        <ApiKeysSection projectId={projectId} initialKeys={initialKeys} />
      </div>
    </div>
  );
}
