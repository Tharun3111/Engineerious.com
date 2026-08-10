import { SOURCE_WEIGHTS } from "@/lib/sources";
import { hostname } from "@/lib/dedupe";
import type { IngestAdapter, RawItem } from "@/lib/adapters/types";

/**
 * Hacker News via the Algolia search API. Free, no key, no auth — the cheapest read
 * on what practitioners are actually clicking. Docs: https://hn.algolia.com/api
 *
 * We take `search_by_date` rather than relevance-sorted `search` so ingestion is
 * incremental and our own ranking (not Algolia's) decides ordering.
 */

const ENDPOINT = "https://hn.algolia.com/api/v1/search_by_date";
const QUERIES = ["AI", "LLM", "agents", "RAG"];
const MIN_POINTS = 10; // filter the firehose; HN posts most stories with 0 points

type AlgoliaHit = {
  objectID: string;
  title: string | null;
  url: string | null;
  author: string | null;
  points: number | null;
  num_comments: number | null;
  created_at: string;
};

export const hnAlgoliaAdapter: IngestAdapter = {
  slug: "hn-algolia",
  name: "Hacker News",
  type: "news",
  enabled: () => true,
  async fetch(): Promise<RawItem[]> {
    const items: RawItem[] = [];

    for (const query of QUERIES) {
      const url = new URL(ENDPOINT);
      url.searchParams.set("tags", "story");
      url.searchParams.set("query", query);
      url.searchParams.set("hitsPerPage", "50");
      url.searchParams.set("numericFilters", `points>=${MIN_POINTS}`);

      const res = await fetch(url, {
        headers: { "user-agent": "Engineerious/1.0 (+https://engineerious.com)" },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HN Algolia ${query}: ${res.status} ${res.statusText}`);

      const body = (await res.json()) as { hits?: AlgoliaHit[] };
      for (const hit of body.hits ?? []) {
        // Link-less posts (Ask HN / text posts) are penalised on HN itself; we drop
        // them entirely because Engineerious rows are outbound links.
        if (!hit.url || !hit.title) continue;
        items.push({
          type: "news",
          title: hit.title.trim(),
          url: hit.url,
          summary: null,
          source: hostname(hit.url) || "Hacker News",
          sourceSlug: "hn-algolia",
          sourceWeight: SOURCE_WEIGHTS.hnAlgolia,
          author: hit.author,
          points: hit.points ?? 0,
          publishedAt: new Date(hit.created_at),
          raw: {
            objectID: hit.objectID,
            comments: hit.num_comments,
            discussion: `https://news.ycombinator.com/item?id=${hit.objectID}`,
          },
        });
      }
    }

    return items;
  },
};
