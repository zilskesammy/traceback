// lib/webhook/extractFilesFromPush.ts — Extrahiert eindeutige geänderte Dateipfade
// aus einem GitHub Push Payload (added + modified, ohne removed)

import type { GitHubPushPayload } from "@/types/github";

/**
 * Extrahiert alle hinzugefügten und geänderten Dateipfade aus einem Push-Event.
 * Removed-Dateien werden bewusst ignoriert (gelöschte Dateien sollen keine
 * Ticket-Updates auslösen).
 *
 * @returns Deduplizierte, sortierte Liste von Dateipfaden
 */
export function extractFilesFromPush(payload: GitHubPushPayload): string[] {
  const seen = new Set<string>();

  for (const commit of payload.commits) {
    for (const file of commit.added) {
      if (file) seen.add(file);
    }
    for (const file of commit.modified) {
      if (file) seen.add(file);
    }
  }

  return Array.from(seen).sort();
}

/**
 * Extrahiert den Branch-Namen aus einem Git-Ref.
 * "refs/heads/main" → "main"
 */
export function extractBranchFromRef(ref: string): string {
  return ref.replace(/^refs\/heads\//, "");
}
