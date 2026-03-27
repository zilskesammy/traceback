// lib/api/auth-middleware.ts — Auth resolution for API routes
// Supports both API key (Bearer tb_xxx) and NextAuth session auth.

import crypto from "crypto";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export interface ApiAuthResult {
  userId: string;
  projectId: string;
}

/**
 * Resolves auth for an incoming API request.
 *
 * Strategy:
 * 1. Check Authorization: Bearer <key> header → SHA-256 hash → look up ApiKey row
 * 2. Fall back to NextAuth session via auth()
 *
 * Returns { userId, projectId } on success, or null if unauthenticated.
 *
 * Note: when using session auth the projectId is taken from the URL params
 * (the `projectId` argument). Pass the project id extracted from the route
 * so that membership can be verified by the caller.
 */
export async function resolveAuth(
  request: NextRequest,
  projectId?: string
): Promise<ApiAuthResult | null> {
  // ── 1. API Key ────────────────────────────────────────────────────────────
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const rawKey = authHeader.slice(7).trim();
    if (rawKey) {
      const keyHash = crypto
        .createHash("sha256")
        .update(rawKey)
        .digest("hex");

      const apiKey = await db.apiKey.findUnique({
        where: { keyHash },
        select: { id: true, userId: true, projectId: true },
      });

      if (apiKey) {
        // Update lastUsedAt non-blocking — never throw
        db.apiKey
          .update({
            where: { id: apiKey.id },
            data: { lastUsedAt: new Date() },
          })
          .catch(() => {});

        return { userId: apiKey.userId, projectId: apiKey.projectId };
      }
    }
  }

  // ── 2. NextAuth session ───────────────────────────────────────────────────
  const session = await auth();
  if (session?.user?.id && projectId) {
    return { userId: session.user.id, projectId };
  }

  return null;
}
