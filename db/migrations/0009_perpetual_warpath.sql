CREATE TYPE "public"."newsletter_status" AS ENUM('draft', 'approved', 'sending', 'queued', 'sent', 'failed', 'canceled');--> statement-breakpoint
ALTER TABLE "digests" ADD COLUMN "newsletter_status" "newsletter_status";--> statement-breakpoint
ALTER TABLE "digests" ADD COLUMN "newsletter_subject" text;--> statement-breakpoint
ALTER TABLE "digests" ADD COLUMN "newsletter_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "digests" ADD COLUMN "newsletter_approved_hash" text;--> statement-breakpoint
ALTER TABLE "digests" ADD COLUMN "newsletter_approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "digests" ADD COLUMN "newsletter_approved_by" text;--> statement-breakpoint
ALTER TABLE "digests" ADD COLUMN "newsletter_broadcast_id" text;--> statement-breakpoint
ALTER TABLE "digests" ADD COLUMN "newsletter_claimed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "digests" ADD COLUMN "newsletter_error" text;--> statement-breakpoint
ALTER TABLE "subscribers" ADD COLUMN "resend_sync_attempted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscribers" ADD COLUMN "resend_sync_error" text;--> statement-breakpoint
CREATE UNIQUE INDEX "digests_newsletter_broadcast_id_key" ON "digests" USING btree ("newsletter_broadcast_id");--> statement-breakpoint
CREATE INDEX "digests_newsletter_status_date_idx" ON "digests" USING btree ("newsletter_status","date");--> statement-breakpoint
-- Refuse to guess if two legacy case/whitespace variants point at different
-- provider contacts. That provider-side ambiguity needs an operator decision.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM "subscribers"
     GROUP BY lower(btrim("email"))
    HAVING count(DISTINCT "resend_contact_id")
             FILTER (WHERE "resend_contact_id" IS NOT NULL) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot canonicalize subscribers: one email maps to multiple Resend contact IDs';
  END IF;
END
$$;--> statement-breakpoint
-- Consolidate before rewriting the email so the existing exact unique index
-- cannot conflict. Keep the earliest local identity/capture, the sole provider
-- contact ID, and the newest signup row's active/inactive state.
WITH "subscriber_merges" AS (
  SELECT lower(btrim("email")) AS "canonical_email",
         min("id") AS "keeper_id",
         min("subscribed_at") AS "subscribed_at",
         max("resend_contact_id") AS "resend_contact_id",
         (array_agg("unsubscribed_at" ORDER BY "subscribed_at" DESC, "id" DESC))[1]
           AS "unsubscribed_at"
    FROM "subscribers"
   GROUP BY lower(btrim("email"))
)
UPDATE "subscribers" AS "subscriber"
   SET "subscribed_at" = "merged"."subscribed_at",
       "resend_contact_id" = "merged"."resend_contact_id",
       "unsubscribed_at" = "merged"."unsubscribed_at"
  FROM "subscriber_merges" AS "merged"
 WHERE "subscriber"."id" = "merged"."keeper_id";--> statement-breakpoint
WITH "subscriber_keepers" AS (
  SELECT lower(btrim("email")) AS "canonical_email", min("id") AS "keeper_id"
    FROM "subscribers"
   GROUP BY lower(btrim("email"))
)
DELETE FROM "subscribers" AS "subscriber"
 USING "subscriber_keepers" AS "keeper"
 WHERE lower(btrim("subscriber"."email")) = "keeper"."canonical_email"
   AND "subscriber"."id" <> "keeper"."keeper_id";--> statement-breakpoint
UPDATE "subscribers" SET "email" = lower(btrim("email"));--> statement-breakpoint
ALTER TABLE "subscribers" ADD CONSTRAINT "subscribers_email_canonical_check" CHECK ("subscribers"."email" = lower(btrim("subscribers"."email")));
