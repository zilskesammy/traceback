import { db } from "@/lib/db";
import type { LinkType } from "@prisma/client";

export interface CreateLinkedPRInput {
  featureId: string;
  url: string;
  type?: LinkType;
  title?: string;
}

export async function createLinkedPR(input: CreateLinkedPRInput) {
  return db.linkedPR.create({
    data: {
      featureId: input.featureId,
      url: input.url,
      type: input.type ?? "PR",
      title: input.title ?? null,
    },
  });
}

export async function getLinkedPRs(featureId: string) {
  return db.linkedPR.findMany({
    where: { featureId },
    orderBy: { createdAt: "asc" },
  });
}
