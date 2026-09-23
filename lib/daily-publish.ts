import { sql, type SQL } from "drizzle-orm";

import {
  factualContentHash,
  myTakeContentHash,
  publishedDailyBriefSchema,
  type PublishedDailyBrief,
} from "@/lib/daily-brief";

export type DailyPublishExpectation = {
  id: number;
  expectedVersion: number;
  expectedContentHash: string;
  expectedMyTakeHash: string;
};

/**
 * One-statement Daily publication. The digest lock serializes approve/reject,
 * while the repeated predicates make PostgreSQL recheck version, review, and
 * explicit My Take confirmation after any lock wait.
 */
export function buildDailyPublishStatement(
  input: DailyPublishExpectation & {
    reviewerName: string;
    now: Date;
  },
): SQL {
  return sql`
    with eligible as materialized (
      select id, date, daily_draft, draft_version
        from digests
       where id = ${input.id}
         and status = 'pending_review'
         and draft_version = ${input.expectedVersion}
         and daily_draft is not null
         and daily_published is null
         and reviewed_content_hash = ${input.expectedContentHash}
         and my_take_confirmed_hash = ${input.expectedMyTakeHash}
         and my_take_confirmed_at is not null
         and my_take_confirmed_by is not null
         for update
    )
    update digests
       set status = 'published',
           daily_published = eligible.daily_draft,
           published_at = ${input.now},
           reviewed_by = ${input.reviewerName},
           reviewed_at = ${input.now},
           error = null,
           updated_at = ${input.now}
      from eligible
     where digests.id = eligible.id
       and digests.status = 'pending_review'
       and digests.draft_version = ${input.expectedVersion}
       and digests.daily_published is null
       and digests.reviewed_content_hash = ${input.expectedContentHash}
       and digests.my_take_confirmed_hash = ${input.expectedMyTakeHash}
       and digests.my_take_confirmed_at is not null
       and digests.my_take_confirmed_by is not null
    returning digests.id,
              digests.date,
              digests.draft_version,
              digests.daily_published
  `;
}

export type DailyPublishTerminalRow = {
  status: string;
  draftVersion: number;
  dailyPublished: unknown;
  reviewedContentHash: string | null;
  myTakeConfirmedHash: string | null;
};

export type DailyPublishTerminalResolution =
  | { outcome: "idempotent"; brief: PublishedDailyBrief }
  | { outcome: "rejected" }
  | {
      outcome: "conflict";
      reason:
        | "already_published_different_revision"
        | "invalid_published_snapshot"
        | "stale_version"
        | "content_not_reviewed"
        | "my_take_not_confirmed"
        | "not_publishable";
    };

/**
 * Resolve a zero-row publication result after re-reading the digest. A retried
 * request is successful only when the already-public terminal state is the same
 * exact reviewed revision; no other published snapshot may be overwritten.
 */
export function resolveDailyPublishTerminal(
  row: DailyPublishTerminalRow,
  expected: Omit<DailyPublishExpectation, "id">,
): DailyPublishTerminalResolution {
  if (row.status === "rejected") return { outcome: "rejected" };

  if (row.status === "published") {
    const parsed = publishedDailyBriefSchema.safeParse(row.dailyPublished);
    if (!parsed.success) return { outcome: "conflict", reason: "invalid_published_snapshot" };

    const snapshotContentHash = factualContentHash(parsed.data);
    const snapshotMyTakeHash = myTakeContentHash(parsed.data.myTake);

    if (
      row.draftVersion === expected.expectedVersion &&
      row.reviewedContentHash === expected.expectedContentHash &&
      row.myTakeConfirmedHash === expected.expectedMyTakeHash &&
      snapshotContentHash === expected.expectedContentHash &&
      snapshotMyTakeHash === expected.expectedMyTakeHash
    ) {
      return { outcome: "idempotent", brief: parsed.data };
    }
    return { outcome: "conflict", reason: "already_published_different_revision" };
  }

  if (row.draftVersion !== expected.expectedVersion) {
    return { outcome: "conflict", reason: "stale_version" };
  }
  if (row.reviewedContentHash !== expected.expectedContentHash) {
    return { outcome: "conflict", reason: "content_not_reviewed" };
  }
  if (row.myTakeConfirmedHash !== expected.expectedMyTakeHash) {
    return { outcome: "conflict", reason: "my_take_not_confirmed" };
  }
  return { outcome: "conflict", reason: "not_publishable" };
}
