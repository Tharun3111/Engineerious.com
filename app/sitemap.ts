import type { MetadataRoute } from "next";

import { getArchiveIndex } from "@/lib/content/archive";
import { getPublishedPosts } from "@/lib/content/blog";
import {
  getDailyBriefArchive,
  type PublicDailyBrief,
} from "@/lib/daily-queries";
import { env } from "@/lib/env";
import { PILLAR_SLUGS } from "@/lib/pillars";
import { projects } from "@/lib/projects";

export function buildDailySitemapEntries(
  site: string,
  briefs: PublicDailyBrief[],
): MetadataRoute.Sitemap {
  const latest = briefs[0];
  if (!latest) return [];

  return [
    {
      url: `${site}/daily`,
      lastModified: latest.publishedAt,
      changeFrequency: "daily",
      priority: 0.9,
    },
    ...briefs.map((entry) => ({
      url: `${site}/daily/${entry.date}`,
      lastModified: entry.publishedAt,
      changeFrequency: "never" as const,
      priority: 0.75,
    })),
  ];
}

/**
 * Static routes plus blog and pillar pages. Item detail pages are deliberately out:
 * they are thin permalinks around an outbound link, and indexing tens of thousands of
 * them is how an aggregator earns a thin-content penalty.
 *
 * /open-source and pillar pages track the same PUBLIC_RESEARCH_ENABLED gate as
 * proxy.ts and app/robots.ts. /resources is deliberately absent even when
 * the gate is on: it is placeholder content and is always closed. /submit is a
 * utility form, not a search landing page.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = env.siteUrl.replace(/\/$/, "");
  const now = new Date();
  const [posts, archiveDays, dailyArchive] = await Promise.all([
    getPublishedPosts(),
    getArchiveIndex(),
    getDailyBriefArchive(100),
  ]);
  const dailyEntries = buildDailySitemapEntries(site, dailyArchive.briefs);

  const gated: MetadataRoute.Sitemap = env.publicResearchEnabled
    ? [
        { url: `${site}/open-source`, lastModified: now, changeFrequency: "daily" as const, priority: 0.7 },
        ...PILLAR_SLUGS.map((slug) => ({
          url: `${site}/pillars/${slug}`,
          lastModified: now,
          changeFrequency: "weekly" as const,
          priority: 0.7,
        })),
      ]
    : [];

  return [
    { url: `${site}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${site}/blog`, lastModified: now, changeFrequency: "weekly" as const, priority: 0.9 },
    { url: `${site}/archive`, lastModified: now, changeFrequency: "daily" as const, priority: 0.6 },
    // Per-day pages are self-canonical (they show a summary + link, not the full post
    // body, so it's genuinely distinct content, not a duplicate of /blog/[slug]) — low
    // priority since it's a browse-by-date view, not competing with the primary permalink.
    ...archiveDays.map((day) => ({
      url: `${site}/archive/${day.date}`,
      lastModified: now,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
    ...posts.map((post) => ({
        url: `${site}/blog/${post.slug}`,
        lastModified: post.date,
        changeFrequency: "monthly" as const,
        priority: 0.8,
      })),
    ...dailyEntries,
    { url: `${site}/projects`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.8 },
    ...projects.map((project) => ({
      url: `${site}/projects/${project.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.75,
    })),
    ...gated,
    { url: `${site}/about`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.8 },
    { url: `${site}/subscribe`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.7 },
    { url: `${site}/editorial-standards`, lastModified: now, changeFrequency: "yearly" as const, priority: 0.4 },
    { url: `${site}/corrections`, lastModified: now, changeFrequency: "yearly" as const, priority: 0.4 },
    { url: `${site}/ethics`, lastModified: now, changeFrequency: "yearly" as const, priority: 0.4 },
  ];
}
