import { getPublishedPosts } from "@/lib/content/blog";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const revalidate = 900;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Original, authenticity-verified writing only. Automated discovery feeds stay
 * private until they pass their separate product and editorial gate.
 */
export async function GET() {
  const site = env.siteUrl.replace(/\/$/, "");
  const posts = getPublishedPosts();

  const entries = posts
    .map((post) => ({
      title: post.title,
      link: `${site}/blog/${post.slug}`,
      guid: `${site}/blog/${post.slug}`,
      description: post.dek,
      date: post.date,
      category: "blog",
    }))
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Engineerious</title>
    <link>${site}</link>
    <description>Verified notes on practical AI engineering by Tharun Chowdary.</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${site}/rss.xml" rel="self" type="application/rss+xml" />
${entries
  .map(
    (entry) => `    <item>
      <title>${escapeXml(entry.title)}</title>
      <link>${escapeXml(entry.link)}</link>
      <guid isPermaLink="false">${escapeXml(entry.guid)}</guid>
      <category>${entry.category}</category>
      <description>${escapeXml(entry.description)}</description>
      <pubDate>${entry.date.toUTCString()}</pubDate>
    </item>`,
  )
  .join("\n")}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=900, stale-while-revalidate=3600",
    },
  });
}
