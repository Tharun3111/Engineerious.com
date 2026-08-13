import { and, desc, eq, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";

import { digests, items, repurposeJobs, submissions, type Item, type ItemType } from "@/db/schema";
import { getDb } from "@/lib/db";

export type FeedSort = "hot" | "new";

export type FeedQuery = {
  type?: ItemType;
  sort?: FeedSort;
  limit?: number;
  offset?: number;
};

export type FeedResult = {
  items: Item[];
  /** Set when the database is unreachable/unconfigured, so pages can say why. */
  error: string | null;
};

function describe(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  console.error("[queries]", message);
  return message;
}

export const FEED_CACHE_TAG = "feed";
/** Matches the /api/cron/rank cadence — a shorter TTL just re-reads identical rows. */
const FEED_CACHE_SECONDS = 300;

type ResolvedFeedQuery = {
  type?: ItemType;
  sort: FeedSort;
  limit: number;
  offset: number;
};

async function queryFeed({ type, sort, limit, offset }: ResolvedFeedQuery): Promise<Item[]> {
  const db = getDb();
  const where = type
    ? and(eq(items.status, "approved"), eq(items.type, type))
    : eq(items.status, "approved");

  return db
    .select()
    .from(items)
    .where(where)
    .orderBy(
      sort === "new"
        ? desc(sql`coalesce(${items.publishedAt}, ${items.firstSeen})`)
        : desc(items.score),
    )
    .limit(Math.min(limit, 200))
    .offset(offset);
}

/**
 * The cache layer serialises through JSON, which turns timestamps into strings.
 * Revive them so callers can rely on `Item` actually holding Dates — rss.xml sorts on
 * `.getTime()` and would silently break otherwise.
 */
function reviveDates(rows: Item[]): Item[] {
  return rows.map((row) => ({
    ...row,
    firstSeen: new Date(row.firstSeen),
    publishedAt: row.publishedAt ? new Date(row.publishedAt) : null,
    rankedAt: row.rankedAt ? new Date(row.rankedAt) : null,
  }));
}

/**
 * Feed read. Never throws: a missing DATABASE_URL or a cold Neon branch must render
 * an explicit "feed unavailable" row rather than a 500 — /qa asserts on the
 * difference between "empty because unconfigured" and "empty because broken".
 *
 * Cached for 5 minutes per (type, sort, limit, offset). Feed pages take `sort` and
 * `page` from the query string, which makes them dynamically rendered, so without
 * this every request would be a database round trip for rows that only change when
 * the ingest and rank crons run.
 */
export async function getFeed({
  type,
  sort = "hot",
  limit = 50,
  offset = 0,
}: FeedQuery = {}): Promise<FeedResult> {
  const key = ["feed", type ?? "all", sort, String(limit), String(offset)];

  try {
    const rows = await unstable_cache(() => queryFeed({ type, sort, limit, offset }), key, {
      revalidate: FEED_CACHE_SECONDS,
      tags: [FEED_CACHE_TAG],
    })();

    return { items: reviveDates(rows), error: null };
  } catch (error) {
    return { items: [], error: describe(error) };
  }
}

export async function getItem(id: number): Promise<Item | null> {
  try {
    const rows = await getDb().select().from(items).where(eq(items.id, id)).limit(1);
    return rows[0] ?? null;
  } catch (error) {
    describe(error);
    return null;
  }
}

export async function getPendingItems(limit = 100) {
  try {
    const rows = await getDb()
      .select()
      .from(items)
      .where(eq(items.status, "pending"))
      .orderBy(desc(items.firstSeen))
      .limit(limit);
    return { items: rows, error: null };
  } catch (error) {
    return { items: [], error: describe(error) };
  }
}

export async function getRepurposeQueue(limit = 100) {
  try {
    const rows = await getDb()
      .select()
      .from(repurposeJobs)
      .orderBy(desc(repurposeJobs.createdAt))
      .limit(limit);
    return { jobs: rows, error: null };
  } catch (error) {
    return { jobs: [], error: describe(error) };
  }
}

export async function getPendingDigests(limit = 30) {
  try {
    const rows = await getDb()
      .select()
      .from(digests)
      .where(eq(digests.status, "pending_review"))
      .orderBy(desc(digests.date))
      .limit(limit);
    return { digests: rows, error: null };
  } catch (error) {
    return { digests: [], error: describe(error) };
  }
}

export async function getSubmissions(limit = 100) {
  try {
    const rows = await getDb()
      .select()
      .from(submissions)
      .where(eq(submissions.status, "pending"))
      .orderBy(desc(submissions.createdAt))
      .limit(limit);
    return { submissions: rows, error: null };
  } catch (error) {
    return { submissions: [], error: describe(error) };
  }
}

export async function getFeedCounts(): Promise<Record<ItemType, number>> {
  const empty = { news: 0, model: 0, oss: 0 } satisfies Record<ItemType, number>;
  try {
    const rows = await getDb()
      .select({ type: items.type, count: sql<number>`count(*)::int` })
      .from(items)
      .where(eq(items.status, "approved"))
      .groupBy(items.type);
    return rows.reduce((acc, row) => ({ ...acc, [row.type]: row.count }), empty);
  } catch (error) {
    describe(error);
    return empty;
  }
}
