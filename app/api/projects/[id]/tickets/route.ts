// app/api/projects/[id]/tickets/route.ts
// GET /api/projects/:id/tickets
// Returns the full project tree (epics → features → tasks) as YAML.
// Auth: API key ONLY (no session fallback).

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { serializeProjectToYaml } from "@/lib/api/yaml";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  // ── API key auth only ─────────────────────────────────────────────────────
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const rawKey = authHeader.slice(7).trim();
  if (!rawKey) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

  const apiKey = await db.apiKey.findUnique({
    where: { keyHash },
    select: { id: true, userId: true, projectId: true },
  });

  if (!apiKey) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // The API key must be scoped to this project
  if (apiKey.projectId !== projectId) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Update lastUsedAt non-blocking
  db.apiKey
    .update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => {});

  // ── Fetch project + full tree ─────────────────────────────────────────────
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      epics: {
        orderBy: { order: "asc" },
        include: {
          features: {
            orderBy: { order: "asc" },
            include: {
              tasks: {
                orderBy: { order: "asc" },
              },
            },
          },
        },
      },
    },
  });

  if (!project) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const yamlString = serializeProjectToYaml(project);

  return new NextResponse(yamlString, {
    status: 200,
    headers: {
      "Content-Type": "text/yaml; charset=utf-8",
    },
  });
}
