ALTER TABLE "research_runs" ALTER COLUMN "digest_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "research_runs" ADD COLUMN "coverage_notes" text;--> statement-breakpoint
CREATE UNIQUE INDEX "research_runs_digest_id_key" ON "research_runs" USING btree ("digest_id");