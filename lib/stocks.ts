import { and, eq, inArray } from "drizzle-orm";

import { digests as digestsTable, stockQuotes as stockQuotesTable } from "@/db/schema";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";

/**
 * Daily stock cross-check for the AI-relevant basket. Finnhub is primary (quote +
 * a company-news headline for the "reason" line) and is fetched for all tracked
 * tickers. Twelve Data is the free cross-check — but ONLY for tickers that actually
 * moved enough to be worth reporting.
 *
 * Confirmed live, and contrary to the original assumption in this file: Twelve
 * Data's free tier charges ONE CREDIT PER SYMBOL even inside a single batched
 * request (`symbol=A,B,C` costs 3 credits, not 1). The free cap is 8 credits/min,
 * so a naive "batch all 19 into one call" still 429s identically to firing 19
 * separate requests — it just fails in one shot instead of eleven. Batching alone
 * does not fix this; only requesting fewer symbols does.
 *
 * The fix: don't cross-check tickers that didn't move. The cross-check exists to
 * stop a wrong-looking *notable* number reaching a human as trustworthy — a ticker
 * that moved 0.1% isn't going to be reported regardless, so spending a scarce
 * credit verifying it is waste. Only tickers whose Finnhub % change clears
 * CROSS_CHECK_THRESHOLD_PCT get a Twelve Data lookup, capped at
 * MAX_CROSS_CHECK_PER_RUN so an unusually volatile day can never exceed the
 * 8-credit/minute budget.
 */

export const TRACKED_TICKERS = [
  "NVDA",
  "MSFT",
  "GOOGL",
  "META",
  "AMZN",
  "AAPL",
  "AMD",
  "ORCL",
  "CRM",
  "SNOW",
  "PLTR",
  "SMCI",
  "ARM",
  "TSM",
  "AVGO",
  "MU",
  "IBM",
  "INTC",
  "DELL",
] as const;

/** Below this, a move isn't going to be reported anyway — don't spend a credit on it. */
const CROSS_CHECK_THRESHOLD_PCT = 1;
/** Twelve Data free tier: 8 credits/minute, 1 credit per symbol. Leave one credit of margin. */
const MAX_CROSS_CHECK_PER_RUN = 7;
/** Cross-provider disagreement beyond this many percentage points holds the ticker. */
const DISAGREEMENT_TOLERANCE_PP = 1.5;
/** A single-day move this large is more likely bad data (or a split) than real. */
const IMPLAUSIBLE_MOVE_PCT = 20;

export type StockQuote = {
  ticker: string;
  percentChange: number | null;
  finnhub: unknown;
  twelvedata: unknown;
  headline: string | null;
  /** Was this ticker's move large enough that a cross-check was attempted at all? */
  crossChecked: boolean;
  flagged: boolean;
  flagReason: string | null;
};

export function stocksConfigured(): boolean {
  return Boolean(env.finnhubApiKey && env.twelvedataApiKey);
}

type FinnhubQuote = { c: number; d: number | null; dp: number | null; h: number; l: number; o: number; pc: number; t: number };
type FinnhubNews = Array<{ headline: string; source: string; datetime: number }>;
type TwelveDataQuote = { percent_change?: string; close?: string; previous_close?: string; status?: string };

/**
 * Finnhub's own "no data for this symbol" sentinel is `dp: null` (confirmed live —
 * NOT `dp: 0`, which is a real, distinct value meaning "unchanged today"). This
 * check is a defensive backstop for the case where a symbol resolves but every
 * price field is degenerate zero, which the null-check alone wouldn't catch.
 */
function isDegenerateFinnhubQuote(q: FinnhubQuote): boolean {
  return q.c === 0 && q.h === 0 && q.l === 0 && q.o === 0 && q.pc === 0;
}

function finnhubPercent(q: FinnhubQuote | null): number | null {
  if (!q || q.dp === null || isDegenerateFinnhubQuote(q)) return null;
  return q.dp;
}

async function fetchFinnhubQuote(ticker: string): Promise<FinnhubQuote> {
  const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${env.finnhubApiKey}`);
  if (!res.ok) throw new Error(`Finnhub quote ${ticker}: ${res.status}`);
  return (await res.json()) as FinnhubQuote;
}

async function fetchFinnhubHeadline(ticker: string): Promise<string | null> {
  try {
    const to = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const res = await fetch(
      `https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${from}&to=${to}&token=${env.finnhubApiKey}`,
    );
    if (!res.ok) return null;
    const news = (await res.json()) as FinnhubNews;
    return news[0]?.headline ?? null;
  } catch {
    return null; // Nice-to-have "why" line — never worth failing the quote over.
  }
}

/** One HTTP call for the given symbols — caller is responsible for staying <=8 total. */
async function fetchTwelveDataBatch(
  tickers: readonly string[],
): Promise<Record<string, TwelveDataQuote>> {
  const res = await fetch(
    `https://api.twelvedata.com/quote?symbol=${tickers.join(",")}&apikey=${env.twelvedataApiKey}`,
  );
  if (!res.ok) throw new Error(`Twelve Data batch quote: ${res.status}`);
  const body = (await res.json()) as Record<string, TwelveDataQuote> | TwelveDataQuote;
  return tickers.length === 1 ? { [tickers[0]]: body as TwelveDataQuote } : (body as Record<string, TwelveDataQuote>);
}

function resolveQuote(
  ticker: string,
  finnhub: FinnhubQuote | null,
  headline: string | null,
  crossChecked: boolean,
  twelvedata: TwelveDataQuote | null,
): StockQuote {
  const finnhubPct = finnhubPercent(finnhub);

  if (finnhubPct === null && !twelvedata) {
    return { ticker, percentChange: null, finnhub, twelvedata: null, headline: null, crossChecked, flagged: true, flagReason: "no usable data from either provider" };
  }

  const twelvedataPct =
    twelvedata?.percent_change && twelvedata.status !== "error"
      ? Number.parseFloat(twelvedata.percent_change)
      : null;

  let flagged = false;
  let flagReason: string | null = null;

  if (crossChecked) {
    if (finnhubPct !== null && twelvedataPct !== null) {
      const diff = Math.abs(finnhubPct - twelvedataPct);
      if (diff > DISAGREEMENT_TOLERANCE_PP) {
        flagged = true;
        flagReason = `providers disagree by ${diff.toFixed(1)}pp (finnhub ${finnhubPct}%, twelvedata ${twelvedataPct}%)`;
      }
    } else {
      // We deliberately spent a credit to verify this one and still came up short —
      // that's a real gap, unlike a ticker we never tried to cross-check at all.
      flagged = true;
      flagReason = "selected for cross-check but one provider returned no usable data";
    }
  }

  const percentChange = finnhubPct ?? twelvedataPct;
  if (!flagged && percentChange !== null && Math.abs(percentChange) > IMPLAUSIBLE_MOVE_PCT) {
    flagged = true;
    flagReason = `|% change| ${percentChange.toFixed(1)}% exceeds plausibility threshold — verify before publishing`;
  }

  return { ticker, percentChange, finnhub, twelvedata, headline, crossChecked, flagged, flagReason };
}

/**
 * Fetches the full tracked basket. Finnhub runs for every ticker (60 req/min free
 * tier easily covers 19 concurrent calls). Twelve Data is spent only on tickers
 * whose Finnhub move clears CROSS_CHECK_THRESHOLD_PCT, capped at
 * MAX_CROSS_CHECK_PER_RUN — see file header for why "cross-check everything" isn't
 * viable on the free tier.
 */
export async function gatherStockQuotes(
  tickers: readonly string[] = TRACKED_TICKERS,
): Promise<StockQuote[]> {
  if (!stocksConfigured()) return [];

  const finnhubResults = await Promise.all(
    tickers.map(async (ticker) => {
      const [quote, headline] = await Promise.allSettled([
        fetchFinnhubQuote(ticker),
        fetchFinnhubHeadline(ticker),
      ]);
      return {
        ticker,
        quote: quote.status === "fulfilled" ? quote.value : null,
        headline: headline.status === "fulfilled" ? headline.value : null,
      };
    }),
  );

  const worthChecking = finnhubResults
    .map((r) => ({ ...r, pct: finnhubPercent(r.quote) }))
    .filter((r) => r.pct !== null && Math.abs(r.pct) >= CROSS_CHECK_THRESHOLD_PCT)
    .sort((a, b) => Math.abs(b.pct!) - Math.abs(a.pct!))
    .slice(0, MAX_CROSS_CHECK_PER_RUN)
    .map((r) => r.ticker);

  const twelvedataBatch =
    worthChecking.length > 0
      ? await fetchTwelveDataBatch(worthChecking).catch((error) => {
          console.warn("[stocks] Twelve Data cross-check batch failed:", error);
          return {} as Record<string, TwelveDataQuote>;
        })
      : {};

  return finnhubResults.map(({ ticker, quote, headline }) => {
    const crossChecked = worthChecking.includes(ticker);
    return resolveQuote(ticker, quote, headline, crossChecked, crossChecked ? (twelvedataBatch[ticker] ?? null) : null);
  });
}

/** Matches renderDigestEmail's own "notable mover" threshold — same bar, one place. */
const NOTABLE_MOVE_PCT = 2;

/**
 * For the homepage's "This day" module — today's already-persisted moves, not a
 * live re-fetch. A missing/unreachable DB degrades to an empty list (module
 * renders nothing for stocks that day), matching lib/content/blog.ts's own
 * degrade-gracefully pattern for a DB that isn't configured yet.
 */
export async function getNotableStockMoves(date: string): Promise<StockQuote[]> {
  try {
    const rows = await getDb().select().from(stockQuotesTable).where(eq(stockQuotesTable.date, date));
    return rows
      .filter((r) => r.percentChange !== null && Math.abs(r.percentChange) >= NOTABLE_MOVE_PCT)
      .map((r) => ({
        ticker: r.ticker,
        percentChange: r.percentChange,
        finnhub: r.finnhubData,
        twelvedata: r.twelvedataData,
        headline: null,
        crossChecked: r.twelvedataData !== null,
        flagged: r.flagged,
        flagReason: r.flagReason,
      }))
      .sort((a, b) => Math.abs(b.percentChange!) - Math.abs(a.percentChange!));
  } catch (error) {
    console.error("[stocks] could not load today's notable stock moves:", error);
    return [];
  }
}

/**
 * For <StockStrip> — ticker + % change only, for the tickers the post itself named
 * relevant (posts.relevantTickers). Joins through digests.blogPostSlug to get the
 * digest's actual research date, NOT post.date/posts.publishedAt: for a DB-native
 * post, publishedAt is set at human-approval time, which can be days after the
 * digest's real research date since review has no SLA — filtering stockQuotes by
 * post.date risks showing a different day's real numbers under this post's byline.
 * See lib/content/blog.ts / lib/content/archive.ts for the same fix applied there.
 */
export async function getStockStripQuotes(
  postSlug: string,
  tickers: string[],
): Promise<Pick<StockQuote, "ticker" | "percentChange">[]> {
  if (tickers.length === 0) return [];
  try {
    const db = getDb();
    const [digest] = await db
      .select({ date: digestsTable.date })
      .from(digestsTable)
      .where(eq(digestsTable.blogPostSlug, postSlug))
      .limit(1);
    if (!digest) return [];

    const rows = await db
      .select({ ticker: stockQuotesTable.ticker, percentChange: stockQuotesTable.percentChange })
      .from(stockQuotesTable)
      .where(and(eq(stockQuotesTable.date, digest.date), inArray(stockQuotesTable.ticker, tickers)));
    return rows;
  } catch (error) {
    console.error("[stocks] could not load stock strip quotes:", error);
    return [];
  }
}
