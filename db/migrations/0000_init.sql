CREATE TYPE "public"."item_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."item_type" AS ENUM('news', 'model', 'oss');--> statement-breakpoint
CREATE TYPE "public"."platform" AS ENUM('linkedin', 'x', 'instagram', 'youtube', 'facebook');--> statement-breakpoint
CREATE TYPE "public"."repurpose_status" AS ENUM('pending_review', 'approved', 'scheduled', 'published', 'rejected', 'failed');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('pending', 'accepted', 'rejected');--> statement-breakpoint
CREATE TABLE "items" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" "item_type" NOT NULL,
	"status" "item_status" DEFAULT 'approved' NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"url_hash" text NOT NULL,
	"summary" text,
	"ai_note" text,
	"source" text NOT NULL,
	"source_slug" text NOT NULL,
	"source_weight" double precision DEFAULT 1 NOT NULL,
	"author" text,
	"points" integer DEFAULT 0 NOT NULL,
	"score" double precision DEFAULT 0 NOT NULL,
	"first_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"ranked_at" timestamp with time zone,
	"raw_json" jsonb
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"dek" text,
	"pillar" text NOT NULL,
	"canonical" text,
	"published_at" timestamp with time zone,
	"distribution" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repurpose_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_slug" text NOT NULL,
	"platform" "platform" NOT NULL,
	"status" "repurpose_status" DEFAULT 'pending_review' NOT NULL,
	"draft" text NOT NULL,
	"meta" jsonb,
	"scheduled_for" timestamp with time zone,
	"published_url" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"type" "item_type" NOT NULL,
	"adapter" text NOT NULL,
	"url" text,
	"weight" double precision DEFAULT 1 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_fetched_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" "item_type" NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"note" text,
	"submitter_email" text,
	"status" "submission_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "items_url_hash_key" ON "items" USING btree ("url_hash");--> statement-breakpoint
CREATE INDEX "items_type_score_idx" ON "items" USING btree ("type","score");--> statement-breakpoint
CREATE INDEX "items_score_idx" ON "items" USING btree ("score");--> statement-breakpoint
CREATE INDEX "items_published_idx" ON "items" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "items_status_idx" ON "items" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "posts_slug_key" ON "posts" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "repurpose_jobs_post_platform_key" ON "repurpose_jobs" USING btree ("post_slug","platform");--> statement-breakpoint
CREATE INDEX "repurpose_jobs_status_idx" ON "repurpose_jobs" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "sources_slug_key" ON "sources" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "submissions_status_idx" ON "submissions" USING btree ("status");