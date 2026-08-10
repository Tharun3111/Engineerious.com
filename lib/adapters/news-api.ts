import { env } from "@/lib/env";
import { hostname } from "@/lib/dedupe";
import { SOURCE_WEIGHTS } from "@/lib/sources";
import type { IngestAdapter, RawItem } from "@/lib/adapters/types";

/**
 * Optional commercial news API — the fill-in layer behind RSS + HN.
 *
 * LICENSING, READ BEFORE ENABLING:
 *   ✅ Newsdata.io, Currents, APITube — free tiers permit commercial use (~1,000
 *      requests/day). These are the only providers wired up here.
 *   ❌ NewsAPI.org — free "Developer" tier is development-only and MUST NOT be used
 *      in production.
 *   ❌ GNews — free tier prohibits commercial use.
 * Terms change; re-check the provider's current ToS before shipping.
 *
 * Enable with NEWS_API_PROVIDER=newsdata|currents|apitube and NEWS_API_KEY=...
 * Leave both unset and this adapter reports itself disabled and is skipped.
 */

const PROVIDERS = ["newsdata", "currents", "apitube"] as const;
type Provider = (typeof PROVIDERS)[number];

const QUERY = "artificial intelligence OR LLM OR machine learning";

function provider(): Provider | null {
  const p = env.newsApiProvider?.toLowerCase();
  return PROVIDERS.includes(p as Provider) ? (p as Provider) : null;
}

type Normalised = {
  title: string;
  url: string;
  summary: string | null;
  source: string;
  author: string | null;
  publishedAt: Date | null;
};

async function fetchJson(url: URL, headers: HeadersInit = {}): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "user-agent": "Engineerious/1.0", ...headers },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`news-api ${url.host}: ${res.status} ${res.statusText}`);
  return res.json();
}

async function fetchNewsdata(key: string): Promise<Normalised[]> {
  const url = new URL("https://newsdata.io/api/1/latest");
  url.searchParams.set("apikey", key);
  url.searchParams.set("q", QUERY);
  url.searchParams.set("language", "en");
  url.searchParams.set("category", "technology");

  const body = (await fetchJson(url)) as {
    results?: Array<{
      title?: string;
      link?: string;
      description?: string;
      source_id?: string;
      creator?: string[] | null;
      pubDate?: string;
    }>;
  };

  return (body.results ?? [])
    .filter((a) => a.title && a.link)
    .map((a) => ({
      title: a.title!,
      url: a.link!,
      summary: a.description ?? null,
      source: a.source_id ?? hostname(a.link!),
      author: a.creator?.[0] ?? null,
      publishedAt: a.pubDate ? new Date(`${a.pubDate}Z`) : null,
    }));
}

async function fetchCurrents(key: string): Promise<Normalised[]> {
  const url = new URL("https://api.currentsapi.services/v1/search");
  url.searchParams.set("keywords", QUERY);
  url.searchParams.set("language", "en");

  const body = (await fetchJson(url, { authorization: key })) as {
    news?: Array<{
      title?: string;
      url?: string;
      description?: string;
      author?: string;
      published?: string;
    }>;
  };

  return (body.news ?? [])
    .filter((a) => a.title && a.url)
    .map((a) => ({
      title: a.title!,
      url: a.url!,
      summary: a.description ?? null,
      source: hostname(a.url!),
      author: a.author ?? null,
      publishedAt: a.published ? new Date(a.published) : null,
    }));
}

async function fetchApitube(key: string): Promise<Normalised[]> {
  const url = new URL("https://api.apitube.io/v1/news/everything");
  url.searchParams.set("api_key", key);
  url.searchParams.set("title", QUERY);
  url.searchParams.set("language.code", "en");
  url.searchParams.set("limit", "50");

  const body = (await fetchJson(url)) as {
    results?: Array<{
      title?: string;
      href?: string;
      description?: string;
      source?: { domain?: string };
      author?: { name?: string } | null;
      published_at?: string;
    }>;
  };

  return (body.results ?? [])
    .filter((a) => a.title && a.href)
    .map((a) => ({
      title: a.title!,
      url: a.href!,
      summary: a.description ?? null,
      source: a.source?.domain ?? hostname(a.href!),
      author: a.author?.name ?? null,
      publishedAt: a.published_at ? new Date(a.published_at) : null,
    }));
}

export const newsApiAdapter: IngestAdapter = {
  slug: "news-api",
  name: "News API",
  type: "news",
  enabled: () => Boolean(env.newsApiKey && provider()),
  async fetch(): Promise<RawItem[]> {
    const p = provider();
    const key = env.newsApiKey;
    if (!p || !key) return [];

    const articles =
      p === "newsdata"
        ? await fetchNewsdata(key)
        : p === "currents"
          ? await fetchCurrents(key)
          : await fetchApitube(key);

    return articles.map((a) => ({
      type: "news" as const,
      title: a.title.trim(),
      url: a.url,
      summary: a.summary,
      source: a.source,
      sourceSlug: "news-api",
      sourceWeight: SOURCE_WEIGHTS.newsApi,
      author: a.author,
      points: 0,
      publishedAt: a.publishedAt,
      raw: { provider: p },
    }));
  },
};
