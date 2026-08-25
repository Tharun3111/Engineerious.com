import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { digests, posts, researchRuns, stockQuotes as stockQuotesTable } from "@/db/schema";
import { authorizeCron } from "@/lib/auth";
import { assertNoFabricatedExperience } from "@/lib/content/frontmatter";
import {
  factualContentHash,
  parseDailyBriefDraft,
  type DailyBriefDraft,
} from "@/lib/daily-brief";
import {
  selectDailyWriteRecovery,
  type DailyWriteRecoveryMode,
} from "@/lib/daily-write-recovery";
import { getDb } from "@/lib/db";
import {
  assertUrlsAllowed,
  deriveSourceStatus,
  isDigestWriteRetryable,
} from "@/lib/editorial-safety";
import { reviewDaily, reviewDailyBrief } from "@/lib/review";
import { parseStoredFindings, type Finding } from "@/lib/research";
import type { StockQuote } from "@/lib/stocks";
import { renderDigestEmail, writeDailyBrief, type WriteOutput } from "@/lib/write";
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

type ClaimResult =
  | {
      ok: true;
      digestId: number;
      findings: Finding[];
      existingSlug: string | null;
      existingDailyDraft: unknown | null;
      recoveryMode: DailyWriteRecoveryMode;
    }
  | { ok: false; reason: string };

/**
 * Current checkpoints live in `digests.dailyDraft`. `blogPostSlug` remains readable
 * only so a deployment that already paid for the legacy post writer can finish its
 * REVIEW pass rather than paying again or becoming stranded.
 */
async function claimDigestForWrite(db: ReturnType<typeof getDb>, date: string): Promise<ClaimResult> {
  const [digest] = await db.select().from(digests).where(eq(digests.date, date)).limit(1);
  if (!digest) return { ok: false, reason: `no digest exists for ${date} — run /api/cron/daily-digest first` };

  // Integrity boundary, deliberately before every status/review shortcut below.
  // A row with both checkpoint formats is corrupt even if it otherwise looks
  // published, rejected, or already reviewed; never disguise that conflict as a
  // harmless skipped invocation.
  const recoveryMode = selectDailyWriteRecovery({
    blogPostSlug: digest.blogPostSlug,
    dailyDraft: digest.dailyDraft ?? null,
  });

  const [run] = await db.select().from(researchRuns).where(eq(researchRuns.digestId, digest.id)).limit(1);
  if (!run) return { ok: false, reason: `research not yet done for ${date}` };

  let findings: Finding[];
  try {
    findings = parseStoredFindings(run.findings);
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "stored research findings are invalid",
    };
  }
  if (findings.length === 0) {
    return { ok: false, reason: `research for ${date} produced zero findings — nothing to write` };
  }

  if (digest.status === "rejected") {
    return { ok: false, reason: `digest #${digest.id} for ${date} was rejected by human review` };
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
    return {
      ok: true,
      digestId: reclaimed.id,
      findings,
      existingSlug: digest.blogPostSlug,
      existingDailyDraft: digest.dailyDraft ?? null,
      recoveryMode,
    };
  }

  if (isDigestWriteRetryable(digest.status)) {
    const [claimed] = await db
      .update(digests)
      .set({ status: "writing", error: null, updatedAt: new Date() })
      .where(and(eq(digests.id, digest.id), eq(digests.status, digest.status)))
      .returning({ id: digests.id });
    if (!claimed) return { ok: false, reason: `lost the race to claim ${date}` };
    return {
      ok: true,
      digestId: claimed.id,
      findings,
      existingSlug: digest.blogPostSlug,
      existingDailyDraft: digest.dailyDraft ?? null,
      recoveryMode,
    };
  }

  return { ok: false, reason: `digest #${digest.id} for ${date} in unexpected status: ${digest.status}` };
}

export async function GET(request: Request) {
  const auth = authorizeCron(request);
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: 401 });

  const db = getDb();
  const date = todayChicago();

  let claim: ClaimResult;
  try {
    claim = await claimDigestForWrite(db, date);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[cron/daily-write] ${date}: ${message}`);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
  if (!claim.ok) return NextResponse.json({ ok: true, skipped: claim.reason });
  const { digestId, findings, recoveryMode } = claim;
  const sourceStatus = deriveSourceStatus(findings.flatMap((finding) => finding.sourceUrls));

  let writeCompleted = Boolean(claim.existingSlug) || claim.existingDailyDraft !== null;

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

    if (recoveryMode !== "resume_legacy") {
      let dailyDraft: DailyBriefDraft;

      if (recoveryMode === "resume_structured") {
        // The paid WRITE call already completed. Strict parsing makes a damaged
        // checkpoint fail closed; never ask the model to silently replace it.
        dailyDraft = parseDailyBriefDraft(claim.existingDailyDraft);
      } else {
        dailyDraft = await writeDailyBrief({ findings, stockQuotes: quotes, date });

        // Persist immediately after the paid WRITE call. REVIEW may fail or time
        // out, but the retry will resume from this JSON instead of paying again.
        const [checkpointed] = await db
          .update(digests)
          .set({
            dailyDraft,
            dailyPublished: null,
            draftVersion: sql`${digests.draftVersion} + 1`,
            reviewReport: null,
            reviewedContentHash: null,
            myTakeConfirmedHash: null,
            myTakeConfirmedAt: null,
            myTakeConfirmedBy: null,
            emailHtml: null,
            error: null,
            updatedAt: new Date(),
          })
          .where(and(eq(digests.id, digestId), eq(digests.status, "writing")))
          .returning({ id: digests.id });
        if (!checkpointed) {
          throw new Error(`Lost ownership while checkpointing Daily draft for ${date}`);
        }
        writeCompleted = true;
      }

      const review = await reviewDailyBrief({ draft: dailyDraft, findings });
      const reviewedContentHash = factualContentHash(dailyDraft);
      const [readyForHuman] = await db
        .update(digests)
        .set({
          status: "pending_review",
          dailyDraft,
          reviewReport: review,
          reviewedContentHash,
          myTakeConfirmedHash: null,
          myTakeConfirmedAt: null,
          myTakeConfirmedBy: null,
          // Structured Daily is web-first. No post or newsletter artifact is
          // produced by generation/review.
          emailHtml: null,
          error: null,
          updatedAt: new Date(),
        })
        .where(and(eq(digests.id, digestId), eq(digests.status, "writing")))
        .returning({ id: digests.id });
      if (!readyForHuman) {
        throw new Error(`Lost ownership while moving Daily draft to human review for ${date}`);
      }

      return NextResponse.json({
        ok: true,
        kind: "daily_brief",
        date,
        digestId,
        resumedFromCheckpoint: recoveryMode === "resume_structured",
        title: dailyDraft.title,
        storiesCount: dailyDraft.stories.length,
        myTakeRequired: true,
        review: {
          groundingViolations: review.groundingViolations.length,
          voiceViolations: review.voiceViolations.length,
          readsAsGenericAiContent: review.readsAsGenericAiContent,
          verdict: review.overallVerdict,
        },
      });
    }

    // Legacy recovery only: new invocations never create a post or email body.
    const slug = claim.existingSlug!;
    let draft: WriteOutput;

    {
      // Resuming after a prior REVIEW-stage failure — legacy WRITE already ran and
      // was paid for; reload it instead of generating a second draft.
      const [existingPost] = await db.select().from(posts).where(eq(posts.slug, slug)).limit(1);
      if (!existingPost || !existingPost.body) {
        throw new Error(`Digest #${digestId} points at post "${slug}" but no such post/body exists`);
      }
      assertNoFabricatedExperience(
        { title: existingPost.title, dek: existingPost.dek ?? "", origin: "ai_generated" },
        existingPost.body,
        `posts/${slug} (DB-native daily draft)`,
      );
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
        // Highlights aren't persisted on posts. Reconstruct them from retained
        // findings, never from a generated or internal URL, so a REVIEW retry is
        // recoverable without weakening the source allowlist.
        emailHighlights: findings.slice(0, 6).map((finding) => ({
          title: finding.title,
          oneLiner: finding.summary,
          url: finding.sourceUrls[0],
        })),
      };
      await db
        .update(posts)
        .set({ sourceStatus, updatedAt: new Date() })
        .where(eq(posts.slug, slug));
    }

    // Deterministic check, not an LLM's judgment call: every highlight URL must be
    // one of the real finding sourceUrls actually supplied. A hallucinated or
    // malformed URL here would otherwise reach a real subscriber inbox as a live link.
    const realUrls = new Set(findings.flatMap((f) => f.sourceUrls));
    assertUrlsAllowed(
      draft.emailHighlights.map((highlight) => highlight.url),
      [...realUrls],
      "WRITE email highlights",
    );
    const safeHighlights = draft.emailHighlights;

    const review = await reviewDaily({ draft, findings });

    const postUrl = `${env.siteUrl.replace(/\/$/, "")}/blog/${slug}`;
    const emailHtml = renderDigestEmail({
      date,
      title: draft.title,
      dek: draft.dek,
      postUrl,
      highlights: safeHighlights,
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
    // Always 'failed', regardless of writeCompleted. This update never touches
    // dailyDraft or the legacy blogPostSlug, so either checkpoint survives. A failed
    // status permits an immediate REVIEW retry without waiting for the stale-writing
    // window and, critically, without paying for WRITE again.
    await db
      .update(digests)
      .set({ status: "failed", error: message, updatedAt: new Date() })
      .where(eq(digests.id, digestId))
      .catch((updateError) => console.error("[cron/daily-write] could not record failure:", updateError));
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
