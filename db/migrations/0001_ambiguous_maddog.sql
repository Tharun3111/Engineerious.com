CREATE TYPE "public"."digest_status" AS ENUM('generating', 'pending_review', 'approved', 'published', 'failed');--> statement-breakpoint
CREATE TABLE "digests" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"status" "digest_status" DEFAULT 'generating' NOT NULL,
	"blog_post_slug" text,
	"email_html" text,
	"stock_summary" jsonb,
	"review_report" jsonb,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"email_sent_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"digest_id" integer,
	"date" date NOT NULL,
	"gathered_items" jsonb,
	"findings" jsonb,
	"tavily_credits_used" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_quotes" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"ticker" text NOT NULL,
	"finnhub_data" jsonb,
	"twelvedata_data" jsonb,
	"percent_change" double precision,
	"flagged" boolean DEFAULT false NOT NULL,
	"flag_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscribers" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"resend_contact_id" text,
	"subscribed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"unsubscribed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "research_runs" ADD CONSTRAINT "research_runs_digest_id_digests_id_fk" FOREIGN KEY ("digest_id") REFERENCES "public"."digests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "digests_date_key" ON "digests" USING btree ("date");--> statement-breakpoint
CREATE INDEX "digests_status_idx" ON "digests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "research_runs_date_idx" ON "research_runs" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_quotes_date_ticker_key" ON "stock_quotes" USING btree ("date","ticker");--> statement-breakpoint
CREATE INDEX "stock_quotes_flagged_idx" ON "stock_quotes" USING btree ("flagged");--> statement-breakpoint
CREATE UNIQUE INDEX "subscribers_email_key" ON "subscribers" USING btree ("email");