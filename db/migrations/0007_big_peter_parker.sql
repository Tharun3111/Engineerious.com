ALTER TABLE "digests" ADD COLUMN "daily_draft" jsonb;--> statement-breakpoint
ALTER TABLE "digests" ADD COLUMN "daily_published" jsonb;--> statement-breakpoint
ALTER TABLE "digests" ADD COLUMN "draft_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "digests" ADD COLUMN "reviewed_content_hash" text;--> statement-breakpoint
ALTER TABLE "digests" ADD COLUMN "my_take_confirmed_hash" text;--> statement-breakpoint
ALTER TABLE "digests" ADD COLUMN "my_take_confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "digests" ADD COLUMN "my_take_confirmed_by" text;--> statement-breakpoint
CREATE INDEX "digests_status_date_idx" ON "digests" USING btree ("status","date");