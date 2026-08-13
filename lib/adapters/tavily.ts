import { env } from "@/lib/env";

/**
 * Tavily search — the live-web layer of the daily GATHER stage. The existing
 * RSS/HN/GitHub/HF adapters (lib/adapters/{rss,hn-algolia,github,huggingface}.ts)
 * catch everything published through official channels; Tavily catches what those
 * structurally can't — third-party coverage, incidents, comparisons — with real
 * extracted page content attached (not just a title+snippet), so the RESEARCH stage
 * can ground claims in actual text instead of guessing from a headline.
 *
 * Free tier: 1,000 credits/month, no card. A `basic` search = 1 credit. Capped well
 * under that here so a daily run never risks the account tipping into paid overage.
 */

const API = "https://api.tavily.com/search";
const MAX_QUERIES_PER_RUN = 15; // ~450/month at 1 run/day — comfortably inside the 1,000 free

/**
 * Fixed sweep covering the site's actual pillars plus general frontier coverage.
 * `days: 2` biases toward what's genuinely new without being so tight that a slow
 * news day returns nothing. Kept well under MAX_QUERIES_PER_RUN so there's headroom
 * to add topical queries later without hitting the cap.
 */
export const RESEARCH_QUERIES = [
  "new AI model release",
  "LLM benchmark results",
  "AI agent framework",
  "production AI incident OR outage",
  "AI engineering best practices",
  "retrieval augmented generation production",
  "Model Context Protocol MCP",
  "AI research paper breakthrough",
  "open source AI tool launch",
  "AI safety incident",
  "LLM evaluation framework",
  "AI infrastructure GPU inference",
] as const;

export type TavilyResult = {
  url: string;
  title: string;
  /** Short excerpt Tavily itself extracts — always present. */
  content: string;
  /** Full page content as markdown, only when requested — this is the grounding text. */
  rawContent: string | null;
  score: number;
};

export type GatherResult = {
  query: string;
  results: TavilyResult[];
};

export function tavilyConfigured(): boolean {
  return Boolean(env.tavilyApiKey);
}

type TavilyApiResponse = {
  results?: Array<{
    url: string;
    title: string;
    content: string;
    raw_content?: string | null;
    score: number;
  }>;
};

async function search(query: string): Promise<TavilyResult[]> {
  const res = await fetch(API, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      api_key: env.tavilyApiKey,
      query,
      search_depth: "basic",
      topic: "news",
      days: 2,
      max_results: 5,
      include_raw_content: "markdown",
    }),
  });

  if (!res.ok) throw new Error(`Tavily search "${query}": ${res.status} ${await res.text()}`);

  const body = (await res.json()) as TavilyApiResponse;
  return (body.results ?? []).map((r) => ({
    url: r.url,
    title: r.title,
    content: r.content,
    rawContent: r.raw_content ?? null,
    score: r.score,
  }));
}

/**
 * Runs the fixed query sweep. One failed query does not abort the run — it's
 * dropped and logged, same isolation principle as lib/ingest.ts's adapter runner.
 * Returns credits used (1 per successful `basic` search) so the caller can persist
 * it to research_runs.tavilyCreditsUsed for budget tracking over time.
 */
export async function gatherResearch(
  queries: readonly string[] = RESEARCH_QUERIES,
): Promise<{ gathered: GatherResult[]; creditsUsed: number; errors: string[] }> {
  if (!tavilyConfigured()) {
    return { gathered: [], creditsUsed: 0, errors: ["Tavily is not configured"] };
  }

  const capped = queries.slice(0, MAX_QUERIES_PER_RUN);
  const errors: string[] = [];

  const settled = await Promise.allSettled(capped.map((query) => search(query)));

  const gathered: GatherResult[] = [];
  let creditsUsed = 0;

  settled.forEach((result, i) => {
    if (result.status === "fulfilled") {
      gathered.push({ query: capped[i], results: result.value });
      creditsUsed += 1;
    } else {
      const message = result.reason instanceof Error ? result.reason.message : String(result.reason);
      errors.push(message);
      console.warn(`[tavily] query failed: ${capped[i]}:`, message);
    }
  });

  return { gathered, creditsUsed, errors };
}
