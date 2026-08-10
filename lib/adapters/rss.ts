import Parser from "rss-parser";

import type { FeedSource } from "@/lib/sources";
import type { IngestAdapter, RawItem } from "@/lib/adapters/types";

const parser = new Parser({
  timeout: 15_000,
  headers: { "user-agent": "Engineerious/1.0 (+https://engineerious.com)" },
});

/**
 * Some feeds serve their whole archive — OpenAI's is over 1,100 entries and Hugging
 * Face's over 800. Re-upserting those every hour is pure waste, and anything older
 * than the newest few dozen has a score of effectively zero anyway. Take the newest
 * slice and move on.
 */
const MAX_ITEMS_PER_FEED = 60;

/** Strip HTML and collapse whitespace — feed descriptions are full of markup. */
function toPlainText(html: string | undefined, max = 320): string | null {
  if (!html) return null;
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function createRssAdapter(source: FeedSource): IngestAdapter {
  return {
    slug: source.slug,
    name: source.name,
    type: source.type,
    enabled: () => source.enabled !== false,
    async fetch(): Promise<RawItem[]> {
      const feed = await parser.parseURL(source.url);
      return (feed.items ?? [])
        .filter((entry) => Boolean(entry.link && entry.title))
        // Do not trust feed ordering — sort by date before truncating.
        .sort(
          (a, b) =>
            (parseDate(b.isoDate ?? b.pubDate)?.getTime() ?? 0) -
            (parseDate(a.isoDate ?? a.pubDate)?.getTime() ?? 0),
        )
        .slice(0, MAX_ITEMS_PER_FEED)
        .map((entry) => ({
          type: source.type,
          title: entry.title!.trim(),
          url: entry.link!,
          summary: toPlainText(entry.contentSnippet ?? entry.content ?? entry.summary),
          source: source.name,
          sourceSlug: source.slug,
          sourceWeight: source.weight,
          author: entry.creator ?? entry.author ?? null,
          points: 0,
          publishedAt: parseDate(entry.isoDate ?? entry.pubDate),
          raw: { guid: entry.guid, categories: entry.categories },
        }));
    },
  };
}

export function createRssAdapters(sources: FeedSource[]): IngestAdapter[] {
  return sources.map(createRssAdapter);
}
