// lib/apiKey.ts — API-Key Hilfsfunktionen

import crypto from "crypto";
import { db } from "@/lib/db";

/**
 * Gibt den SHA-256-Hash des rohen Key-Strings zurück.
 */
export function hashKey(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/**
 * Prüft ob ein roher API-Key in der Datenbank existiert.
 * Bei Erfolg wird lastUsedAt non-blocking aktualisiert und projectId zurückgegeben.
 */
export async function validateApiKey(
  raw: string
): Promise<{ valid: boolean; projectId?: string }> {
  const keyHash = hashKey(raw);

  const apiKey = await db.apiKey.findUnique({
    where: { keyHash },
    select: { id: true, projectId: true },
  });

  if (!apiKey) {
    return { valid: false };
  }

  // lastUsedAt non-blocking aktualisieren — darf nie werfen
  db.apiKey
    .update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => {});

  return { valid: true, projectId: apiKey.projectId };
}
