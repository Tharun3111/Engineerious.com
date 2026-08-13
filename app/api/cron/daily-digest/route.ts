import { and, desc, eq, gte, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { digests, items, researchRuns, stockQuotes } from "@/db/schema";
import { gatherResearch } from "@/lib/adapters/tavily";
import { authorizeCron } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { synthesizeResearch } from "@/lib/research";
import { gatherStockQuotes } from "@/lib/stocks";
import { todayChicago } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 280; // Hobby's cap is 300s (see docs/launch-runbook.md) — leave margin

const LOOKBACK_HOURS = 48;
/** A 'generating' row older than this is presumed crashed (e.g. hit maxDuration), not in-flight. */
const STALE_CLAIM_MINUTES = 10;

type ClaimResult = { ok: true; digestId: number } | { ok: false; reason: string };

/**
 * Atomically claims the right to run research for `date`. Every branch is a single
 * conditional statement (INSERT ... ON CONFLICT DO NOTHING, or UPDATE ... WHERE ...),
 * so two overlapping invocations can't both believe they own the claim — whichever
 * statement actually mutates a row wins; the other sees zero rows affected and backs
 * off. This is deliberately NOT a Postgres advisory lock: those are session-scoped,
 * and the Neon HTTP driver used in production has no persistent session between
 * queries, so an advisory lock taken in one query would already be released by the
 * next. A row-level conditional update works over HTTP because each statement is
 * atomic on its own.
 *
 * Whether research already exists for this digest is checked here too, and it is
 * checked against `research_runs` directly — NOT against `digests.status`. That
 * decoupling is the actual fix for the bug this replaced: previously, any failure
 * *after* research succeeded (e.g. the stock-quotes write) set status='failed', and
 * every later invocation treated 'failed' as "safe to redo everything," silently
 * re-spending Tavily credits and LLM tokens on already-completed research forever.
 */
async function claimDigestForResearch(
  db: ReturnType<typeof getDb>,
  date: string,
): Promise<ClaimResult> {
  const [inserted] = await db
    .insert(digests)
    .values({ date, status: "generating" })
    .onConflictDoNothing({ target: digests.date })
    .returning({ id: digests.id });

  if (inserted) return { ok: true, digestId: inserted.id };

  const [existing] = await db.select().from(digests).where(eq(digests.date, date)).limit(1);
  if (!existing) return { ok: false, reason: "unreachable: insert conflicted but row not found" };

  const [existingRun] = await db
    .select({ id: researchRuns.id })
    .from(researchRuns)
    .where(eq(researchRuns.digestId, existing.id))
    .limit(1);
  if (existingRun) {
    return { ok: false, reason: `research already exists for ${date} (digest #${existing.id})` };
  }

  if (existing.status === "generating") {
    const staleBefore = new Date(Date.now() - STALE_CLAIM_MINUTES * 60_000);
    if (existing.updatedAt > staleBefore) {
      return { ok: false, reason: `another invocation is already generating ${date}` };
    }
    // Stale — a prior run almost certainly crashed (e.g. hit maxDuration) without
    // reaching the failure handler. Reclaim, guarded so only one racer wins.
    const [reclaimed] = await db
      .update(digests)
      .set({ status: "generating", error: "reclaimed from stale generating state", updatedAt: new Date() })
      .where(and(eq(digests.id, existing.id), eq(digests.status, "generating"), sql`${digests.updatedAt} <= ${staleBefore}`))
      .returning({ id: digests.id });
    if (!reclaimed) return { ok: false, reason: `lost the race to reclaim ${date}` };
    return { ok: true, digestId: reclaimed.id };
  }

  if (existing.status === "failed") {
    const [reclaimed] = await db
      .update(digests)
      .set({ status: "generating", error: null, updatedAt: new Date() })
      .where(and(eq(digests.id, existing.id), eq(digests.status, "failed")))
      .returning({ id: digests.id });
    if (!reclaimed) return { ok: false, reason: `lost the race to retry ${date}` };
    return { ok: true, digestId: reclaimed.id };
  }

  return { ok: false, reason: `digest #${existing.id} for ${date} is already past research (status: ${existing.status})` };
}

export async function GET(request: Request) {
  const auth = authorizeCron(request);
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: 401 });

  const db = getDb();
  const date = todayChicago();

  const claim = await claimDigestForResearch(db, date);
  if (!claim.ok) return NextResponse.json({ ok: true, skipped: claim.reason });
  const { digestId } = claim;

  let researchSaved = false;

  try {
    const since = new Date(Date.now() - LOOKBACK_HOURS * 3_600_000);
    const [recentItems, { gathered, creditsUsed, errors: tavilyErrors }, quotes] = await Promise.all([
      db
        .select()
        .from(items)
        .where(and(eq(items.status, "approved"), gte(items.firstSeen, since)))
        .orderBy(desc(items.score))
        .limit(80),
      gatherResearch(),
      gatherStockQuotes(),
    ]);

    const research = await synthesizeResearch({ gathered, recentItems, stockQuotes: quotes });

    // onConflictDoNothing on the unique digest_id constraint is the final backstop:
    // even if two invocations both somehow won a claim (shouldn't happen given the
    // guarded updates above), only one research_runs row can ever exist per digest.
    const [savedRun] = await db
      .insert(researchRuns)
      .values({
        digestId,
        date,
        gatheredItems: { tavily: gathered, recentItemIds: recentItems.map((i) => i.id) },
        findings: research.findings,
        coverageNotes: research.coverageNotes ?? null,
        tavilyCreditsUsed: creditsUsed,
      })
      .onConflictDoNothing({ target: researchRuns.digestId })
      .returning({ id: researchRuns.id });
    researchSaved = Boolean(savedRun);

    const degraded = gathered.length === 0 && tavilyErrors.length > 0;
    if (degraded) {
      console.warn(`[cron/daily-digest] ${date}: all Tavily queries failed — findings are RSS/HN/GitHub-only`, tavilyErrors);
    }

    // Stock writes are independently idempotent (upsert on date+ticker) — a failure
    // here must not undo the fact that research already succeeded and was saved.
    let stockError: string | null = null;
    if (quotes.length > 0) {
      try {
        await db
          .insert(stockQuotes)
          .values(
            quotes.map((q) => ({
              date,
              ticker: q.ticker,
              finnhubData: q.finnhub,
              twelvedataData: q.twelvedata,
              percentChange: q.percentChange,
              flagged: q.flagged,
              flagReason: q.flagReason,
            })),
          )
          .onConflictDoUpdate({
            target: [stockQuotes.date, stockQuotes.ticker],
            set: {
              finnhubData: sql`excluded.finnhub_data`,
              twelvedataData: sql`excluded.twelvedata_data`,
              percentChange: sql`excluded.percent_change`,
              flagged: sql`excluded.flagged`,
              flagReason: sql`excluded.flag_reason`,
            },
          });
      } catch (error) {
        stockError = error instanceof Error ? error.message : String(error);
        console.error(`[cron/daily-digest] ${date}: stock quotes write failed (research already saved):`, stockError);
      }
    }

    return NextResponse.json({
      ok: true,
      date,
      digestId,
      recentItemsConsidered: recentItems.length,
      tavilyQueriesRun: gathered.length,
      tavilyCreditsUsed: creditsUsed,
      tavilyErrors,
      degraded,
      findingsCount: research.findings.length,
      coverageNotes: research.coverageNotes ?? null,
      stockTickersChecked: quotes.length,
      stockFlagged: quotes.filter((q) => q.flagged).map((q) => ({ ticker: q.ticker, reason: q.flagReason })),
      stockError,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[cron/daily-digest] ${date}:`, message);
    // Only mark the digest failed if research genuinely didn't complete — if it did
    // (researchSaved) but something after it threw, that's already handled above and
    // never reaches this catch, so this path is exclusively "research didn't happen."
    if (!researchSaved) {
      await db
        .update(digests)
        .set({ status: "failed", error: message, updatedAt: new Date() })
        .where(eq(digests.id, digestId))
        .catch((updateError) => console.error("[cron/daily-digest] could not record failure:", updateError));
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
