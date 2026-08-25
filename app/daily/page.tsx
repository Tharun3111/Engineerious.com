import type { Metadata } from "next";
import Link from "next/link";

import { DailyBrief } from "@/components/DailyBrief";
import { EvidenceRail } from "@/components/EvidenceRail";
import {
  getDailyBriefArchive,
  getLatestDailyBrief,
  publicDailyRobots,
} from "@/lib/daily-queries";
import { env } from "@/lib/env";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const { brief } = await getLatestDailyBrief();
  const description =
    brief?.brief.summary ??
    "A human-reviewed daily AI engineering brief: what changed, why it matters, source links, and Tharun's take.";
  return {
    title: "Daily AI Brief",
    description,
    alternates: { canonical: "/daily" },
    robots: publicDailyRobots(Boolean(brief)),
    openGraph: brief
      ? {
          type: "website",
          title: brief.brief.title,
          description,
          url: "/daily",
          images: [
            {
              url: `/daily/${brief.date}/opengraph-image`,
              width: 1200,
              height: 630,
              alt: `Engineerious Daily Brief for ${brief.date}`,
            },
          ],
        }
      : undefined,
    twitter: brief
      ? {
          card: "summary_large_image",
          title: brief.brief.title,
          description,
          images: [`/daily/${brief.date}/opengraph-image`],
        }
      : undefined,
  };
}

function formatArchiveDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

export default async function DailyPage() {
  const [latestResult, archiveResult] = await Promise.all([
    getLatestDailyBrief(),
    getDailyBriefArchive(30),
  ]);
  const latest = latestResult.brief;
  const previous = latest
    ? archiveResult.briefs.filter((entry) => entry.date !== latest.date)
    : archiveResult.briefs;

  if (!latest) {
    const unavailable = Boolean(latestResult.error || archiveResult.error);
    return (
      <div className="mx-auto max-w-4xl py-10 sm:py-14">
        <header className="border-b border-fg pb-8">
          <p className="eyebrow">Daily intelligence</p>
          <h1 className="font-display mt-3 max-w-[24ch] text-balance text-[28px] font-semibold leading-[1.25] tracking-[-0.03em] sm:text-[38px]">
            The useful part of today&rsquo;s AI changes, after review.
          </h1>
          <p className="mt-4 max-w-[62ch] text-[16px] leading-7 text-muted">
            Source links, practical implications, a short learning note, and a
            personal take. Nothing appears here until a human approves the complete brief.
          </p>
        </header>

        <div className="py-8">
          <EvidenceRail compact />
        </div>

        <section
          data-feed-state={unavailable ? "unavailable" : "empty"}
          className="border-y border-rule py-8"
          aria-live="polite"
        >
          <p className="section-label">Publication status</p>
          <h2 className="font-display mt-2 text-[20px] font-semibold leading-snug">
            {unavailable
              ? "The Daily archive is temporarily unavailable."
              : "No reviewed Daily Brief is published yet."}
          </h2>
          <p className="mt-3 max-w-[58ch] text-[15px] leading-7 text-muted">
            {unavailable
              ? "The private review workflow remains closed; no draft content is being shown as a fallback."
              : "The first issue will appear only after its stories, citations, and human-authored take clear review."}
          </p>
          <Link href="/blog" className="btn btn-secondary mt-5">
            Read the writing
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl py-10 sm:py-14">
      <DailyBrief
        brief={latest.brief}
        shareUrl={`${env.siteUrl.replace(/\/$/, "")}/daily/${latest.date}`}
      />

      {previous.length ? (
        <section aria-labelledby="daily-archive-title" className="mt-14 border-t border-fg pt-7">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-rule pb-3">
            <div>
              <p className="section-label">Archive</p>
              <h2 id="daily-archive-title" className="font-display mt-1 text-[20px] font-semibold">
                Earlier reviewed briefs
              </h2>
            </div>
            <span className="pill">Newest first</span>
          </div>
          <ol className="divide-y divide-rule">
            {previous.map((entry) => (
              <li key={entry.date}>
                <Link
                  href={`/daily/${entry.date}`}
                  className="grid min-h-16 gap-1 py-4 hover:text-accent sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-baseline sm:gap-6"
                >
                  <time dateTime={entry.date} className="font-mono text-[11px] text-muted">
                    {formatArchiveDate(entry.date)}
                  </time>
                  <span className="font-display text-[14px] font-semibold leading-6">
                    {entry.brief.title}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
