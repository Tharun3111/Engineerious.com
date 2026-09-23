import { createHash } from "node:crypto";

import type { ItemType } from "@/db/schema";

export type CuratedAiSourceVersionInput = {
  id: number;
  type: ItemType;
  title: string;
  url: string;
  summary: string | null;
  aiNote: string | null;
  source: string;
  sourceSlug: string;
  sourceWeight: number;
  author: string | null;
  publishedAt: Date | string | null;
  firstSeen: Date | string;
};

export type CuratedAiCurationVersionInput = {
  curatedSnapshot: unknown;
  curatedAt: Date | string | null;
  curatedBy: string | null;
};

function instant(value: Date | string | null): string | null {
  if (value === null) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid source timestamp.");
  return date.toISOString();
}

/**
 * Opaque optimistic-concurrency token for every fact the human reviewed or that
 * publication copies. Volatile ranking score is intentionally excluded.
 */
export function curatedAiSourceVersion(input: CuratedAiSourceVersionInput): string {
  const canonical = JSON.stringify([
    input.id,
    input.type,
    input.title,
    input.url,
    input.summary,
    input.aiNote,
    input.source,
    input.sourceSlug,
    input.sourceWeight,
    input.author,
    instant(input.publishedAt),
    instant(input.firstSeen),
  ]);
  return createHash("sha256").update(canonical).digest("hex");
}

/** Prevents a stale unpublish request from deleting a newer reviewed revision. */
export function curatedAiCurationVersion(input: CuratedAiCurationVersionInput): string {
  const canonical = JSON.stringify([
    input.curatedSnapshot,
    instant(input.curatedAt),
    input.curatedBy,
  ]);
  return createHash("sha256").update(canonical).digest("hex");
}
