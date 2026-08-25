import { and, desc, eq, isNotNull } from "drizzle-orm";
import { unstable_cache } from "next/cache";

import { digests } from "@/db/schema";
import { getDb, shouldFailOnDatabaseError } from "@/lib/db";
import {
  dailyDateSchema,
  publishedDailyBriefSchema,
  type PublishedDailyBrief,
} from "@/lib/daily-brief";

export const DAILY_BRIEF_CACHE_TAG = "daily-briefs";
const DAILY_BRIEF_CACHE_SECONDS = 300;

export type PublicDailyBrief = {
  digestId: number;
  date: string;
  publishedAt: Date;
  brief: PublishedDailyBrief;
};

export type PublicDailyRow = {
  digestId: number;
  date: string;
  status: string;
  publishedAt: Date | string | null;
  dailyPublished: unknown;
};

export type DailyBriefQueryResult = {
  brief: PublicDailyBrief | null;
  error: string | null;
};

export type DailyBriefArchiveResult = {
  briefs: PublicDailyBrief[];
  error: string | null;
};

/** Thin/empty archives stay out of search until the first useful snapshot exists. */
export function publicDailyRobots(hasPublishedSnapshot: boolean): {
  index: boolean;
  follow: boolean;
} {
  return { index: hasPublishedSnapshot, follow: true };
}

export function publicDailyVisibilityPredicate() {
  return and(
    eq(digests.status, "published"),
    isNotNull(digests.dailyPublished),
    isNotNull(digests.publishedAt),
  )!;
}

function describe(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  console.error("[daily-queries]", message);
  return message;
}

/**
 * The public integrity boundary. A row must be terminally published, have a
 * publication timestamp, contain valid v1 JSON, and agree with the row's date.
 */
export function parsePublicDailyRow(row: PublicDailyRow): PublicDailyBrief | null {
  if (row.status !== "published" || !row.publishedAt) return null;
  const parsed = publishedDailyBriefSchema.safeParse(row.dailyPublished);
  if (!parsed.success || parsed.data.date !== row.date) return null;

  const publishedAt = row.publishedAt instanceof Date ? row.publishedAt : new Date(row.publishedAt);
  if (Number.isNaN(publishedAt.getTime())) return null;

  return {
    digestId: row.digestId,
    date: row.date,
    publishedAt,
    brief: parsed.data,
  };
}

async function queryPublishedRows(input: { date?: string; limit: number }): Promise<PublicDailyRow[]> {
  const conditions = [publicDailyVisibilityPredicate()];
  if (input.date) conditions.push(eq(digests.date, input.date));

  return getDb()
    .select({
      digestId: digests.id,
      date: digests.date,
      status: digests.status,
      publishedAt: digests.publishedAt,
      dailyPublished: digests.dailyPublished,
    })
    .from(digests)
    .where(and(...conditions))
    .orderBy(desc(digests.date))
    .limit(input.limit);
}

function decodeRows(rows: PublicDailyRow[]): {
  briefs: PublicDailyBrief[];
  invalidCount: number;
} {
  const briefs: PublicDailyBrief[] = [];
  let invalidCount = 0;
  for (const row of rows) {
    const parsed = parsePublicDailyRow(row);
    if (parsed) briefs.push(parsed);
    else invalidCount += 1;
  }
  return { briefs, invalidCount };
}

function invalidSnapshotMessage(count: number): string | null {
  if (count === 0) return null;
  const message = `${count} published Daily Brief snapshot${count === 1 ? "" : "s"} failed validation`;
  console.error(`[daily-queries] ${message}`);
  return message;
}

export async function getLatestDailyBrief(): Promise<DailyBriefQueryResult> {
  try {
    // Read past one malformed newest row so corruption fails closed without
    // hiding the last valid publication from readers.
    const rows = await unstable_cache(() => queryPublishedRows({ limit: 20 }), ["daily", "latest"], {
      revalidate: DAILY_BRIEF_CACHE_SECONDS,
      tags: [DAILY_BRIEF_CACHE_TAG],
    })();
    const decoded = decodeRows(rows);
    return {
      brief: decoded.briefs[0] ?? null,
      error: invalidSnapshotMessage(decoded.invalidCount),
    };
  } catch (error) {
    if (shouldFailOnDatabaseError()) throw error;
    return { brief: null, error: describe(error) };
  }
}

export async function getDailyBriefByDate(date: string): Promise<DailyBriefQueryResult> {
  if (!dailyDateSchema.safeParse(date).success) return { brief: null, error: null };

  try {
    const rows = await unstable_cache(
      () => queryPublishedRows({ date, limit: 1 }),
      ["daily", "date", date],
      { revalidate: DAILY_BRIEF_CACHE_SECONDS, tags: [DAILY_BRIEF_CACHE_TAG] },
    )();
    const decoded = decodeRows(rows);
    return {
      brief: decoded.briefs[0] ?? null,
      error: invalidSnapshotMessage(decoded.invalidCount),
    };
  } catch (error) {
    if (shouldFailOnDatabaseError()) throw error;
    return { brief: null, error: describe(error) };
  }
}

export async function getDailyBriefArchive(limit = 30): Promise<DailyBriefArchiveResult> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
  try {
    const rows = await unstable_cache(
      () => queryPublishedRows({ limit: safeLimit }),
      ["daily", "archive", String(safeLimit)],
      { revalidate: DAILY_BRIEF_CACHE_SECONDS, tags: [DAILY_BRIEF_CACHE_TAG] },
    )();
    const decoded = decodeRows(rows);
    return {
      briefs: decoded.briefs,
      error: invalidSnapshotMessage(decoded.invalidCount),
    };
  } catch (error) {
    if (shouldFailOnDatabaseError()) throw error;
    return { briefs: [], error: describe(error) };
  }
}
