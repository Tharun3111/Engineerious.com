import type { MetadataRoute } from "next";

import { getArchiveIndex } from "@/lib/content/archive";
import { getPublishedWritingPosts } from "@/lib/content/blog";
import { getCuratedAiCorpus } from "@/lib/curated-ai-queries";
import {
  getDailyBriefArchive,
  type PublicDailyBrief,
} from "@/lib/daily-queries";
import { env } from "@/lib/env";
import { projects } from "@/lib/projects";
import {
  getActiveTopics,
  hasUsefulAiContent,
  latestAiActivityAt,
  type TopicSignal,
  type TopicWriting,
} from "@/lib/topics";

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

export function buildAiSitemapEntries(
  site: string,
  writing: readonly TopicWriting[],
  signals: readonly TopicSignal[],
): MetadataRoute.Sitemap {
  if (!hasUsefulAiContent(writing, signals)) return [];
  const latest = latestAiActivityAt(writing, signals);
  if (!latest) return [];

  return [
    {
      url: `${site}/ai`,
      lastModified: latest,
      changeFrequency: "daily",
      priority: 0.85,
    },
    ...getActiveTopics(writing, signals).flatMap((activity) =>
      activity.latestActivityAt
        ? [
            {
              url: `${site}/topics/${activity.topic.slug}`,
              lastModified: activity.latestActivityAt,
              changeFrequency: "weekly" as const,
              priority: 0.7,
            },
          ]
        : [],
    ),
  ];
}

/**
 * Static routes plus public writing, Daily, and reviewed AI pages. Item detail pages are deliberately out:
 * they are thin permalinks around an outbound link, and indexing tens of thousands of
 * them is how an aggregator earns a thin-content penalty.
 *
 * /open-source tracks the same PUBLIC_RESEARCH_ENABLED gate as proxy.ts and
 * app/robots.ts. Thin pillar pages are intentionally absent. /resources is deliberately absent even when
 * the gate is on: it is placeholder content and is always closed. /submit is a
 * utility form, not a search landing page.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = env.siteUrl.replace(/\/$/, "");
  const [posts, archiveDays, dailyArchive, curatedResult] = await Promise.all([
    getPublishedWritingPosts(),
    getArchiveIndex(),
    getDailyBriefArchive(100),
    getCuratedAiCorpus(),
  ]);
  const dailyEntries = buildDailySitemapEntries(site, dailyArchive.briefs);
  const aiEntries = buildAiSitemapEntries(site, posts, curatedResult.signals);

  const gated: MetadataRoute.Sitemap = env.publicResearchEnabled
    ? [
        { url: `${site}/open-source`, changeFrequency: "daily" as const, priority: 0.7 },
      ]
    : [];

  return [
    { url: `${site}/`, changeFrequency: "weekly", priority: 1 },
    {
      url: `${site}/blog`,
      ...(posts[0] ? { lastModified: posts[0].date } : {}),
      changeFrequency: "weekly" as const,
      priority: 0.9,
    },
    {
      url: `${site}/archive`,
      ...(posts[0] ? { lastModified: posts[0].date } : {}),
      changeFrequency: "daily" as const,
      priority: 0.6,
    },
    // Per-day pages are self-canonical (they show a summary + link, not the full post
    // body, so it's genuinely distinct content, not a duplicate of /blog/[slug]) — low
    // priority since it's a browse-by-date view, not competing with the primary permalink.
    ...archiveDays.map((day) => ({
      url: `${site}/archive/${day.date}`,
      ...(day.posts[0] ? {
        lastModified: new Date(Math.max(...day.posts.map((post) => post.date.getTime()))),
      } : {}),
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
    ...aiEntries,
    { url: `${site}/projects`, changeFrequency: "monthly" as const, priority: 0.8 },
    ...projects.map((project) => ({
      url: `${site}/projects/${project.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.75,
    })),
    ...gated,
    { url: `${site}/about`, changeFrequency: "monthly" as const, priority: 0.8 },
    { url: `${site}/subscribe`, changeFrequency: "monthly" as const, priority: 0.7 },
    { url: `${site}/privacy`, changeFrequency: "yearly" as const, priority: 0.4 },
    { url: `${site}/editorial-standards`, changeFrequency: "yearly" as const, priority: 0.4 },
    { url: `${site}/corrections`, changeFrequency: "yearly" as const, priority: 0.4 },
    { url: `${site}/ethics`, changeFrequency: "yearly" as const, priority: 0.4 },
  ];
}
