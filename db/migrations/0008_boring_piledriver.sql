ALTER TABLE "items" ADD COLUMN "curated_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "curated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "curated_by" text;--> statement-breakpoint
CREATE INDEX "items_curated_visibility_idx" ON "items" USING btree ("status","score");
