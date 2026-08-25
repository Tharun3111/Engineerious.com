import { NextResponse } from "next/server";

import { getPublishedWritingPosts } from "@/lib/content/blog";
import { getCuratedAiCorpus } from "@/lib/curated-ai-queries";
import { getDailyBriefArchive } from "@/lib/daily-queries";
import { getPillar } from "@/lib/pillars";
import { projects } from "@/lib/projects";
import { buildSearchIndex } from "@/lib/search-index";
import { getActiveTopics } from "@/lib/topics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function reportSourceIssue(source: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[search] ${source} unavailable: ${message}`);
}

async function settle<T>(source: string, load: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await load();
  } catch (error) {
    reportSourceIssue(source, error);
    return fallback;
  }
}

function formatDailyDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

/**
 * One public-only index for the command palette. Each loader owns its own
 * visibility boundary; a failed source contributes no results rather than
 * falling back to drafts, raw ingestion rows, or closed detail routes.
 */
export async function GET() {
  const [writing, dailyResult, signalResult] = await Promise.all([
    settle("Writing", () => getPublishedWritingPosts(), []),
    settle(
      "Daily",
      () => getDailyBriefArchive(100),
      { briefs: [], error: null },
    ),
    settle(
      "AI signals",
      // Topic thresholds use the full reviewed corpus. Signal search entries
      // are capped below to the same top 100 rendered at /ai so every anchor
      // resolves to a real in-page target.
      () => getCuratedAiCorpus(),
      { signals: [], error: null },
    ),
  ]);

  if (dailyResult.error) reportSourceIssue("Daily", dailyResult.error);
  if (signalResult.error) reportSourceIssue("AI signals", signalResult.error);

  const activeTopics = getActiveTopics(writing, signalResult.signals);
  const targetableSignals = signalResult.signals.slice(0, 100);
  const index = buildSearchIndex({
    writing: writing.map((post) => ({
      slug: post.slug,
      title: post.title,
      description: post.dek,
      label: getPillar(post.pillar)?.name ?? post.pillar,
      keywords: [post.pillar, post.format, ...post.tags, ...post.teaches],
    })),
    daily: dailyResult.briefs.map(({ date, brief }) => ({
      date,
      title: brief.title,
      description: brief.summary,
      label: formatDailyDate(date),
      keywords: [
        ...brief.stories.flatMap((story) => [
          story.headline,
          story.category,
          story.sourceLabel,
          story.whatHappened,
          story.whyItMatters,
          story.forEngineers,
        ]),
        brief.oneThingToLearn?.title ?? "",
        brief.modelToKnow?.name ?? "",
        brief.toolOfTheDay?.name ?? "",
        brief.paperWorthKnowing?.title ?? "",
        brief.myTake,
      ],
    })),
    signals: targetableSignals.map((signal) => ({
      itemId: signal.itemId,
      title: signal.title,
      description: signal.summary,
      label: signal.source,
      keywords: [
        signal.type,
        signal.category,
        signal.sourceSlug,
        signal.whyItMatters,
        signal.author ?? "",
        ...signal.topicSlugs,
      ],
    })),
    topics: activeTopics.map(({ topic }) => ({
      slug: topic.slug,
      title: topic.label,
      description: topic.description,
      label: "Topic hub",
      keywords: [...topic.tagAliases],
    })),
    projects: projects.map((project) => ({
      slug: project.slug,
      title: project.title,
      description: project.summary,
      label: project.status,
      keywords: [project.role, ...project.technologies, ...project.capabilities],
    })),
  });

  return NextResponse.json(index, {
    // A removed curated snapshot must not survive in a browser or CDN search
    // response. The public source loaders retain their own tagged server caches.
    headers: { "Cache-Control": "private, no-store" },
  });
}
