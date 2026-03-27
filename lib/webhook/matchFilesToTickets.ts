// lib/webhook/matchFilesToTickets.ts — Matched geänderte Dateien gegen contextFiles
// von Features und Tasks. Schreibt diffRef + changedFiles in betroffene Tickets.

import { db } from "@/lib/db";

interface MatchResult {
  featuresMatched: number;
  tasksMatched: number;
  total: number;
}

/**
 * Vergleicht changedFiles gegen alle contextFiles-Einträge in Features + Tasks
 * des gegebenen Projekts.
 *
 * Matching-Logik (Priorität absteigend):
 *  1. Exakter Pfad-Match: changedFile === contextFile
 *  2. Präfix-Match: changedFile beginnt mit contextFile + "/" (Verzeichnis)
 *  3. Umgekehrter Präfix-Match: contextFile beginnt mit changedFile + "/"
 */
export async function matchFilesToTickets(
  projectId: string,
  commitSha: string,
  changedFiles: string[],
  changedBy: string = "github-webhook"
): Promise<MatchResult> {
  if (changedFiles.length === 0) {
    return { featuresMatched: 0, tasksMatched: 0, total: 0 };
  }

  // Features mit Tasks des Projekts laden (via Epic → Project)
  const features = await db.feature.findMany({
    where: {
      epic: {
        projectId,
      },
    },
    select: {
      id: true,
      contextFiles: true,
    },
  });

  const tasks = await db.task.findMany({
    where: {
      feature: {
        epic: {
          projectId,
        },
      },
    },
    select: {
      id: true,
      contextFiles: true,
    },
  });

  // Hilfsfunktion: Prüft ob es Überschneidung zwischen contextFiles und changedFiles gibt
  function hasMatch(contextFiles: unknown): string[] {
    const paths = parseFileList(contextFiles);
    if (paths.length === 0) return [];

    return changedFiles.filter((changed) =>
      paths.some(
        (ctx) =>
          changed === ctx ||                        // 1. Exakter Match
          changed.startsWith(ctx + "/") ||          // 2. Verzeichnis-Präfix
          ctx.startsWith(changed + "/") ||          // 3. Umgekehrter Präfix
          matchGlob(ctx, changed)                   // 4. Glob-Pattern (z.B. src/**/*.ts)
      )
    );
  }

  // Gematchte Feature IDs und ihre relevanten Dateien sammeln
  const featureUpdates: Array<{ id: string; matchedFiles: string[] }> = [];
  for (const feature of features) {
    const matched = hasMatch(feature.contextFiles);
    if (matched.length > 0) {
      featureUpdates.push({ id: feature.id, matchedFiles: matched });
    }
  }

  // Gematchte Task IDs und ihre relevanten Dateien sammeln
  const taskUpdates: Array<{ id: string; matchedFiles: string[] }> = [];
  for (const task of tasks) {
    const matched = hasMatch(task.contextFiles);
    if (matched.length > 0) {
      taskUpdates.push({ id: task.id, matchedFiles: matched });
    }
  }

  const now = new Date();

  // Features updaten (in einer Transaktion)
  if (featureUpdates.length > 0 || taskUpdates.length > 0) {
    await db.$transaction([
      ...featureUpdates.map(({ id, matchedFiles }) =>
        db.feature.update({
          where: { id },
          data: {
            diffRef: commitSha,
            changedFiles: matchedFiles,
            changedBy,
            changedAt: now,
          },
        })
      ),
      ...taskUpdates.map(({ id, matchedFiles }) =>
        db.task.update({
          where: { id },
          data: {
            diffRef: commitSha,
            changedFiles: matchedFiles,
            changedBy,
            changedAt: now,
          },
        })
      ),
    ]);
  }

  return {
    featuresMatched: featureUpdates.length,
    tasksMatched: taskUpdates.length,
    total: featureUpdates.length + taskUpdates.length,
  };
}

/**
 * Parsed ein Json?-Feld aus Prisma zu string[].
 * Gibt leeres Array zurück wenn null, kein Array oder kein string[].
 */
function parseFileList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

/**
 * Einfaches Glob-Pattern-Matching ohne externe Abhängigkeit.
 * Unterstützt:
 *  - `*`  → beliebige Zeichen außer /
 *  - `**` → beliebige Zeichen inkl. /
 *  - `?`  → ein beliebiges Zeichen außer /
 *
 * Beispiele:
 *  matchGlob("src/** /*.ts", "src/lib/auth.ts")   → true
 *  matchGlob("*.config.js", "vite.config.js")     → true
 *  matchGlob("src/components/**", "src/components/Button.tsx") → true
 */
function matchGlob(pattern: string, filePath: string): boolean {
  // Kein Glob-Zeichen → kein Glob-Match (schnellerer Pfad)
  if (!pattern.includes("*") && !pattern.includes("?")) return false;

  // Glob-Pattern in Regex umwandeln
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&") // Sonderzeichen escapen
    .replace(/\*\*/g, "§§STARSTAR§§")       // ** sichern
    .replace(/\*/g, "[^/]*")               // * → kein Slash
    .replace(/§§STARSTAR§§/g, ".*")        // ** → alles
    .replace(/\?/g, "[^/]");               // ? → ein Zeichen

  try {
    return new RegExp(`^${regexStr}$`).test(filePath);
  } catch {
    return false; // Ungültiges Pattern → kein Match
  }
}
