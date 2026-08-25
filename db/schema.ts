import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Engineerious data model.
 *
 * Three aggregated feeds (news | model | oss) all live in one `items` table so the
 * home page can rank them together with a single query. Blog posts live in MDX on
 * disk; `posts` is a thin mirror used only for repurposing/distribution bookkeeping.
 */

/**
 * A structured description of a process or comparison, never raw mermaid syntax —
 * see lib/write.ts's writeOutputSchema (the actual source of truth this mirrors)
 * and components/Diagram.tsx (converts this to mermaid at render time).
 */
export type DiagramSpec = {
  type: "sequence" | "comparison";
  title: string;
  steps: { label: string; detail: string }[];
};

export const itemTypeEnum = pgEnum("item_type", ["news", "model", "oss"]);
export const itemStatusEnum = pgEnum("item_status", ["pending", "approved", "rejected"]);
export const repurposeStatusEnum = pgEnum("repurpose_status", [
  "pending_review",
  "approved",
  "scheduled",
  "published",
  "rejected",
  "failed",
]);
export const platformEnum = pgEnum("platform", [
  "linkedin",
  "x",
  "instagram",
  "youtube",
  "facebook",
]);
export const submissionStatusEnum = pgEnum("submission_status", [
  "pending",
  "accepted",
  "rejected",
]);
export const digestStatusEnum = pgEnum("digest_status", [
  "generating",
  "writing",
  "pending_review",
  "approved",
  "published",
  "rejected",
  "failed",
]);

/**
 * One row per ingestion source. `weight` seeds authority into the ranking formula so
 * items rank sensibly before any human votes exist (see lib/ranking.ts).
 */
export const sources = pgTable(
  "sources",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    type: itemTypeEnum("type").notNull(),
    adapter: text("adapter").notNull(),
    url: text("url"),
    weight: doublePrecision("weight").notNull().default(1),
    enabled: boolean("enabled").notNull().default(true),
    lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("sources_slug_key").on(t.slug)],
);

export const items = pgTable(
  "items",
  {
    id: serial("id").primaryKey(),
    type: itemTypeEnum("type").notNull(),
    status: itemStatusEnum("status").notNull().default("approved"),
    title: text("title").notNull(),
    url: text("url").notNull(),
    /** sha256 of the canonicalised URL — the dedupe key across overlapping feeds. */
    urlHash: text("url_hash").notNull(),
    summary: text("summary"),
    /** One-line "why it matters". Always rendered with an AI-generated label. */
    aiNote: text("ai_note"),
    source: text("source").notNull(),
    sourceSlug: text("source_slug").notNull(),
    sourceWeight: doublePrecision("source_weight").notNull().default(1),
    author: text("author"),
    points: integer("points").notNull().default(0),
    score: doublePrecision("score").notNull().default(0),
    firstSeen: timestamp("first_seen", { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    rankedAt: timestamp("ranked_at", { withTimezone: true }),
    rawJson: jsonb("raw_json"),
  },
  (t) => [
    uniqueIndex("items_url_hash_key").on(t.urlHash),
    index("items_type_score_idx").on(t.type, t.score),
    index("items_score_idx").on(t.score),
    index("items_published_idx").on(t.publishedAt),
    index("items_status_idx").on(t.status),
  ],
);

/**
 * Two roles in one table. For human-written posts, this is a mirror of MDX
 * frontmatter (written on demand — see lib/content/blog.ts syncPost) so repurpose
 * jobs and distribution links have a stable FK; the MDX file on disk stays the
 * source of truth for the body, and `body` here stays null.
 *
 * For daily-pipeline auto-generated posts, `body` is non-null and IS the source of
 * truth — Vercel's production filesystem is read-only, so a serverless cron route
 * cannot write a new content/blog/*.mdx file at runtime, and committing to git from
 * a cron job was rejected as unnecessary complexity/fragility for what a database
 * row does natively. lib/content/blog.ts's getPost()/getAllPosts() check both
 * sources and merge them.
 *
 * `format`/`origin`/`sourceStatus`/`testedStatus`/`authenticityStatus` mirror the
 * exact frontmatter contract in lib/content/frontmatter.ts (plain text, not pgEnum,
 * matching how `pillar` above is already stored — validate at the app layer with
 * that same Zod schema, not a DB constraint).
 */
export const posts = pgTable(
  "posts",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    dek: text("dek"),
    pillar: text("pillar").notNull(),
    canonical: text("canonical"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    /** { linkedin: "https://...", x: "https://..." } — filled in after publishing. */
    distribution: jsonb("distribution").$type<Record<string, string>>().default({}),

    /** Null for MDX-mirrored posts. Non-null + source of truth for DB-native posts. */
    body: text("body"),
    draft: boolean("draft").notNull().default(true),
    format: text("format"),
    origin: text("origin"),
    sourceStatus: text("source_status"),
    testedStatus: text("tested_status"),
    authenticityStatus: text("authenticity_status"),
    tags: jsonb("tags").$type<string[]>().default([]),
    reviewedBy: text("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),

    /**
     * DB-native (pipeline) posts only — never populated for MDX-mirrored posts. See
     * lib/write.ts's writeOutputSchema.
     */
    tldr: text("tldr"),
    keyFacts: jsonb("key_facts").$type<string[]>(),
    /** Ticker symbols topically relevant to the post — see lib/stocks.ts's StockStrip join. */
    relevantTickers: jsonb("relevant_tickers").$type<string[]>(),
    /**
     * Structured spec only, never raw mermaid text — see components/Diagram.tsx, which
     * converts this to mermaid syntax at render time.
     */
    diagram: jsonb("diagram").$type<DiagramSpec>(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("posts_slug_key").on(t.slug)],
);

export const repurposeJobs = pgTable(
  "repurpose_jobs",
  {
    id: serial("id").primaryKey(),
    postSlug: text("post_slug").notNull(),
    platform: platformEnum("platform").notNull(),
    status: repurposeStatusEnum("status").notNull().default("pending_review"),
    /** Platform-native draft body, generated by lib/repurpose. Human edits allowed. */
    draft: text("draft").notNull(),
    /** Carousel outlines, hooks, alt text — anything not part of the main body. */
    meta: jsonb("meta"),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    publishedUrl: text("published_url"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("repurpose_jobs_post_platform_key").on(t.postSlug, t.platform),
    index("repurpose_jobs_status_idx").on(t.status),
  ],
);

export const submissions = pgTable(
  "submissions",
  {
    id: serial("id").primaryKey(),
    type: itemTypeEnum("type").notNull(),
    title: text("title").notNull(),
    url: text("url").notNull(),
    note: text("note"),
    submitterEmail: text("submitter_email"),
    status: submissionStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("submissions_status_idx").on(t.status)],
);

/**
 * One row per calendar day — the "day" as a first-class object for the daily
 * research→write→review pipeline. `date` is a DATE column (no time component) so
 * "today's digest" is a simple unique lookup regardless of what hour the cron ran.
 */
export const digests = pgTable(
  "digests",
  {
    id: serial("id").primaryKey(),
    date: date("date").notNull(),
    status: digestStatusEnum("status").notNull().default("generating"),
    blogPostSlug: text("blog_post_slug"),
    /** Digest-email HTML body, rendered once at write time, sent verbatim on approve. */
    emailHtml: text("email_html"),
    stockSummary: jsonb("stock_summary"),
    /** Stage 4 output — structured flags the human reviews before approving. */
    reviewReport: jsonb("review_report"),
    /**
     * Private, mutable Daily Brief working copy. The writer and admin editor may
     * replace this value while the digest is under review; public routes never
     * read it. Validation lives in lib/daily-brief.ts so malformed JSON fails
     * closed instead of becoming public content.
     */
    dailyDraft: jsonb("daily_draft"),
    /**
     * Immutable public snapshot captured atomically when a reviewed Daily Brief
     * is published. Public routes read this column exclusively.
     */
    dailyPublished: jsonb("daily_published"),
    /** Optimistic concurrency token for edits to dailyDraft. */
    draftVersion: integer("draft_version").notNull().default(0),
    /** SHA-256 of the reviewed payload with myTake excluded. */
    reviewedContentHash: text("reviewed_content_hash"),
    /** SHA-256 of the exact human-confirmed myTake text. */
    myTakeConfirmedHash: text("my_take_confirmed_hash"),
    myTakeConfirmedAt: timestamp("my_take_confirmed_at", { withTimezone: true }),
    myTakeConfirmedBy: text("my_take_confirmed_by"),
    reviewedBy: text("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    emailSentAt: timestamp("email_sent_at", { withTimezone: true }),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("digests_date_key").on(t.date),
    index("digests_status_idx").on(t.status),
    index("digests_status_date_idx").on(t.status, t.date),
  ],
);

/**
 * Audit trail for the gather+research stages (Stages 1-2). Kept even for days that
 * don't produce a publishable digest, so "did we already look at this topic" and
 * "how many Tavily credits did today cost" are answerable without re-running anything.
 */
export const researchRuns = pgTable(
  "research_runs",
  {
    id: serial("id").primaryKey(),
    /**
     * Unique, not just indexed — this is the actual concurrency guard. The daily
     * cron route inserts with `onConflictDoNothing({ target: digestId })`; the
     * constraint (not app-level logic) is what makes "did research already happen
     * for this digest" atomic under a true concurrent double-invocation.
     */
    digestId: integer("digest_id")
      .notNull()
      .references(() => digests.id),
    date: date("date").notNull(),
    /** Raw Stage 1 output — RSS/API items + Tavily search results, pre-synthesis. */
    gatheredItems: jsonb("gathered_items"),
    /** Stage 2 (Sonnet) structured findings array — ranked candidates with source URLs. */
    findings: jsonb("findings"),
    /** Sonnet's own coverage-gap notes, surfaced to the human reviewer, not hidden. */
    coverageNotes: text("coverage_notes"),
    tavilyCreditsUsed: integer("tavily_credits_used").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("research_runs_digest_id_key").on(t.digestId),
    index("research_runs_date_idx").on(t.date),
  ],
);

/**
 * Daily close + % change per tracked ticker, both providers' raw responses kept for
 * the cross-check audit trail. `flagged` is set when Finnhub and Twelve Data disagree
 * beyond tolerance, or |% change| is implausibly large — either holds the day for
 * manual review rather than publishing a possibly-wrong number under a byline.
 */
export const stockQuotes = pgTable(
  "stock_quotes",
  {
    id: serial("id").primaryKey(),
    date: date("date").notNull(),
    ticker: text("ticker").notNull(),
    finnhubData: jsonb("finnhub_data"),
    twelvedataData: jsonb("twelvedata_data"),
    percentChange: doublePrecision("percent_change"),
    flagged: boolean("flagged").notNull().default(false),
    flagReason: text("flag_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("stock_quotes_date_ticker_key").on(t.date, t.ticker),
    index("stock_quotes_flagged_idx").on(t.flagged),
  ],
);

/**
 * Source of truth for newsletter recipients. Postgres row is written synchronously on
 * signup regardless of whether the Resend API call succeeds — `resendContactId` is
 * filled in best-effort so a transient Resend outage never loses a signup.
 */
export const subscribers = pgTable(
  "subscribers",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    resendContactId: text("resend_contact_id"),
    subscribedAt: timestamp("subscribed_at", { withTimezone: true }).notNull().defaultNow(),
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("subscribers_email_key").on(t.email)],
);

export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
export type Source = typeof sources.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type RepurposeJob = typeof repurposeJobs.$inferSelect;
export type Submission = typeof submissions.$inferSelect;
export type Digest = typeof digests.$inferSelect;
export type ResearchRun = typeof researchRuns.$inferSelect;
export type StockQuote = typeof stockQuotes.$inferSelect;
export type Subscriber = typeof subscribers.$inferSelect;
export type ItemType = (typeof itemTypeEnum.enumValues)[number];
export type Platform = (typeof platformEnum.enumValues)[number];
export type DigestStatus = (typeof digestStatusEnum.enumValues)[number];
