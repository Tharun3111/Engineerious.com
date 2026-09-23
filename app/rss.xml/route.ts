import { getPublishedWritingPosts } from "@/lib/content/blog";
import { getDailyBriefArchive } from "@/lib/daily-queries";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const revalidate = 900;

export type RssEntry = {
  title: string;
  link: string;
  description: string;
  date: Date;
  category: "Daily" | "Writing";
};

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildRssXml(site: string, sourceEntries: readonly RssEntry[]): string {
  const entries = sourceEntries
    .filter((entry) => !Number.isNaN(entry.date.getTime()))
    .toSorted((a, b) => b.date.getTime() - a.date.getTime());
  const lastBuildDate = entries[0]?.date.toUTCString();

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Engineerious</title>
    <link>${escapeXml(site)}</link>
    <description>Reviewed AI engineering signal, field notes, and practical production details from Tharun Chowdary Malepati.</description>
    <language>en-US</language>${lastBuildDate ? `
    <lastBuildDate>${lastBuildDate}</lastBuildDate>` : ""}
    <atom:link href="${escapeXml(`${site}/rss.xml`)}" rel="self" type="application/rss+xml" />
${entries
  .map(
    (entry) => `    <item>
      <title>${escapeXml(entry.title)}</title>
      <link>${escapeXml(entry.link)}</link>
      <guid isPermaLink="true">${escapeXml(entry.link)}</guid>
      <category>${entry.category}</category>
      <description>${escapeXml(entry.description)}</description>
      <pubDate>${entry.date.toUTCString()}</pubDate>
    </item>`,
  )
  .join("\n")}
  </channel>
</rss>`;
}

/**
 * One honest subscription surface: verified Writing and immutable, validated
 * Daily snapshots. Discovery items and editorial drafts never enter this feed.
 */
export async function GET() {
  const site = env.siteUrl.replace(/\/$/, "");
  const [posts, dailyResult] = await Promise.all([
    getPublishedWritingPosts(),
    getDailyBriefArchive(100),
  ]);

  const entries: RssEntry[] = [
    ...posts.map((post) => ({
      title: post.title,
      link: `${site}/blog/${post.slug}`,
      description: post.dek,
      date: post.date,
      category: "Writing" as const,
    })),
    ...dailyResult.briefs.map((entry) => ({
      title: entry.brief.title,
      link: `${site}/daily/${entry.date}`,
      description: `${entry.brief.summary} Tharun's Take: ${entry.brief.myTake}`,
      date: entry.publishedAt,
      category: "Daily" as const,
    })),
  ];

  return new Response(buildRssXml(site, entries), {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=900, stale-while-revalidate=3600",
    },
  });
}
