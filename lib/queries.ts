import { and, desc, eq, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";

import { digests, items, repurposeJobs, submissions, type Item, type ItemType } from "@/db/schema";
import { getDb } from "@/lib/db";
import { isPublicItemType } from "@/lib/public-launch";
import { toChicagoDate } from "@/lib/time";

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
  const enabledValue = process.env.PUBLIC_RESEARCH_ENABLED;
  if (type ? !isPublicItemType(type, enabledValue) : !isPublicItemType("oss", enabledValue)) {
    return [];
  }

  const db = getDb();
  // The unfiltered public feed is still restricted to the currently launchable
  // item type. `status=approved` alone is not a public visibility contract.
  const where = and(eq(items.status, "approved"), eq(items.type, type ?? "oss"));

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
  const gate = process.env.PUBLIC_RESEARCH_ENABLED === "true" ? "open" : "closed";
  const key = ["feed", gate, type ?? "all", sort, String(limit), String(offset)];

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
  if (!isPublicItemType("oss", process.env.PUBLIC_RESEARCH_ENABLED)) return null;

  try {
    const rows = await getDb()
      .select()
      .from(items)
      .where(and(eq(items.id, id), eq(items.status, "approved"), eq(items.type, "oss")))
      .limit(1);
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
  if (!isPublicItemType("oss", process.env.PUBLIC_RESEARCH_ENABLED)) return empty;

  try {
    const rows = await getDb()
      .select({ type: items.type, count: sql<number>`count(*)::int` })
      .from(items)
      .where(and(eq(items.status, "approved"), eq(items.type, "oss")))
      .groupBy(items.type);
    return rows.reduce((acc, row) => ({ ...acc, [row.type]: row.count }), empty);
  } catch (error) {
    describe(error);
    return empty;
  }
}

/**
 * Every Chicago calendar date that has at least one publicly visible item — powers
 * the archive calendar's "which days are lit up" highlighting. A route gate is not
 * sufficient here: closed item types must not make an otherwise-empty date public.
 */
export async function getActiveDates(): Promise<Set<string>> {
  if (!isPublicItemType("oss", process.env.PUBLIC_RESEARCH_ENABLED)) return new Set();

  try {
    const rows = await getDb()
      .select({ publishedAt: items.publishedAt, firstSeen: items.firstSeen })
      .from(items)
      .where(and(eq(items.status, "approved"), eq(items.type, "oss")));
    return new Set(rows.map((r) => toChicagoDate(r.publishedAt ?? r.firstSeen)));
  } catch (error) {
    describe(error);
    return new Set();
  }
}

/**
 * Publicly visible items whose Chicago calendar date matches — the archive day
 * view's "what shipped this day" query, alongside that day's blog post(s).
 *
 * items has no plain date column, only timestamptz. Bounding the SQL query to a
 * generous UTC window first (cheap, sargable against items_published_idx) then
 * filtering to the exact Chicago day in JS via toChicagoDate — the same function
 * todayChicago() uses — means this can never disagree with "today" at a DST
 * boundary the way a hand-rolled UTC-offset calculation could.
 */
export async function getItemsForDate(date: string): Promise<FeedResult> {
  if (!isPublicItemType("oss", process.env.PUBLIC_RESEARCH_ENABLED)) {
    return { items: [], error: null };
  }

  try {
    const start = new Date(`${date}T00:00:00.000Z`);
    start.setUTCDate(start.getUTCDate() - 1);
    const end = new Date(`${date}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + 2);

    const rows = await getDb()
      .select()
      .from(items)
      .where(
        and(
          eq(items.status, "approved"),
          eq(items.type, "oss"),
          sql`coalesce(${items.publishedAt}, ${items.firstSeen}) >= ${start}`,
          sql`coalesce(${items.publishedAt}, ${items.firstSeen}) < ${end}`,
        ),
      )
      .orderBy(desc(items.score));

    const dayItems = reviveDates(rows).filter((item) => toChicagoDate(item.publishedAt ?? item.firstSeen) === date);
    return { items: dayItems, error: null };
  } catch (error) {
    return { items: [], error: describe(error) };
  }
}
