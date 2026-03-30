import { db } from "@/lib/db";
import type { LinkType } from "@prisma/client";

export interface CreateLinkedPRInput {
  ticketId: string;
  url: string;
  type?: LinkType;
  title?: string;
}

export async function createLinkedPR(input: CreateLinkedPRInput) {
  return db.linkedPR.create({
    data: {
      ticketId: input.ticketId,
      url: input.url,
      type: input.type ?? "PR",
      title: input.title ?? null,
    },
  });
}

export async function getLinkedPRs(ticketId: string) {
  return db.linkedPR.findMany({
    where: { ticketId },
    orderBy: { createdAt: "asc" },
  });
}
