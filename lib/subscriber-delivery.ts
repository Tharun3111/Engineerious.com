import { and, eq, isNull } from "drizzle-orm";

import { subscribers } from "@/db/schema";
import { getDb, type Database } from "@/lib/db";
import { upsertContact } from "@/lib/resend";

const PROVIDER_ERROR_LIMIT = 500;

const subscriberSelection = {
  id: subscribers.id,
  email: subscribers.email,
  resendContactId: subscribers.resendContactId,
  unsubscribedAt: subscribers.unsubscribedAt,
};

export type CapturedSubscriber = {
  id: number;
  email: string;
  resendContactId: string | null;
  unsubscribedAt: Date | null;
};

export type SubscriberSyncResult = {
  outcome: "ready" | "pending" | "missing" | "inactive";
  error?: string;
};

function describeProviderError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, PROVIDER_ERROR_LIMIT);
}

/**
 * Capture first, then attempt provider work. Postgres is the durable signup and
 * sync ledger; Resend remains authoritative for provider-side unsubscribe state.
 * A duplicate public request must not reactivate or otherwise change an existing
 * subscription without a future email-ownership confirmation flow.
 */
export async function captureSubscriber(
  email: string,
  db: Database = getDb(),
): Promise<CapturedSubscriber> {
  const [captured] = await db
    .insert(subscribers)
    .values({ email })
    .onConflictDoUpdate({
      target: subscribers.email,
      // A no-op update gives both new and existing canonical rows the same
      // RETURNING path without changing consent or exposing which case occurred.
      set: { email },
    })
    .returning(subscriberSelection);
  if (!captured) throw new Error("The subscriber row was not stored.");
  return captured;
}

export async function syncCapturedSubscriber(
  subscriber: CapturedSubscriber,
  db: Database = getDb(),
): Promise<SubscriberSyncResult> {
  if (subscriber.unsubscribedAt) return { outcome: "inactive" };
  // A non-null ID proves this address was already synchronized. Never call the
  // provider from an unauthenticated duplicate form submission: doing so could
  // reveal or override provider-side unsubscribe state.
  if (subscriber.resendContactId) return { outcome: "ready" };

  let contactId: string;
  try {
    contactId = await upsertContact(subscriber.email);
  } catch (error) {
    const message = describeProviderError(error);
    await db
      .update(subscribers)
      .set({ resendSyncAttemptedAt: new Date(), resendSyncError: message })
      .where(and(eq(subscribers.id, subscriber.id), isNull(subscribers.unsubscribedAt)));
    return {
      outcome: "pending",
      error: message,
    };
  }

  const [synced] = await db
    .update(subscribers)
    .set({
      resendContactId: contactId,
      resendSyncAttemptedAt: new Date(),
      resendSyncError: null,
    })
    .where(and(eq(subscribers.id, subscriber.id), isNull(subscribers.unsubscribedAt)))
    .returning({ id: subscribers.id });
  return synced ? { outcome: "ready" } : { outcome: "inactive" };
}

export async function captureAndSyncSubscriber(email: string): Promise<SubscriberSyncResult> {
  const db = getDb();
  const subscriber = await captureSubscriber(email, db);
  return syncCapturedSubscriber(subscriber, db);
}

export async function retrySubscriberSync(id: number): Promise<SubscriberSyncResult> {
  const db = getDb();
  const [subscriber] = await db
    .select(subscriberSelection)
    .from(subscribers)
    .where(eq(subscribers.id, id))
    .limit(1);
  if (!subscriber) return { outcome: "missing" };
  if (subscriber.unsubscribedAt) return { outcome: "inactive" };
  // The repair endpoint is only for captured rows that never received a contact
  // id. Never upsert an already-synced address here: doing so could override a
  // provider-side unsubscribe without verified email ownership.
  if (subscriber.resendContactId) return { outcome: "ready" };
  return syncCapturedSubscriber(subscriber, db);
}
