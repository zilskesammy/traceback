// lib/db/changelog.ts — DB operations for ChangelogFeature, ChangelogEntry, CodeChange

import { db } from "@/lib/db";
import type { ParsedFeature } from "@/lib/changelog/parser";
import type { ChangelogItemType, ChangelogStatus, ChangelogPriority } from "@/types/changelog";

// ─── UPSERT ──────────────────────────────────────────────────────────────────

export async function upsertChangelogFeature(
  projectId: string,
  feature: ParsedFeature
): Promise<void> {
  // 1. Upsert feature
  await db.changelogFeature.upsert({
    where: { id: feature.id },
    create: {
      id: feature.id,
      projectId,
      type: feature.type,
      status: feature.status,
      priority: feature.priority,
      title: feature.title,
      summary: feature.summary,
      businessContext: feature.businessContext,
      rootCause: feature.rootCause,
      impact: feature.impact,
      resolution: feature.resolution,
      regressionRisk: feature.regressionRisk,
      affectedComponents: feature.affectedComponents,
      affectedUsers: feature.affectedUsers,
      acceptanceCriteria: feature.acceptanceCriteria,
      tags: feature.tags,
      source: "CHANGELOG",
      sourceFile: feature.sourceFile,
    },
    update: {
      status: feature.status,
      priority: feature.priority,
      title: feature.title,
      summary: feature.summary,
      businessContext: feature.businessContext,
      rootCause: feature.rootCause,
      impact: feature.impact,
      resolution: feature.resolution,
      regressionRisk: feature.regressionRisk,
      affectedComponents: feature.affectedComponents,
      affectedUsers: feature.affectedUsers,
      acceptanceCriteria: feature.acceptanceCriteria,
      tags: feature.tags,
      sourceFile: feature.sourceFile,
    },
  });

  // 2. Upsert entries
  for (const entry of feature.entries) {
    await db.changelogEntry.upsert({
      where: { id: entry.id },
      create: {
        id: entry.id,
        featureId: feature.id,
        timestamp: entry.timestamp,
        agentType: entry.agentType,
        agentName: entry.agentName,
        action: entry.action,
        summary: entry.summary,
        what: entry.what,
        why: entry.why,
        technicalDetails: entry.technicalDetails,
        sideEffects: entry.sideEffects,
        dependencies: entry.dependencies,
        relatedEntryIds: entry.relatedEntryIds,
        linesAdded: entry.linesAdded,
        linesRemoved: entry.linesRemoved,
      },
      update: {
        agentType: entry.agentType,
        agentName: entry.agentName,
        action: entry.action,
        summary: entry.summary,
        what: entry.what,
        why: entry.why,
        technicalDetails: entry.technicalDetails,
        sideEffects: entry.sideEffects,
        dependencies: entry.dependencies,
        relatedEntryIds: entry.relatedEntryIds,
        linesAdded: entry.linesAdded,
        linesRemoved: entry.linesRemoved,
      },
    });

    // 3. CodeChanges: delete + recreate (no stable PK per change)
    if (entry.codeChanges.length > 0) {
      await db.codeChange.deleteMany({ where: { entryId: entry.id } });
      await db.codeChange.createMany({
        data: entry.codeChanges.map((cc) => ({
          entryId: entry.id,
          file: cc.file,
          changeType: cc.changeType,
          linesAdded: cc.linesAdded,
          linesRemoved: cc.linesRemoved,
          diffSummary: cc.diffSummary,
        })),
      });
    }
  }
}

// ─── READ ─────────────────────────────────────────────────────────────────────

export async function listChangelogFeatures(
  projectId: string,
  opts?: {
    type?: ChangelogItemType;
    status?: ChangelogStatus;
    priority?: ChangelogPriority;
    tags?: string[];
    limit?: number;
    offset?: number;
  }
) {
  return db.changelogFeature.findMany({
    where: {
      projectId,
      ...(opts?.type ? { type: opts.type } : {}),
      ...(opts?.status ? { status: opts.status } : {}),
      ...(opts?.priority ? { priority: opts.priority } : {}),
      ...(opts?.tags?.length ? { tags: { hasSome: opts.tags } } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: opts?.limit ?? 50,
    skip: opts?.offset ?? 0,
    include: {
      _count: { select: { entries: true } },
    },
  });
}

export async function getChangelogFeature(featureId: string) {
  return db.changelogFeature.findUnique({
    where: { id: featureId },
    include: {
      entries: {
        orderBy: { timestamp: "asc" },
        include: { codeChanges: { orderBy: { file: "asc" } } },
      },
    },
  });
}
