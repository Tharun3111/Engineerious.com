import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";

import { AuthorBadge } from "@/components/AuthorBadge";
import { HandbookProvenance } from "@/components/HandbookProvenance";
import { JsonLd } from "@/components/JsonLd";
import { NewsletterCTA } from "@/components/NewsletterCTA";
import { ShareActions } from "@/components/ShareActions";
import { env } from "@/lib/env";
import {
  getHandbookStaticParams,
  getPublishedHandbookEntry,
  type HandbookKind,
  type PublishedHandbookEntry,
} from "@/lib/handbook";
import { AUTHOR_NAME, SITE_NAME } from "@/lib/site";
import { isoDate } from "@/lib/time";

type HandbookPageProps = {
  params: Promise<{ kind: string; slug: string }>;
};

const KIND_LABELS: Record<HandbookKind, string> = {
  concept: "Concept",
  framework: "Framework",
  model: "Model",
};

export const dynamicParams = false;

export function generateStaticParams() {
  return getHandbookStaticParams();
}

function handbookUrl(entry: PublishedHandbookEntry): string {
  return `${env.siteUrl.replace(/\/$/, "")}/ai/${entry.routeKind}/${entry.slug}`;
}

export function handbookArticleJsonLd(entry: PublishedHandbookEntry) {
  const site = env.siteUrl.replace(/\/$/, "");
  const url = handbookUrl(entry);
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: entry.title,
    description: entry.summary,
    articleSection: `${KIND_LABELS[entry.kind]} · AI engineering handbook`,
    datePublished: entry.publishedAt.toISOString(),
    dateModified: entry.updatedAt.toISOString(),
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    author: { "@type": "Person", name: AUTHOR_NAME, url: `${site}/about` },
    reviewedBy: { "@type": "Person", name: entry.reviewedBy },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: { "@type": "ImageObject", url: `${site}/icon.svg` },
    },
    citation: entry.sources.map((source) => source.url),
    keywords: [...entry.tags, ...entry.topicSlugs].join(", ") || undefined,
    isAccessibleForFree: true,
    inLanguage: "en-US",
  };
}

export function handbookBreadcrumbJsonLd(entry: PublishedHandbookEntry) {
  const site = env.siteUrl.replace(/\/$/, "");
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: SITE_NAME, item: site },
      { "@type": "ListItem", position: 2, name: "AI desk", item: `${site}/ai` },
      {
        "@type": "ListItem",
        position: 3,
        name: entry.title,
        item: handbookUrl(entry),
      },
    ],
  };
}

export async function generateMetadata({ params }: HandbookPageProps): Promise<Metadata> {
  const { kind, slug } = await params;
  const entry = getPublishedHandbookEntry(kind, slug);
  if (!entry) {
    return {
      title: "Handbook entry not found",
      robots: { index: false, follow: false },
    };
  }

  const path = `/ai/${entry.routeKind}/${entry.slug}`;
  return {
    title: `${entry.title} — AI engineering handbook`,
    description: entry.summary,
    alternates: { canonical: path },
    authors: [{ name: AUTHOR_NAME }],
    robots: { index: true, follow: true },
    openGraph: {
      type: "article",
      title: entry.title,
      description: entry.summary,
      url: path,
      publishedTime: entry.publishedAt.toISOString(),
      modifiedTime: entry.updatedAt.toISOString(),
      authors: [AUTHOR_NAME],
      tags: [...entry.tags, ...entry.topicSlugs],
    },
    twitter: {
      card: "summary",
      title: entry.title,
      description: entry.summary,
    },
  };
}

export default async function HandbookEntryPage({ params }: HandbookPageProps) {
  const { kind, slug } = await params;
  const entry = getPublishedHandbookEntry(kind, slug);
  if (!entry) notFound();

  const url = handbookUrl(entry);
  return (
    <article className="mx-auto max-w-5xl py-8 sm:py-12">
      <JsonLd data={handbookArticleJsonLd(entry)} />
      <JsonLd data={handbookBreadcrumbJsonLd(entry)} />

      <header className="border-b border-fg pb-9 sm:pb-11">
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.09em] text-muted">
            <li>
              <Link href="/ai" className="inline-flex min-h-11 items-center text-accent hover:underline">
                AI desk
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>{KIND_LABELS[entry.kind]}</li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="max-w-[18rem] truncate text-fg">
              {entry.title}
            </li>
          </ol>
        </nav>

        <p className="eyebrow mt-5">Reviewed AI engineering handbook · {KIND_LABELS[entry.kind]}</p>
        <h1 className="font-display mt-3 max-w-[24ch] text-balance text-[30px] font-semibold leading-[1.16] tracking-[-0.035em] sm:text-[42px]">
          {entry.title}
        </h1>
        <p className="mt-5 max-w-[66ch] text-[17px] leading-7 text-muted sm:text-[18px] sm:leading-8">
          {entry.summary}
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2">
          <AuthorBadge />
          <p className="text-[13px] font-semibold">{AUTHOR_NAME}</p>
          <span aria-hidden="true" className="text-rule-strong">·</span>
          <p className="font-mono text-[10.5px] text-muted">
            Published <time dateTime={entry.publishedAt.toISOString()}>{isoDate(entry.publishedAt)}</time>
            {" · "}{entry.readingMinutes} min read
          </p>
        </div>

        {entry.topicSlugs.length > 0 ? (
          <ul aria-label="Topics" className="mt-6 flex flex-wrap gap-2">
            {entry.topicSlugs.map((topicSlug) => (
              <li key={topicSlug}>
                <Link href={`/topics/${topicSlug}`} className="pill pill-accent min-h-11 hover:underline">
                  {topicSlug.toUpperCase()}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </header>

      <div className="grid gap-10 py-10 lg:grid-cols-[minmax(0,42rem)_minmax(17rem,1fr)] lg:gap-14 lg:py-14">
        <div className="order-2 min-w-0 lg:order-1">
          <div className="prose">
            <MDXRemote source={entry.body} options={{ parseFrontmatter: false }} />
          </div>

          <section
            aria-labelledby="handbook-my-take"
            className="mt-12 border-l-2 border-accent bg-accent-tint px-5 py-6 sm:px-7"
          >
            <p className="eyebrow text-accent-strong">Personal analysis</p>
            <h2 id="handbook-my-take" className="font-display mt-2 text-[20px] font-semibold">
              My Take
            </h2>
            <p className="mt-3 whitespace-pre-line text-[16px] leading-7 text-fg">{entry.myTake}</p>
          </section>

          {entry.tags.length > 0 ? (
            <p className="mt-7 font-mono text-[11px] leading-6 text-muted">
              {entry.tags.map((tag) => `#${tag}`).join(" ")}
            </p>
          ) : null}

          <section aria-labelledby="handbook-share" className="mt-10 border-t border-rule pt-6">
            <h2 id="handbook-share" className="section-label text-fg">
              Share this reference
            </h2>
            <ShareActions title={entry.title} text={entry.summary} url={url} />
          </section>
        </div>

        <HandbookProvenance entry={entry} />
      </div>

      <div className="mb-10">
        <NewsletterCTA />
      </div>

      <footer className="border-t-2 border-fg pt-6">
        <Link
          href="/ai"
          className="inline-flex min-h-11 items-center font-mono text-[12px] font-medium text-accent hover:underline"
        >
          <span aria-hidden="true">←&nbsp;</span> Back to the AI desk
        </Link>
      </footer>
    </article>
  );
}
