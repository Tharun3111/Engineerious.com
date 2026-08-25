import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { AiSignalList } from "@/components/AiSignalList";
import { EvidenceRail } from "@/components/EvidenceRail";
import { JsonLd } from "@/components/JsonLd";
import { getPublishedWritingPosts } from "@/lib/content/blog";
import { getCuratedAiCorpus } from "@/lib/curated-ai-queries";
import { env } from "@/lib/env";
import { buildTopicActivity, getTopic, type TopicDefinition } from "@/lib/topics";
import { isoDate } from "@/lib/time";

export const revalidate = 300;

type TopicPageProps = { params: Promise<{ slug: string }> };

export function topicPageRobots(active: boolean): Metadata["robots"] {
  return active ? { index: true, follow: true } : { index: false, follow: false };
}

export function topicBreadcrumbJsonLd(topic: TopicDefinition) {
  const site = env.siteUrl.replace(/\/$/, "");
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Engineerious", item: site },
      { "@type": "ListItem", position: 2, name: "AI desk", item: `${site}/ai` },
      {
        "@type": "ListItem",
        position: 3,
        name: topic.label,
        item: `${site}/topics/${topic.slug}`,
      },
    ],
  };
}

const loadTopicPage = cache(async (slug: string) => {
  const topic = getTopic(slug);
  if (!topic) return null;

  const [posts, signalResult] = await Promise.all([
    getPublishedWritingPosts(),
    getCuratedAiCorpus(),
  ]);
  const activity = buildTopicActivity(topic, posts, signalResult.signals);
  const startHere = topic.startHereSlugs
    .map((postSlug) => posts.find((post) => post.slug === postSlug))
    .filter((post): post is NonNullable<typeof post> => Boolean(post));
  const startHereSlugs = new Set(startHere.map((post) => post.slug));

  return {
    topic,
    activity,
    signalResult,
    displaySignals: activity.signals.slice(0, 100),
    startHere,
    reading: activity.writing.filter((post) => !startHereSlugs.has(post.slug)),
  };
});

export async function generateMetadata({ params }: TopicPageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadTopicPage(slug);
  if (!data || !data.activity.active) {
    return {
      title: "Topic not found",
      robots: topicPageRobots(false),
    };
  }

  return {
    title: `${data.topic.label} — AI engineering topic`,
    description: data.topic.description,
    alternates: { canonical: `/topics/${data.topic.slug}` },
    robots: topicPageRobots(true),
    openGraph: {
      type: "website",
      title: `${data.topic.label} — AI engineering topic`,
      description: data.topic.description,
      url: `/topics/${data.topic.slug}`,
    },
  };
}

export default async function TopicPage({ params }: TopicPageProps) {
  const { slug } = await params;
  const data = await loadTopicPage(slug);
  if (!data || !data.activity.active) notFound();

  const { topic, activity, signalResult, displaySignals, startHere, reading } = data;

  return (
    <div className="mx-auto max-w-5xl py-10 sm:py-14">
      <JsonLd data={topicBreadcrumbJsonLd(topic)} />
      <header className="border-b border-fg pb-9">
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.09em] text-muted">
            <li>
              <Link href="/ai" className="inline-flex min-h-11 items-center text-accent hover:underline">
                AI desk
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page">{topic.label}</li>
          </ol>
        </nav>

        <div className="mt-4 grid gap-7 lg:grid-cols-[minmax(0,1.45fr)_minmax(15rem,0.55fr)] lg:gap-14">
          <div>
            <p className="eyebrow">Active topic map</p>
            <h1 className="font-display mt-3 text-balance text-[31px] font-semibold leading-[1.2] tracking-[-0.035em] sm:text-[42px]">
              {topic.label}
            </h1>
            <p className="mt-4 max-w-[64ch] text-[16px] leading-7 text-muted">
              {topic.description}
            </p>
          </div>

          <dl className="divide-y divide-rule border-y border-rule">
            <div className="flex items-baseline justify-between gap-4 py-3">
              <dt className="section-label">Verified writing</dt>
              <dd className="font-display text-[16px] font-semibold tabular-nums">
                {activity.writing.length}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-3">
              <dt className="section-label">Reviewed signal</dt>
              <dd className="font-display text-[16px] font-semibold tabular-nums">
                {activity.signals.length}
              </dd>
            </div>
            {activity.latestActivityAt ? (
              <div className="flex items-baseline justify-between gap-4 py-3">
                <dt className="section-label">Latest activity</dt>
                <dd className="font-mono text-[10.5px] text-muted">
                  <time dateTime={activity.latestActivityAt.toISOString()}>
                    {isoDate(activity.latestActivityAt)}
                  </time>
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      </header>

      <div className="py-8">
        <EvidenceRail compact />
      </div>

      {startHere.length > 0 ? (
        <section aria-labelledby="topic-start-title" className="border-t border-fg pt-5">
          <p className="section-label">Editorial path</p>
          <h2 id="topic-start-title" className="font-display mt-1 text-[21px] font-semibold">
            Start here
          </h2>
          <ul className="mt-4 divide-y divide-rule border-b border-rule">
            {startHere.map((post) => (
              <li key={post.slug}>
                <Link href={`/blog/${post.slug}`} className="block py-5 hover:text-accent">
                  <p className="font-mono text-[10.5px] text-muted">
                    <time dateTime={post.date.toISOString()}>{isoDate(post.date)}</time>
                    {" · "}{post.readingMinutes} min read
                  </p>
                  <h3 className="font-display mt-2 max-w-[42ch] text-[18px] font-semibold leading-snug">
                    {post.title}
                  </h3>
                  <p className="mt-2 max-w-[64ch] text-[14px] leading-6 text-muted">
                    {post.dek}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {reading.length > 0 ? (
        <section
          aria-labelledby="topic-reading-title"
          className={startHere.length > 0 ? "mt-12" : "border-t border-fg pt-5"}
        >
          <p className="section-label">Learn and read</p>
          <h2 id="topic-reading-title" className="font-display mt-1 text-[21px] font-semibold">
            Verified Writing
          </h2>
          <ol className="mt-4 divide-y divide-rule border-y border-rule">
            {reading.map((post) => (
              <li key={post.slug}>
                <Link
                  href={`/blog/${post.slug}`}
                  className="grid gap-2 py-5 hover:text-accent sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-6"
                >
                  <p className="font-mono text-[10.5px] text-muted">
                    <time dateTime={post.date.toISOString()}>{isoDate(post.date)}</time>
                    <span className="mt-1 block">{post.readingMinutes} min read</span>
                  </p>
                  <div>
                    <h3 className="font-display max-w-[42ch] text-[17px] font-semibold leading-snug">
                      {post.title}
                    </h3>
                    <p className="mt-2 max-w-[64ch] text-[14px] leading-6 text-muted">
                      {post.dek}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {displaySignals.length > 0 || signalResult.error ? (
        <section
          aria-labelledby="topic-signal-title"
          className={startHere.length > 0 || reading.length > 0 ? "mt-12" : "border-t border-fg pt-5"}
        >
          <p className="section-label">Reviewed signal</p>
          <h2 id="topic-signal-title" className="font-display mt-1 mb-5 text-[21px] font-semibold">
            What changed
          </h2>
          <AiSignalList signals={displaySignals} error={signalResult.error} />
        </section>
      ) : null}

      <footer className="mt-12 flex flex-wrap gap-3 border-t-2 border-fg pt-6">
        <Link href="/ai" className="btn btn-secondary">
          <span aria-hidden="true">&larr;</span> Back to AI desk
        </Link>
        <Link href="/blog" className="btn btn-ghost">
          Browse Writing
        </Link>
      </footer>
    </div>
  );
}
