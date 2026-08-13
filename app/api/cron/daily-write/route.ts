import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { digests, posts, researchRuns, stockQuotes as stockQuotesTable } from "@/db/schema";
import { authorizeCron } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { reviewDaily } from "@/lib/review";
import type { Finding } from "@/lib/research";
import type { StockQuote } from "@/lib/stocks";
import { renderDigestEmail, writeDaily, type WriteOutput } from "@/lib/write";
import { env } from "@/lib/env";
import { todayChicago } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 290; // Hobby's hard cap is 300s — two sequential premium-tier LLM calls need the room

const STALE_CLAIM_MINUTES = 10;
/** posts.pillar is NOT NULL, but WRITE correctly returns null on most days (findings
 *  don't always fit one of the 3 real pillars) — this sentinel is not a real pillar
 *  slug; getPillar()/PillarBadge already render nothing for an unrecognized slug, and
 *  getPostsByPillar() correctly never matches it. Do not add "none" to lib/pillars.ts. */
const NO_PILLAR = "none";

function slugBase(title: string, date: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return `${date}-${base}`;
}

/**
 * posts.slug is one unique namespace shared by MDX-mirrored posts and DB-native
 * pipeline posts (see db/schema.ts). A collision would silently drop today's post
 * (onConflictDoNothing) while the digest still pointed at whatever pre-existing post
 * already owned that slug — confirmed as a real failure mode in code review. Cheap
 * fix: check both sources and append a numeric suffix on collision instead of
 * trusting the DB constraint to fail loudly (it doesn't — DO NOTHING succeeds silently).
 */
async function uniqueSlug(db: ReturnType<typeof getDb>, title: string, date: string): Promise<string> {
  const { readdirSync } = await import("node:fs");
  let mdxSlugs: Set<string>;
  try {
    mdxSlugs = new Set(readdirSync(`${process.cwd()}/content/blog`).map((f) => f.replace(/\.mdx$/, "")));
  } catch {
    mdxSlugs = new Set();
  }

  const base = slugBase(title, date);
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    if (mdxSlugs.has(candidate)) continue;
    const [existing] = await db.select({ id: posts.id }).from(posts).where(eq(posts.slug, candidate)).limit(1);
    if (!existing) return candidate;
  }
  // Astronomically unlikely (20 same-title collisions in one day) — fail loudly
  // rather than silently overwrite something.
  throw new Error(`Could not find a unique slug for "${title}" on ${date} after 20 attempts`);
}

type ClaimResult =
  | { ok: true; digestId: number; findings: Finding[]; existingSlug: string | null }
  | { ok: false; reason: string };

/**
 * Checkpoint is `digests.blogPostSlug`, and — unlike the version this replaced —
 * that column is now set IMMEDIATELY after the post insert succeeds (see the route
 * body), not only after REVIEW also succeeds. That's what makes `existingSlug` a
 * true "was the paid WRITE call already done" signal: a REVIEW-stage failure no
 * longer causes a retry to re-run (and re-pay for) WRITE.
 */
async function claimDigestForWrite(db: ReturnType<typeof getDb>, date: string): Promise<ClaimResult> {
  const [digest] = await db.select().from(digests).where(eq(digests.date, date)).limit(1);
  if (!digest) return { ok: false, reason: `no digest exists for ${date} — run /api/cron/daily-digest first` };

  const [run] = await db.select().from(researchRuns).where(eq(researchRuns.digestId, digest.id)).limit(1);
  if (!run) return { ok: false, reason: `research not yet done for ${date}` };

  const findings = (run.findings as Finding[] | null) ?? [];
  if (findings.length === 0) {
    return { ok: false, reason: `research for ${date} produced zero findings — nothing to write` };
  }

  if (digest.status === "pending_review" || digest.status === "approved" || digest.status === "published") {
    return { ok: false, reason: `digest #${digest.id} for ${date} is already past writing (status: ${digest.status})` };
  }

  if (digest.blogPostSlug && digest.reviewReport) {
    return { ok: false, reason: `already written and reviewed for ${date} (post: ${digest.blogPostSlug})` };
  }

  if (digest.status === "writing") {
    const staleBefore = new Date(Date.now() - STALE_CLAIM_MINUTES * 60_000);
    if (digest.updatedAt > staleBefore) {
      return { ok: false, reason: `another invocation is already writing ${date}` };
    }
    const [reclaimed] = await db
      .update(digests)
      .set({ status: "writing", error: "reclaimed from stale writing state", updatedAt: new Date() })
      .where(and(eq(digests.id, digest.id), eq(digests.status, "writing"), sql`${digests.updatedAt} <= ${staleBefore}`))
      .returning({ id: digests.id });
    if (!reclaimed) return { ok: false, reason: `lost the race to reclaim ${date}` };
    return { ok: true, digestId: reclaimed.id, findings, existingSlug: digest.blogPostSlug };
  }

  if (digest.status === "generating" || digest.status === "failed") {
    const [claimed] = await db
      .update(digests)
      .set({ status: "writing", error: null, updatedAt: new Date() })
      .where(and(eq(digests.id, digest.id), eq(digests.status, digest.status)))
      .returning({ id: digests.id });
    if (!claimed) return { ok: false, reason: `lost the race to claim ${date}` };
    return { ok: true, digestId: claimed.id, findings, existingSlug: digest.blogPostSlug };
  }

  return { ok: false, reason: `digest #${digest.id} for ${date} in unexpected status: ${digest.status}` };
}

export async function GET(request: Request) {
  const auth = authorizeCron(request);
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: 401 });

  const db = getDb();
  const date = todayChicago();

  const claim = await claimDigestForWrite(db, date);
  if (!claim.ok) return NextResponse.json({ ok: true, skipped: claim.reason });
  const { digestId, findings } = claim;

  let writeCompleted = Boolean(claim.existingSlug);

  try {
    const stockRows = await db.select().from(stockQuotesTable).where(eq(stockQuotesTable.date, date));
    const quotes: StockQuote[] = stockRows.map((r) => ({
      ticker: r.ticker,
      percentChange: r.percentChange,
      finnhub: r.finnhubData,
      twelvedata: r.twelvedataData,
      headline: null,
      crossChecked: r.twelvedataData !== null,
      flagged: r.flagged,
      flagReason: r.flagReason,
    }));

    let slug: string;
    let draft: WriteOutput;

    if (claim.existingSlug) {
      // Resuming after a prior REVIEW-stage failure — WRITE already ran and was paid
      // for; reload it instead of generating (and paying for) a second draft.
      slug = claim.existingSlug;
      const [existingPost] = await db.select().from(posts).where(eq(posts.slug, slug)).limit(1);
      if (!existingPost || !existingPost.body) {
        throw new Error(`Digest #${digestId} points at post "${slug}" but no such post/body exists`);
      }
      draft = {
        title: existingPost.title,
        dek: existingPost.dek ?? "",
        body: existingPost.body,
        // tldr/keyFacts/relevantTickers/diagram reconstructed from the same reloaded
        // row — a resumed run must not feed undefined into anything downstream that
        // reads these (e.g. REVIEW stage fact-checking) as if that were the real
        // content.
        tldr: existingPost.tldr ?? "",
        keyFacts: (existingPost.keyFacts as string[] | null) ?? [],
        relevantTickers: (existingPost.relevantTickers as string[] | null) ?? [],
        diagram: existingPost.diagram ?? undefined,
        tags: (existingPost.tags as string[] | null) ?? [],
        pillarSlug: existingPost.pillar === NO_PILLAR ? null : (existingPost.pillar as WriteOutput["pillarSlug"]),
        // Highlights aren't persisted on posts — email gets fewer highlights on a
        // resumed run than a fresh one. Acceptable: this path only fires after a
        // real prior failure, not on a normal day.
        emailHighlights: [{ title: existingPost.title, oneLiner: existingPost.dek ?? "", url: `${env.siteUrl}/blog/${slug}` }],
      };
    } else {
      draft = await writeDaily({ findings, stockQuotes: quotes, date });
      slug = await uniqueSlug(db, draft.title, date);

      // Deterministic check, not an LLM's judgment call: a relevantTickers entry only
      // survives if it's a real ticker this run actually fetched a quote for — same
      // discipline as the emailHighlights URL check below. A hallucinated symbol here
      // would otherwise render on StockStrip with no backing data.
      const realTickers = new Set(quotes.map((q) => q.ticker));
      const safeRelevantTickers = draft.relevantTickers.filter((t) => realTickers.has(t));
      if (safeRelevantTickers.length < draft.relevantTickers.length) {
        console.warn(
          `[cron/daily-write] ${date}: dropped ${draft.relevantTickers.length - safeRelevantTickers.length} relevantTickers not in today's quotes`,
        );
      }

      const [savedPost] = await db
        .insert(posts)
        .values({
          slug,
          title: draft.title,
          dek: draft.dek,
          pillar: draft.pillarSlug ?? NO_PILLAR,
          body: draft.body,
          tldr: draft.tldr,
          keyFacts: draft.keyFacts,
          relevantTickers: safeRelevantTickers,
          diagram: draft.diagram ?? null,
          draft: true,
          format: "article",
          origin: "ai_generated",
          sourceStatus: "primary",
          testedStatus: "not_tested",
          authenticityStatus: "pending",
          tags: draft.tags,
        })
        .onConflictDoNothing({ target: posts.slug })
        .returning({ id: posts.id });

      if (!savedPost) {
        // uniqueSlug() checked moments ago, but a genuine concurrent insert could
        // still land between the check and this insert — fail loudly rather than
        // silently pointing the digest at someone else's post.
        throw new Error(`Post insert conflicted on slug "${slug}" despite uniqueSlug() — concurrent write?`);
      }

      // Checkpoint immediately — this, not the final update below, is what a retry
      // checks via claim.existingSlug. A REVIEW failure after this point must not
      // cause WRITE to run (and be paid for) a second time.
      await db.update(digests).set({ blogPostSlug: slug, updatedAt: new Date() }).where(eq(digests.id, digestId));
      writeCompleted = true;
    }

    // Deterministic check, not an LLM's judgment call: every highlight URL must be
    // one of the real finding sourceUrls actually supplied. A hallucinated or
    // malformed URL here would otherwise reach a real subscriber inbox as a live link.
    const realUrls = new Set(findings.flatMap((f) => f.sourceUrls));
    const safeHighlights = draft.emailHighlights.filter((h) => realUrls.has(h.url));
    if (safeHighlights.length < draft.emailHighlights.length) {
      console.warn(
        `[cron/daily-write] ${date}: dropped ${draft.emailHighlights.length - safeHighlights.length} highlight(s) with a URL not in the source findings`,
      );
    }

    const review = await reviewDaily({ draft, findings });

    const postUrl = `${env.siteUrl.replace(/\/$/, "")}/blog/${slug}`;
    const emailHtml = renderDigestEmail({
      date,
      title: draft.title,
      dek: draft.dek,
      postUrl,
      highlights: safeHighlights.length > 0 ? safeHighlights : draft.emailHighlights.slice(0, 1),
      stockQuotes: quotes,
    });

    await db
      .update(digests)
      .set({ status: "pending_review", emailHtml, reviewReport: review, error: null, updatedAt: new Date() })
      .where(eq(digests.id, digestId));

    return NextResponse.json({
      ok: true,
      date,
      digestId,
      slug,
      title: draft.title,
      wordCount: draft.body.split(/\s+/).length,
      pillarSlug: draft.pillarSlug,
      highlightsCount: safeHighlights.length,
      highlightsDropped: draft.emailHighlights.length - safeHighlights.length,
      review: {
        groundingViolations: review.groundingViolations.length,
        voiceViolations: review.voiceViolations.length,
        readsAsGenericAiContent: review.readsAsGenericAiContent,
        verdict: review.overallVerdict,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[cron/daily-write] ${date}: ${message} (writeCompleted=${writeCompleted})`);
    // Always 'failed', regardless of writeCompleted — this update never touches
    // blogPostSlug, so the checkpoint survives either way. Setting 'failed' (rather
    // than leaving 'writing') matters specifically when writeCompleted is true: the
    // claim function's generating/failed branch allows an IMMEDIATE retry with no
    // staleness wait, correctly resuming from REVIEW via existingSlug. Leaving
    // 'writing' here would make a genuinely-finished request look still-in-progress
    // for the next 10 minutes.
    await db
      .update(digests)
      .set({ status: "failed", error: message, updatedAt: new Date() })
      .where(eq(digests.id, digestId))
      .catch((updateError) => console.error("[cron/daily-write] could not record failure:", updateError));
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
