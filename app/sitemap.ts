import type { MetadataRoute } from "next";

import { getPublishedPosts } from "@/lib/content/blog";
import { env } from "@/lib/env";

/**
 * Static routes plus blog and pillar pages. Item detail pages are deliberately out:
 * they are thin permalinks around an outbound link, and indexing tens of thousands of
 * them is how an aggregator earns a thin-content penalty.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const site = env.siteUrl.replace(/\/$/, "");
  const now = new Date();

  return [
    { url: `${site}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${site}/news`, lastModified: now, changeFrequency: "daily" as const, priority: 0.9 },
    { url: `${site}/models`, lastModified: now, changeFrequency: "daily" as const, priority: 0.9 },
    { url: `${site}/blog`, lastModified: now, changeFrequency: "weekly" as const, priority: 0.9 },
    ...getPublishedPosts().map((post) => ({
        url: `${site}/blog/${post.slug}`,
        lastModified: post.date,
        changeFrequency: "monthly" as const,
        priority: 0.8,
      })),
    { url: `${site}/about`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.8 },
    { url: `${site}/subscribe`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.7 },
  ];
}
