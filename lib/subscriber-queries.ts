import { and, desc, isNull, sql } from "drizzle-orm";

import { subscribers } from "@/db/schema";
import { getDb, type Database } from "@/lib/db";

export type SubscriberDeliveryRecord = {
  id: number;
  email: string;
  subscribedAt: string;
  resendSyncAttemptedAt: string | null;
  resendSyncError: string | null;
};

export type SubscriberDeliveryQueue = {
  subscribers: SubscriberDeliveryRecord[];
  total: number;
  error: string | null;
};

/**
 * A captured, active address is safe to target only after Resend has returned a
 * contact id. The same predicate powers the admin repair queue and newsletter
 * send preflight so the two surfaces cannot disagree about delivery readiness.
 */
export const activeUnsyncedSubscriberPredicate = and(
  isNull(subscribers.unsubscribedAt),
  isNull(subscribers.resendContactId),
);

/**
 * Intended for the newsletter's atomic send claim. Keeping this as a SQL
 * predicate lets the claim refuse a send in the same statement that changes the
 * digest state, instead of relying only on an earlier count that could race a
 * concurrent signup.
 */
export const noActiveUnsyncedSubscribersPredicate = sql<boolean>`not exists (
  select 1
  from ${subscribers}
  where ${subscribers.unsubscribedAt} is null
    and ${subscribers.resendContactId} is null
)`;

export async function countActiveUnsyncedSubscribers(
  db: Database = getDb(),
): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(subscribers)
    .where(activeUnsyncedSubscriberPredicate);
  return row?.count ?? 0;
}

export async function getSubscriberDeliveryQueue(limit = 50): Promise<SubscriberDeliveryQueue> {
  const boundedLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  try {
    const db = getDb();
    const [rows, total] = await Promise.all([
      db
        .select({
          id: subscribers.id,
          email: subscribers.email,
          subscribedAt: subscribers.subscribedAt,
          resendSyncAttemptedAt: subscribers.resendSyncAttemptedAt,
          resendSyncError: subscribers.resendSyncError,
        })
        .from(subscribers)
        .where(activeUnsyncedSubscriberPredicate)
        .orderBy(desc(subscribers.subscribedAt))
        .limit(boundedLimit),
      countActiveUnsyncedSubscribers(db),
    ]);

    return {
      subscribers: rows.map((row) => ({
        ...row,
        subscribedAt: row.subscribedAt.toISOString(),
        resendSyncAttemptedAt: row.resendSyncAttemptedAt?.toISOString() ?? null,
      })),
      total,
      error: null,
    };
  } catch (error) {
    return {
      subscribers: [],
      total: 0,
      error: error instanceof Error ? error.message : "Subscriber delivery status is unavailable.",
    };
  }
}
