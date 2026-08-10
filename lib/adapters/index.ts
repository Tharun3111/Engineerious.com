import { createRssAdapters } from "@/lib/adapters/rss";
import { hnAlgoliaAdapter } from "@/lib/adapters/hn-algolia";
import { newsApiAdapter } from "@/lib/adapters/news-api";
import {
  hfPopularAdapter,
  hfRecentAdapter,
  hfTrendingAdapter,
} from "@/lib/adapters/huggingface";
import { githubReleasesAdapter, githubSearchAdapter } from "@/lib/adapters/github";
import { productHuntAdapter } from "@/lib/adapters/producthunt";
import { MODEL_RSS_SOURCES, RSS_SOURCES } from "@/lib/sources";
import type { IngestAdapter } from "@/lib/adapters/types";

/** /api/cron/news — RSS backbone + HN + optional commercial news API. */
export function newsAdapters(): IngestAdapter[] {
  return [...createRssAdapters(RSS_SOURCES), hnAlgoliaAdapter, newsApiAdapter];
}

/** /api/cron/models — Hugging Face Hub + lab release feeds. */
export function modelAdapters(): IngestAdapter[] {
  return [
    hfRecentAdapter,
    hfPopularAdapter,
    hfTrendingAdapter,
    ...createRssAdapters(MODEL_RSS_SOURCES),
  ];
}

/** /api/cron/oss — GitHub search + tracked releases + optional Product Hunt. */
export function ossAdapters(): IngestAdapter[] {
  return [githubSearchAdapter, githubReleasesAdapter, productHuntAdapter];
}

export function allAdapters(): IngestAdapter[] {
  return [...newsAdapters(), ...modelAdapters(), ...ossAdapters()];
}

export type { IngestAdapter, RawItem, AdapterResult } from "@/lib/adapters/types";
