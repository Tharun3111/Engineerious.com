import { z } from "zod";

import { complete } from "@/lib/llm";
import type { Item } from "@/db/schema";
import type { GatherResult } from "@/lib/adapters/tavily";
import { assertUrlsAllowed, httpUrlSchema } from "@/lib/editorial-safety";
import type { StockQuote } from "@/lib/stocks";

/**
 * RESEARCH stage (Sonnet 5) — synthesizes everything GATHER collected into ranked,
 * source-attributed findings. This is the stage that decides what's actually novel
 * vs noise; WRITE (Phase 3) turns its output into prose, so every finding here must
 * carry real source URLs — WRITE is instructed to never state anything this stage
 * didn't ground.
 */

export const findingSchema = z.object({
  title: z.string(),
  summary: z.string(),
  sourceUrls: z.array(httpUrlSchema).min(1),
  category: z.enum(["model_release", "research", "tool_framework", "incident", "industry_news", "technique"]),
  novelty: z.enum(["high", "medium", "low"]),
  relevantPillar: z.enum(["eval-first", "mcp", "rag-mlops"]).nullable().optional(),
});

const findingsResponseSchema = z.object({
  findings: z.array(findingSchema),
  /** Sonnet's own note on coverage gaps — surfaced to the human reviewer, not hidden. */
  coverageNotes: z.string().optional(),
});

export type Finding = z.infer<typeof findingSchema>;
export type ResearchOutput = z.infer<typeof findingsResponseSchema>;

export function parseStoredFindings(value: unknown): Finding[] {
  const parsed = z.array(findingSchema).safeParse(value ?? []);
  if (!parsed.success) {
    throw new Error(`Stored research findings failed schema validation: ${JSON.stringify(parsed.error.issues)}`);
  }
  return parsed.data;
}

const SYSTEM = `You are the research stage of an automated AI-engineering news pipeline. Your job
is to find what is genuinely novel in the material you're given and structure it — not to write
prose, not to adopt any persona. A separate stage handles writing.

Rules, no exceptions:
- Every finding's sourceUrls must be pulled verbatim from the material you were given. Never
  invent a URL, never cite a URL that wasn't in your input.
- Never state a number, a fact, or a claim that isn't directly supported by the material you were
  given. If you're inferring or uncertain, say so in coverageNotes instead of stating it as fact.
- Dedupe: if the same story appears from multiple sources, merge it into one finding with all its
  source URLs, don't list it twice.
- Rank by genuine engineering relevance, not virality — a real production incident or a
  meaningfully new capability outranks a marketing announcement.
- Skip anything that is thin, unverifiable from your material, or purely promotional.
- HARD CAP: at most 15 findings, ranked best-first — if you have more than 15 genuinely good
  candidates, keep only the strongest 15 and note what got cut in coverageNotes. Each summary is
  1-2 sentences, no more than ~40 words. This output has a fixed token budget; a shorter, complete
  JSON response beats a longer one that runs out of room mid-string.
- Output ONLY valid JSON matching this shape, nothing else, no markdown fences:
{"findings":[{"title":string,"summary":string,"sourceUrls":string[],"category":"model_release"|"research"|"tool_framework"|"incident"|"industry_news"|"technique","novelty":"high"|"medium"|"low","relevantPillar":"eval-first"|"mcp"|"rag-mlops"|null}],"coverageNotes":string}`;

function formatGathered(gathered: GatherResult[]): string {
  return gathered
    .map(({ query, results }) => {
      const items = results
        // `||`, not `??` — Tavily returns rawContent as "" (not null/undefined) when
        // extraction fails for a page, and an empty string must still fall back to
        // the always-present short excerpt rather than contributing nothing.
        .map((r) => `  - [${r.title}](${r.url})\n    ${(r.rawContent || r.content).slice(0, 1500)}`)
        .join("\n");
      return `### Search: "${query}"\n${items || "  (no results)"}`;
    })
    .join("\n\n");
}

function formatItems(items: Item[]): string {
  if (items.length === 0) return "(none)";
  return items
    .map((i) => `  - [${i.title}](${i.url}) — ${i.source}${i.summary ? `: ${i.summary}` : ""}`)
    .join("\n");
}

function formatStocks(quotes: StockQuote[]): string {
  const notable = quotes.filter((q) => q.percentChange !== null && Math.abs(q.percentChange) >= 2);
  if (notable.length === 0) return "(no notable moves today)";
  return notable
    .map(
      (q) =>
        `  - ${q.ticker}: ${q.percentChange!.toFixed(2)}%${q.headline ? ` — "${q.headline}"` : ""}${q.flagged ? ` [FLAGGED: ${q.flagReason}]` : ""}`,
    )
    .join("\n");
}

export async function synthesizeResearch(input: {
  gathered: GatherResult[];
  recentItems: Item[];
  stockQuotes: StockQuote[];
}): Promise<ResearchOutput> {
  const prompt = `=== LIVE SEARCH RESULTS ===
${formatGathered(input.gathered)}

=== RECENTLY INGESTED ITEMS (RSS/HN/GitHub/HF — already deduped, already scored) ===
${formatItems(input.recentItems)}

=== NOTABLE STOCK MOVES TODAY (>=2%, for correlating with AI news if genuinely related) ===
${formatStocks(input.stockQuotes)}

Produce the findings JSON now.`;

  // Large: the input prompt can be ~60 search results plus recent items, and
  // confirmed live that too small a budget here returns zero text content rather
  // than a truncated-but-parseable response (see lib/llm.ts's empty-text check).
  const raw = await complete({ system: SYSTEM, prompt, maxTokens: 16000 });

  const jsonText = raw.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    throw new Error(`Research stage returned invalid JSON: ${(error as Error).message}\n---\n${raw.slice(0, 500)}`);
  }

  const result = findingsResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Research stage output failed schema validation: ${JSON.stringify(result.error.issues)}`);
  }

  // Prompt instructions are not an integrity boundary. Prove every returned URL was
  // present in the gathered material before persisting findings or treating them as
  // REVIEW's source of truth.
  const allowedUrls = [
    ...input.gathered.flatMap(({ results }) => results.map((item) => item.url)),
    ...input.recentItems.map((item) => item.url),
  ];
  assertUrlsAllowed(
    result.data.findings.flatMap((finding) => finding.sourceUrls),
    allowedUrls,
    "Research stage",
  );

  return result.data;
}
