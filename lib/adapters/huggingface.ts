import { env } from "@/lib/env";
import { SOURCE_WEIGHTS } from "@/lib/sources";
import type { IngestAdapter, RawItem } from "@/lib/adapters/types";

/**
 * Hugging Face Hub API. Open endpoints — HF_TOKEN is optional and only raises rate
 * limits / exposes gated repos.
 *
 *   GET https://huggingface.co/api/models?sort=lastModified&direction=-1&limit=50
 *
 * Known gap: the Hub API has no clean, documented `sort=trending`. The trending list
 * on the website is served by an internal endpoint (`/models-json?sort=trending`)
 * which is undocumented and can change without notice — see `hfTrendingAdapter`
 * below, which is best-effort and fails soft.
 */

const API = "https://huggingface.co/api/models";

/**
 * The Hub's recently-modified stream is overwhelmingly empty and abandoned repos:
 * of the 500 most recently touched models, roughly 10 have meaningful download
 * counts (measured 2026-08-09). Hence the wide scan and the hard floor — a smaller
 * scan returns almost nothing after filtering.
 */
const MIN_DOWNLOADS = 500;
const RECENT_SCAN_LIMIT = 500;

type HfModel = {
  id: string;
  author?: string;
  downloads?: number;
  likes?: number;
  trendingScore?: number;
  lastModified?: string;
  createdAt?: string;
  pipeline_tag?: string;
  tags?: string[];
};

function headers(): HeadersInit {
  const h: Record<string, string> = {
    "user-agent": "Engineerious/1.0 (+https://engineerious.com)",
    accept: "application/json",
  };
  if (env.hfToken) h.authorization = `Bearer ${env.hfToken}`;
  return h;
}

function toRawItem(model: HfModel, sourceSlug: string): RawItem {
  const parts = model.id.split("/");
  const org = parts.length > 1 ? parts[0] : "Hugging Face";
  const descriptors = [model.pipeline_tag, ...(model.tags ?? []).slice(0, 3)].filter(Boolean);

  return {
    type: "model",
    title: model.id,
    url: `https://huggingface.co/${model.id}`,
    summary: descriptors.length ? descriptors.join(" · ") : null,
    source: org,
    sourceSlug,
    sourceWeight: SOURCE_WEIGHTS.huggingface,
    author: model.author ?? org,
    // Likes are the closest thing the Hub has to a vote. Downloads are volume, not
    // endorsement, so they stay in raw_json and out of the ranking numerator.
    points: model.likes ?? 0,
    publishedAt: model.lastModified ? new Date(model.lastModified) : null,
    raw: {
      downloads: model.downloads,
      likes: model.likes,
      trendingScore: model.trendingScore,
      pipeline_tag: model.pipeline_tag,
      tags: model.tags,
      createdAt: model.createdAt,
    },
  };
}

async function listModels(params: Record<string, string>): Promise<HfModel[]> {
  const url = new URL(API);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("full", "false");

  const res = await fetch(url, { headers: headers(), cache: "no-store" });
  if (!res.ok) throw new Error(`Hugging Face ${url.pathname}: ${res.status} ${res.statusText}`);
  return (await res.json()) as HfModel[];
}

/** Recently updated models with enough traction to be worth a row. */
export const hfRecentAdapter: IngestAdapter = {
  slug: "huggingface-recent",
  name: "Hugging Face",
  type: "model",
  enabled: () => true,
  async fetch() {
    const models = await listModels({
      sort: "lastModified",
      direction: "-1",
      limit: String(RECENT_SCAN_LIMIT),
    });
    return models
      .filter((m) => (m.downloads ?? 0) >= MIN_DOWNLOADS)
      .map((m) => toRawItem(m, "huggingface-recent"));
  },
};

/** Most-downloaded models of the moment — the "what everyone is running" cut. */
export const hfPopularAdapter: IngestAdapter = {
  slug: "huggingface-popular",
  name: "Hugging Face",
  type: "model",
  enabled: () => true,
  async fetch() {
    const models = await listModels({ sort: "downloads", direction: "-1", limit: "50" });
    return models.map((m) => toRawItem(m, "huggingface-popular"));
  },
};

/**
 * Best-effort trending. `sort=trendingScore` is accepted by the API today but is not
 * part of the documented surface; if it stops working, fall back to scraping
 * https://huggingface.co/models-json?sort=trending (also undocumented). Treat an
 * empty result as normal, not as an outage.
 */
export const hfTrendingAdapter: IngestAdapter = {
  slug: "huggingface-trending",
  name: "Hugging Face",
  type: "model",
  enabled: () => true,
  async fetch() {
    try {
      const models = await listModels({ sort: "trendingScore", direction: "-1", limit: "50" });
      return models.map((m) => toRawItem(m, "huggingface-trending"));
    } catch (error) {
      console.warn("[huggingface-trending] undocumented sort failed, skipping:", error);
      return [];
    }
  },
};
