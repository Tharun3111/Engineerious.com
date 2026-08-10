import type { ItemType } from "@/db/schema";

/** Normalised shape every adapter must emit. Persistence/dedupe happens in lib/ingest.ts. */
export type RawItem = {
  type: ItemType;
  title: string;
  url: string;
  summary?: string | null;
  /** Human-readable source name shown in the row, e.g. "Anthropic" or "github.com". */
  source: string;
  sourceSlug: string;
  sourceWeight: number;
  author?: string | null;
  /** Real votes/stars/downloads where a source has them; 0 otherwise. */
  points?: number;
  publishedAt?: Date | null;
  raw?: unknown;
};

export interface IngestAdapter {
  /** Stable identifier, used in logs and the `sources` table. */
  slug: string;
  name: string;
  type: ItemType;
  /** Set false for adapters whose credentials are missing — the runner skips them. */
  enabled(): boolean;
  fetch(): Promise<RawItem[]>;
}

export type AdapterResult = {
  slug: string;
  ok: boolean;
  fetched: number;
  inserted?: number;
  updated?: number;
  skipped?: string;
  error?: string;
};
