ALTER TYPE "public"."digest_status" ADD VALUE 'writing' BEFORE 'pending_review';--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "body" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "draft" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "format" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "origin" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "source_status" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "tested_status" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "authenticity_status" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "tags" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "reviewed_by" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "reviewed_at" timestamp with time zone;