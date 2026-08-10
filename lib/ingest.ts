import { sql } from "drizzle-orm";

import { items, sources, type NewItem } from "@/db/schema";
import { getDb } from "@/lib/db";
import { urlHash } from "@/lib/dedupe";
import { env } from "@/lib/env";
import { computeScore } from "@/lib/ranking";
import type { AdapterResult, IngestAdapter, RawItem } from "@/lib/adapters/types";

const CHUNK_SIZE = 100;

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

function toRow(raw: RawItem, now: Date): NewItem {
  const publishedAt = raw.publishedAt ?? null;
  const points = raw.points ?? 0;

  return {
    type: raw.type,
    status: env.requireIngestApproval ? "pending" : "approved",
    title: raw.title.slice(0, 500),
    url: raw.url,
    urlHash: urlHash(raw.url),
    summary: raw.summary ?? null,
    source: raw.source,
    sourceSlug: raw.sourceSlug,
    sourceWeight: raw.sourceWeight,
    author: raw.author ?? null,
    points,
    score: computeScore(
      { points, sourceWeight: raw.sourceWeight, publishedAt, firstSeen: now },
      now,
    ),
    firstSeen: now,
    publishedAt,
    rankedAt: now,
    rawJson: (raw.raw ?? null) as NewItem["rawJson"],
  };
}

/**
 * Upsert on `url_hash`. Two rules that matter:
 *   - `first_seen` is never overwritten — it is what stops a re-ingested item from
 *     resurfacing on the front page as if it were new.
 *   - `points` takes the max, because sources like HN only ever count upward and a
 *     later fetch can transiently return a lower value.
 */
async function upsert(rows: NewItem[]): Promise<number> {
  if (rows.length === 0) return 0;
  const db = getDb();
  let written = 0;

  for (const batch of chunk(rows, CHUNK_SIZE)) {
    const result = await db
      .insert(items)
      .values(batch)
      .onConflictDoUpdate({
        target: items.urlHash,
        set: {
          title: sql`excluded.title`,
          summary: sql`coalesce(excluded.summary, ${items.summary})`,
          points: sql`greatest(${items.points}, excluded.points)`,
          publishedAt: sql`coalesce(${items.publishedAt}, excluded.published_at)`,
          rawJson: sql`excluded.raw_json`,
        },
      })
      .returning({ id: items.id });
    written += result.length;
  }

  return written;
}

async function recordSource(adapter: IngestAdapter, error: string | null) {
  try {
    await getDb()
      .insert(sources)
      .values({
        slug: adapter.slug,
        name: adapter.name,
        type: adapter.type,
        adapter: adapter.slug,
        enabled: adapter.enabled(),
        lastFetchedAt: new Date(),
        lastError: error,
      })
      .onConflictDoUpdate({
        target: sources.slug,
        set: {
          name: adapter.name,
          enabled: adapter.enabled(),
          lastFetchedAt: new Date(),
          lastError: error,
        },
      });
  } catch (bookkeepingError) {
    // Source bookkeeping is diagnostics; never let it fail an ingest run.
    console.warn(`[ingest] could not record source ${adapter.slug}:`, bookkeepingError);
  }
}

/**
 * Run a set of adapters. Every adapter is isolated: one dead feed produces one failed
 * AdapterResult and the rest of the run continues. The cron route returns the full
 * result array so failures are visible in the Vercel log without digging.
 */
export async function runIngest(adapters: IngestAdapter[]): Promise<AdapterResult[]> {
  const now = new Date();

  return Promise.all(
    adapters.map(async (adapter): Promise<AdapterResult> => {
      if (!adapter.enabled()) {
        return { slug: adapter.slug, ok: true, fetched: 0, skipped: "not configured" };
      }

      try {
        const raw = await adapter.fetch();
        const rows = dedupeWithinBatch(raw.map((item) => toRow(item, now)));
        const written = await upsert(rows);
        await recordSource(adapter, null);
        return { slug: adapter.slug, ok: true, fetched: raw.length, inserted: written };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[ingest] ${adapter.slug} failed:`, message);
        await recordSource(adapter, message);
        return { slug: adapter.slug, ok: false, fetched: 0, error: message };
      }
    }),
  );
}

/**
 * Postgres rejects an INSERT ... ON CONFLICT whose own VALUES list contains the
 * conflict key twice ("cannot affect row a second time"), and feeds do repeat links
 * within a single response. Collapse in memory first, keeping the higher-weight copy.
 */
function dedupeWithinBatch(rows: NewItem[]): NewItem[] {
  const byHash = new Map<string, NewItem>();
  for (const row of rows) {
    const existing = byHash.get(row.urlHash);
    if (!existing || (row.sourceWeight ?? 0) > (existing.sourceWeight ?? 0)) {
      byHash.set(row.urlHash, row);
    }
  }
  return [...byHash.values()];
}

export function summarise(results: AdapterResult[]) {
  return {
    adapters: results.length,
    ok: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    fetched: results.reduce((n, r) => n + r.fetched, 0),
    written: results.reduce((n, r) => n + (r.inserted ?? 0), 0),
    results,
  };
}
