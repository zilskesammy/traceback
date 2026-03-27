// app/api/keys/route.ts
// POST   /api/keys  — neuen API-Key erstellen (erfordert NextAuth Session)
// DELETE /api/keys  — API-Key löschen       (erfordert NextAuth Session)

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hashKey } from "@/lib/apiKey";

// ─── Hilfsfunktion: Ownership prüfen ─────────────────────────────────────────

async function assertProjectMember(
  userId: string,
  projectId: string
): Promise<boolean> {
  const member = await db.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { id: true },
  });
  return !!member;
}

// ─── POST — Key erstellen ─────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { projectId, label } = body as {
    projectId?: unknown;
    label?: unknown;
  };

  if (!projectId || typeof projectId !== "string") {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }
  if (!label || typeof label !== "string" || label.trim() === "") {
    return NextResponse.json({ error: "label is required" }, { status: 400 });
  }

  const isMember = await assertProjectMember(userId, projectId);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // rawKey wird dem User einmalig angezeigt — nur der Hash wird gespeichert
  const rawKey = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
  const keyHash = hashKey(rawKey);
  const keyPrefix = rawKey.slice(0, 8);

  const apiKey = await db.apiKey.create({
    data: {
      userId,
      projectId,
      label: label.trim(),
      keyHash,
      keyPrefix,
    },
    select: { id: true, label: true },
  });

  return NextResponse.json(
    { id: apiKey.id, label: apiKey.label, rawKey },
    { status: 201 }
  );
}

// ─── DELETE — Key löschen ─────────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { keyId } = body as { keyId?: unknown };

  if (!keyId || typeof keyId !== "string") {
    return NextResponse.json({ error: "keyId is required" }, { status: 400 });
  }

  const apiKey = await db.apiKey.findUnique({
    where: { id: keyId },
    select: { id: true, userId: true },
  });

  if (!apiKey) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  // Nur der Besitzer darf löschen
  if (apiKey.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.apiKey.delete({ where: { id: keyId } });

  return NextResponse.json({ success: true });
}
