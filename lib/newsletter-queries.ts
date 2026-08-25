import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";

import { digests, type NewsletterStatus } from "@/db/schema";
import { publishedDailyBriefSchema } from "@/lib/daily-brief";
import { getDb } from "@/lib/db";

export type NewsletterQueueRecord = {
  id: number;
  date: string;
  publishedAt: string;
  dailyTitle: string;
  newsletterStatus: NewsletterStatus | null;
  newsletterSubject: string | null;
  emailHtml: string | null;
  newsletterVersion: number;
  newsletterApprovedAt: string | null;
  newsletterApprovedBy: string | null;
  newsletterBroadcastId: string | null;
  newsletterClaimedAt: string | null;
  newsletterError: string | null;
  emailSentAt: string | null;
};

export type NewsletterQueueResult = {
  newsletters: NewsletterQueueRecord[];
  error: string | null;
};

const selection = {
  id: digests.id,
  date: digests.date,
  status: digests.status,
  dailyPublished: digests.dailyPublished,
  publishedAt: digests.publishedAt,
  newsletterStatus: digests.newsletterStatus,
  newsletterSubject: digests.newsletterSubject,
  emailHtml: digests.emailHtml,
  newsletterVersion: digests.newsletterVersion,
  newsletterApprovedAt: digests.newsletterApprovedAt,
  newsletterApprovedBy: digests.newsletterApprovedBy,
  newsletterBroadcastId: digests.newsletterBroadcastId,
  newsletterClaimedAt: digests.newsletterClaimedAt,
  newsletterError: digests.newsletterError,
  emailSentAt: digests.emailSentAt,
};

type NewsletterQueryRow = {
  id: number;
  date: string;
  status: string;
  dailyPublished: unknown;
  publishedAt: Date | null;
  newsletterStatus: NewsletterStatus | null;
  newsletterSubject: string | null;
  emailHtml: string | null;
  newsletterVersion: number;
  newsletterApprovedAt: Date | null;
  newsletterApprovedBy: string | null;
  newsletterBroadcastId: string | null;
  newsletterClaimedAt: Date | null;
  newsletterError: string | null;
  emailSentAt: Date | null;
};

const ACTIVE_NEWSLETTER_STATUSES: NewsletterStatus[] = [
  "draft",
  "approved",
  "sending",
  "queued",
  "failed",
];

export function parseNewsletterQueueRow(row: NewsletterQueryRow): NewsletterQueueRecord | null {
  if (row.status !== "published" || !row.publishedAt) return null;
  const parsed = publishedDailyBriefSchema.safeParse(row.dailyPublished);
  if (!parsed.success || parsed.data.date !== row.date) return null;
  return {
    id: row.id,
    date: row.date,
    publishedAt: row.publishedAt.toISOString(),
    dailyTitle: parsed.data.title,
    newsletterStatus: row.newsletterStatus,
    newsletterSubject: row.newsletterSubject,
    emailHtml: row.emailHtml,
    newsletterVersion: row.newsletterVersion,
    newsletterApprovedAt: row.newsletterApprovedAt?.toISOString() ?? null,
    newsletterApprovedBy: row.newsletterApprovedBy,
    newsletterBroadcastId: row.newsletterBroadcastId,
    newsletterClaimedAt: row.newsletterClaimedAt?.toISOString() ?? null,
    newsletterError: row.newsletterError,
    emailSentAt: row.emailSentAt?.toISOString() ?? null,
  };
}

/** All actionable outbox rows plus recent published Daily candidates. */
export async function getNewsletterQueue(): Promise<NewsletterQueueResult> {
  try {
    const db = getDb();
    const [activeRows, recentRows] = await Promise.all([
      db
        .select(selection)
        .from(digests)
        .where(inArray(digests.newsletterStatus, ACTIVE_NEWSLETTER_STATUSES))
        .orderBy(desc(digests.date)),
      db
        .select(selection)
        .from(digests)
        .where(
          and(
            eq(digests.status, "published"),
            isNotNull(digests.dailyPublished),
            isNotNull(digests.publishedAt),
          ),
        )
        .orderBy(desc(digests.date))
        .limit(30),
    ]);

    const byId = new Map<number, NewsletterQueryRow>();
    for (const row of [...activeRows, ...recentRows] as NewsletterQueryRow[]) byId.set(row.id, row);
    const rows = [...byId.values()].sort((a, b) => b.date.localeCompare(a.date));
    const newsletters = rows
      .map(parseNewsletterQueueRow)
      .filter((row): row is NewsletterQueueRecord => row !== null);
    const invalidCount = rows.length - newsletters.length;
    return {
      newsletters,
      error:
        invalidCount > 0
          ? `${invalidCount} newsletter candidate${invalidCount === 1 ? "" : "s"} failed the published Daily integrity check.`
          : null,
    };
  } catch (error) {
    return {
      newsletters: [],
      error: error instanceof Error ? error.message : "The newsletter queue is unavailable.",
    };
  }
}
