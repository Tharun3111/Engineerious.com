import type { ItemType } from "@/db/schema";

/**
 * Source registry. `weight` is authority, and it is the only thing separating a
 * primary-lab announcement from a rewrite of it before any votes exist. Keep the
 * scale tight (1–5) or decay stops mattering.
 *
 *   5  primary lab / first-party release
 *   3  high-signal practitioner publication
 *   2  general tech press with real AI desks
 *   1  firehose (arXiv, HN, search APIs)
 */
export type FeedSource = {
  slug: string;
  name: string;
  type: ItemType;
  url: string;
  weight: number;
  enabled?: boolean;
};

export const RSS_SOURCES: FeedSource[] = [
  // --- Primary labs -------------------------------------------------------
  // Verified reachable 2026-08-09. Two notable gaps:
  //   • Anthropic publishes no public RSS — /rss.xml, /news/rss.xml, /feed.xml and
  //     /index.xml all 404. Their announcements arrive via HN and MarkTechPost
  //     instead. Re-check periodically; add an entry here the day it exists.
  //   • ai.meta.com/blog has no feed either, so Meta comes in through the
  //     engineering.fb.com ML category feed below.
  { slug: "openai-news", name: "OpenAI", type: "news", url: "https://openai.com/news/rss.xml", weight: 5 },
  { slug: "google-research", name: "Google Research", type: "news", url: "https://research.google/blog/rss/", weight: 4 },
  { slug: "deepmind", name: "Google DeepMind", type: "news", url: "https://deepmind.google/blog/rss.xml", weight: 4 },
  { slug: "meta-engineering", name: "Meta Engineering", type: "news", url: "https://engineering.fb.com/category/ml-applications/feed/", weight: 4 },
  { slug: "hf-blog", name: "Hugging Face", type: "news", url: "https://huggingface.co/blog/feed.xml", weight: 4 },

  // --- Practitioner press -------------------------------------------------
  { slug: "marktechpost", name: "MarkTechPost", type: "news", url: "https://www.marktechpost.com/feed/", weight: 3 },
  { slug: "venturebeat-ai", name: "VentureBeat AI", type: "news", url: "https://venturebeat.com/category/ai/feed/", weight: 2 },
  { slug: "wired-ai", name: "WIRED AI", type: "news", url: "https://www.wired.com/feed/tag/ai/latest/rss", weight: 2 },
  { slug: "the-verge-ai", name: "The Verge AI", type: "news", url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", weight: 2 },

  // --- Research firehose --------------------------------------------------
  // arXiv returns a valid but empty feed at weekends — no new listings are
  // published. An empty result from these two is normal, not an outage.
  { slug: "arxiv-cs-ai", name: "arXiv cs.AI", type: "news", url: "https://rss.arxiv.org/rss/cs.AI", weight: 1 },
  { slug: "arxiv-cs-cl", name: "arXiv cs.CL", type: "news", url: "https://rss.arxiv.org/rss/cs.CL", weight: 1 },
];

/**
 * Lab release feeds routed into the /models section rather than /news. Same RSS
 * adapter, different `type`, so a model announcement lands where people look for
 * models.
 *
 * Empty on purpose today: no frontier lab publishes a model-release-only feed.
 * OpenAI's per-category feeds (/news/product-releases/rss.xml) return 403, and
 * pointing a model source at a lab's general feed would collide with RSS_SOURCES on
 * url_hash — whichever cron ran first would win, and the item would land in an
 * arbitrary section. The /models feed is therefore Hugging Face driven.
 *
 * To add one when it exists, copy the shape below and set `enabled: true`.
 */
export const MODEL_RSS_SOURCES: FeedSource[] = [
  // { slug: "some-lab-releases", name: "Some Lab", type: "model", url: "…", weight: 5 },
];

/** AI topics used to build the GitHub search query. Keep short — search is rate limited. */
export const GITHUB_TOPICS = [
  "llm",
  "agents",
  "rag",
  "mcp",
  "llmops",
  "generative-ai",
  "vector-database",
];

/** Repos we always want release notes for, regardless of what search surfaces. */
export const GITHUB_TRACKED_REPOS = [
  "modelcontextprotocol/servers",
  "langchain-ai/langchain",
  "run-llama/llama_index",
  "vllm-project/vllm",
  "ggml-org/llama.cpp",
  "openai/openai-python",
  "anthropics/anthropic-sdk-python",
  "huggingface/transformers",
];

export const SOURCE_WEIGHTS = {
  hnAlgolia: 1,
  githubSearch: 2,
  githubRelease: 3,
  huggingface: 3,
  productHunt: 2,
  newsApi: 1,
  submission: 1,
} as const;
