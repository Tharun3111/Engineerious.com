import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DailyBrief } from "@/components/DailyBrief";
import { JsonLd } from "@/components/JsonLd";
import { dailyDateSchema } from "@/lib/daily-brief";
import { getDailyBriefByDate, type PublicDailyBrief } from "@/lib/daily-queries";
import { env } from "@/lib/env";
import { AUTHOR_NAME, SITE_NAME } from "@/lib/site";

export const revalidate = 300;

type Props = { params: Promise<{ date: string }> };

export function dailyArticleJsonLd(entry: PublicDailyBrief) {
  const site = env.siteUrl.replace(/\/$/, "");
  const url = `${site}/daily/${entry.date}`;
  const publishedAt = entry.publishedAt.toISOString();

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: entry.brief.title,
    description: entry.brief.summary,
    datePublished: publishedAt,
    dateModified: publishedAt,
    image: `${url}/opengraph-image`,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    author: { "@type": "Person", name: AUTHOR_NAME, url: `${site}/about` },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: { "@type": "ImageObject", url: `${site}/icon.svg` },
    },
    isAccessibleForFree: true,
    inLanguage: "en-US",
  };
}

export function dailyBreadcrumbJsonLd(entry: PublicDailyBrief) {
  const site = env.siteUrl.replace(/\/$/, "");
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Engineerious", item: site },
      { "@type": "ListItem", position: 2, name: "Daily", item: `${site}/daily` },
      {
        "@type": "ListItem",
        position: 3,
        name: entry.date,
        item: `${site}/daily/${entry.date}`,
      },
    ],
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { date } = await params;
  if (!dailyDateSchema.safeParse(date).success) notFound();
  const result = await getDailyBriefByDate(date);
  if (result.error && !result.brief) {
    throw new Error("The requested Daily Brief could not be loaded safely.");
  }
  if (!result.brief) notFound();
  const { brief } = result;
  return {
    title: brief.brief.title,
    description: brief.brief.summary,
    alternates: { canonical: `/daily/${brief.date}` },
    authors: [{ name: AUTHOR_NAME }],
    openGraph: {
      type: "article",
      title: brief.brief.title,
      description: brief.brief.summary,
      publishedTime: brief.publishedAt.toISOString(),
      url: `/daily/${brief.date}`,
      authors: [AUTHOR_NAME],
      images: [
        {
          url: `/daily/${brief.date}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: `Engineerious Daily Brief for ${brief.date}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: brief.brief.title,
      description: brief.brief.summary,
      images: [`/daily/${brief.date}/opengraph-image`],
    },
  };
}

export default async function DailyDatePage({ params }: Props) {
  const { date } = await params;
  if (!dailyDateSchema.safeParse(date).success) notFound();

  const result = await getDailyBriefByDate(date);
  if (result.error && !result.brief) {
    throw new Error("The requested Daily Brief could not be loaded safely.");
  }
  if (!result.brief) notFound();

  return (
    <div className="mx-auto max-w-5xl py-10 sm:py-14">
      <JsonLd data={dailyArticleJsonLd(result.brief)} />
      <JsonLd data={dailyBreadcrumbJsonLd(result.brief)} />
      <nav aria-label="Breadcrumb" className="mb-7">
        <ol className="flex flex-wrap items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.09em] text-muted">
          <li>
            <Link href="/daily" className="inline-flex min-h-11 items-center text-accent hover:underline">
              Daily
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page">{result.brief.date}</li>
        </ol>
      </nav>
      <DailyBrief
        brief={result.brief.brief}
        shareUrl={`${env.siteUrl.replace(/\/$/, "")}/daily/${result.brief.date}`}
      />
    </div>
  );
}
