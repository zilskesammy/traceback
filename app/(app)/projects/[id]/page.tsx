// app/(app)/projects/[id]/page.tsx — Server Component
// Loads project + ChangelogFeatures (with entry count), renders ProjectLayout

import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { ProjectLayout } from "@/components/changelog/ProjectLayout";
import type { UIProject, UIChangelogFeature } from "@/types/changelog";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const project = await db.project.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      repoOwner: true,
      repoName: true,
      defaultBranch: true,
    },
  });

  if (!project) notFound();

  const rawFeatures = await db.changelogFeature.findMany({
    where: { projectId: id },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { entries: true } },
      entries: {
        orderBy: { timestamp: "asc" },
        include: { codeChanges: { orderBy: { file: "asc" } } },
      },
    },
  });

  const uiProject: UIProject = {
    id: project.id,
    name: project.name,
    repoOwner: project.repoOwner,
    repoName: project.repoName,
    defaultBranch: project.defaultBranch,
  };

  const features: UIChangelogFeature[] = rawFeatures.map((f) => ({
    id: f.id,
    projectId: f.projectId,
    parentId: f.parentId,
    type: f.type,
    status: f.status,
    priority: f.priority,
    title: f.title,
    summary: f.summary,
    businessContext: f.businessContext,
    rootCause: f.rootCause,
    impact: f.impact,
    resolution: f.resolution,
    regressionRisk: f.regressionRisk,
    affectedComponents: f.affectedComponents,
    affectedUsers: f.affectedUsers,
    acceptanceCriteria: f.acceptanceCriteria,
    tags: f.tags,
    source: f.source,
    sourceFile: f.sourceFile,
    createdAt: f.createdAt.toISOString(),
    updatedAt: f.updatedAt.toISOString(),
    entries: f.entries.map((e) => ({
      id: e.id,
      featureId: e.featureId,
      timestamp: e.timestamp.toISOString(),
      agentType: e.agentType,
      agentName: e.agentName,
      action: e.action,
      summary: e.summary,
      what: e.what,
      why: e.why,
      technicalDetails: e.technicalDetails,
      sideEffects: e.sideEffects,
      dependencies: e.dependencies,
      relatedEntryIds: e.relatedEntryIds,
      linesAdded: e.linesAdded,
      linesRemoved: e.linesRemoved,
      createdAt: e.createdAt.toISOString(),
      codeChanges: e.codeChanges.map((cc) => ({
        id: cc.id,
        entryId: cc.entryId,
        file: cc.file,
        changeType: cc.changeType,
        linesAdded: cc.linesAdded,
        linesRemoved: cc.linesRemoved,
        diffSummary: cc.diffSummary,
      })),
    })),
    _entryCount: f._count.entries,
  }));

  const session = await auth();

  return (
    <ProjectLayout
      project={uiProject}
      initialFeatures={features}
      userName={session?.user?.name ?? null}
      userEmail={session?.user?.email ?? null}
    />
  );
}
