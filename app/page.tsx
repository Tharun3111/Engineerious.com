import type { Metadata } from "next";
import Link from "next/link";

import { EvidenceRail } from "@/components/EvidenceRail";
import { NewsletterCTA } from "@/components/NewsletterCTA";
import { ScopeBlock } from "@/components/ScopeBlock";
import { getPublishedWritingPosts } from "@/lib/content/blog";
import { currentDesk, type CurrentDeskEntry } from "@/lib/current-desk";
import { deriveDailyQuickSheet } from "@/lib/daily-brief";
import {
  getLatestDailyBrief,
  type DailyBriefQueryResult,
} from "@/lib/daily-queries";
import { getPillar } from "@/lib/pillars";
import { featuredProjects } from "@/lib/projects";
import { isoDate } from "@/lib/time";

export const revalidate = 300;

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const deskLanes = [
  ["Build", "Production-minded generative and agentic AI systems"],
  ["Understand", "LLMs, retrieval, agents, evaluation, and infrastructure"],
  ["Publish", "Engineering notes, reviewed intelligence, and project decisions"],
] as const;

export function DailyHomeModule({ result }: { result: DailyBriefQueryResult }) {
  const latest = result.brief;

  if (!latest) {
    const unavailable = Boolean(result.error);
    return (
      <div data-feed-state={unavailable ? "unavailable" : "empty"}>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="eyebrow">Daily intelligence</p>
            <h2
              id="daily-home-title"
              className="font-display mt-2 max-w-[30ch] text-balance text-[24px] font-semibold leading-[1.3] tracking-[-0.025em] sm:text-[29px]"
            >
              {unavailable
                ? "The reviewed Daily Brief is temporarily unavailable."
                : "The first reviewed brief is still on the editorial desk."}
            </h2>
          </div>
          <span className="pill">No filler</span>
        </div>
        <p className="mt-4 max-w-[62ch] text-[15px] leading-7 text-muted">
          {unavailable
            ? "Private drafts are never used as a fallback. The public preview will return when its validated snapshot is available."
            : "This slot will hold the day’s important developments, why they matter, one useful concept, and Tharun’s Take. It stays empty until the structured brief and its sources have passed human review."}
        </p>
        <Link
          href="/daily"
          className="mt-5 inline-flex min-h-11 items-center font-mono text-[12.5px] font-medium text-accent hover:underline"
        >
          See how the Daily Brief works <span aria-hidden="true">&nbsp;&rarr;</span>
        </Link>
      </div>
    );
  }

  const quickSheet = deriveDailyQuickSheet(latest.brief);
  return (
    <article data-feed-state="published">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="eyebrow">Latest Daily Brief</p>
        <span className="pill pill-accent">Human approved</span>
      </div>
      <p className="mt-4 font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted">
        <time dateTime={latest.date}>{latest.date}</time> &middot; {quickSheet.sourceCount}{" "}
        {quickSheet.sourceCount === 1 ? "source" : "sources"}
      </p>
      <h2
        id="daily-home-title"
        className="font-display mt-2 max-w-[30ch] text-balance text-[24px] font-semibold leading-[1.3] tracking-[-0.025em] sm:text-[29px]"
      >
        <Link href={`/daily/${latest.date}`} className="hover:text-accent">
          {latest.brief.title}
        </Link>
      </h2>
      <p className="mt-4 max-w-[62ch] text-[15px] leading-7 text-muted">
        {latest.brief.summary}
      </p>

      <dl className="mt-5 divide-y divide-rule border-y border-rule">
        <div className="grid gap-1 py-3.5 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-5">
          <dt className="section-label">{quickSheet.biggestStory.label}</dt>
          <dd>
            <p className="text-[14px] font-semibold leading-5">{quickSheet.biggestStory.title}</p>
            <p className="mt-1 text-[13.5px] leading-5 text-muted">
              {quickSheet.biggestStory.detail}
            </p>
          </dd>
        </div>
        <div className="grid gap-1 py-3.5 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-5">
          <dt className="section-label">Human perspective</dt>
          <dd>
            <p className="text-[14px] font-semibold leading-5">Tharun&rsquo;s Take</p>
            <p className="mt-1 text-[13.5px] leading-5 text-muted">{quickSheet.myTake.detail}</p>
          </dd>
        </div>
      </dl>

      <Link
        href={`/daily/${latest.date}`}
        className="mt-4 inline-flex min-h-11 items-center font-mono text-[12.5px] font-medium text-accent hover:underline"
      >
        Read the reviewed brief <span aria-hidden="true">&nbsp;&rarr;</span>
      </Link>
    </article>
  );
}

export default async function HomePage() {
  const [posts, latestDaily] = await Promise.all([
    getPublishedWritingPosts(),
    getLatestDailyBrief(),
  ]);
  const latest = posts[0];
  const latestPillar = latest ? getPillar(latest.pillar) : undefined;
  const deskEntries: readonly CurrentDeskEntry[] = currentDesk;
  const project = featuredProjects[0];

  return (
    <div className="space-y-12 py-10 sm:space-y-16 sm:py-14">
      <section className="grid items-start gap-9 border-b border-fg pb-10 lg:grid-cols-[minmax(0,1.55fr)_minmax(18rem,0.75fr)] lg:gap-16 lg:pb-12">
        <div>
          <p className="eyebrow">Tharun Chowdary Malepati &middot; AI / ML Engineer</p>
          <h1 className="font-display mt-4 max-w-[22ch] text-balance text-[30px] font-semibold leading-[1.22] tracking-[-0.035em] sm:text-[40px] lg:text-[44px]">
            I build AI systems, test what changes, and explain what holds up.
          </h1>
          <p className="mt-5 max-w-[63ch] text-[16px] leading-7 text-muted sm:text-[17px]">
            Engineerious is my AI engineering desk on the internet: practical work on
            LLMs, agents, retrieval, evaluation, and infrastructure &mdash; plus a
            source-checked view of what is actually worth an engineer&rsquo;s attention.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/daily" className="btn btn-primary">
              Explore the Daily Brief
            </Link>
            <Link href="/blog" className="btn btn-secondary">
              Read the writing
            </Link>
            <Link href="/projects" className="btn btn-ghost">
              View projects <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
        </div>

        <aside className="border-l-2 border-accent pl-5" aria-label="What this desk covers">
          <p className="section-label">On this desk</p>
          <dl className="mt-4 divide-y divide-rule border-y border-rule">
            {deskLanes.map(([label, detail]) => (
              <div key={label} className="py-3.5">
                <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-accent-strong">
                  {label}
                </dt>
                <dd className="mt-1.5 text-[13.5px] leading-5 text-muted">{detail}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </section>

      <EvidenceRail />

      <section
        aria-labelledby="daily-home-title"
        className="grid gap-10 border-b border-rule pb-12 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.75fr)] lg:gap-16"
      >
        <DailyHomeModule result={latestDaily} />

        <aside aria-labelledby="current-desk-title">
          <p className="section-label">Working set</p>
          <h2 id="current-desk-title" className="font-display mt-2 text-[18px] font-semibold">
            Current desk
          </h2>
          <dl className="mt-4 divide-y divide-rule border-y border-rule">
            {deskEntries.map((entry) => (
              <div key={entry.kind} className="py-3.5">
                <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">{entry.label}</dt>
                <dd className="mt-1.5 text-[13.5px] leading-5 text-fg">
                  {entry.href ? (
                    <Link href={entry.href} className="font-medium text-accent hover:underline">
                      {entry.title}
                    </Link>
                  ) : (
                    entry.title
                  )}
                </dd>
                <p className="mt-1 text-[12.5px] leading-5 text-muted">{entry.detail}</p>
              </div>
            ))}
          </dl>
        </aside>
      </section>

      <section aria-labelledby="latest-writing-title">
        <div className="flex items-baseline justify-between gap-4 border-b border-fg pb-2.5">
          <div>
            <p className="section-label">Latest writing</p>
            <h2 id="latest-writing-title" className="sr-only">Latest writing</h2>
          </div>
          <Link href="/blog" className="font-mono text-[11.5px] font-medium text-accent hover:underline">
            All writing <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>

        {latest ? (
          <article className="grid gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.75fr)] lg:gap-12">
            <div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted">
                <span className="ver">{isoDate(latest.date)}</span>
                <span aria-hidden="true">&middot;</span>
                <span className="ver">{latest.readingMinutes} min</span>
                {latestPillar && <span className="pill pill-accent">{latestPillar.name}</span>}
              </div>
              <h3 className="font-display mt-3 max-w-[32ch] text-balance text-[22px] font-semibold leading-[1.35] tracking-[-0.02em]">
                <Link href={`/blog/${latest.slug}`} className="hover:text-accent">
                  {latest.title}
                </Link>
              </h3>
              <p className="mt-3 max-w-[62ch] text-[14.5px] leading-6 text-muted">{latest.dek}</p>
            </div>
            <ScopeBlock teaches={latest.teaches} notCovered={latest.notCovered} />
          </article>
        ) : (
          <div data-feed-state="empty" className="py-8">
            <p className="max-w-[58ch] text-[15px] leading-7 text-muted">
              No writing is public yet. Drafts stay private until the claims, sources,
              and authorship are ready to stand behind.
            </p>
          </div>
        )}
      </section>

      <section className="grid gap-8 border-y border-rule py-10 lg:grid-cols-[minmax(0,0.65fr)_minmax(0,1.35fr)] lg:gap-16" aria-labelledby="project-title">
        <div>
          <p className="eyebrow">Selected project</p>
          <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.12em] text-positive">{project.status}</p>
        </div>
        <div>
          <h2 id="project-title" className="font-display text-[24px] font-semibold tracking-[-0.025em]">
            {project.title}
          </h2>
          <p className="mt-3 max-w-[62ch] text-[15px] leading-7 text-muted">
            {project.summary} The case study explains the architecture and the decisions
            behind its human-controlled publication boundary.
          </p>
          <Link href={`/projects/${project.slug}`} className="mt-5 inline-flex min-h-11 items-center font-mono text-[12.5px] font-medium text-accent hover:underline">
            Read the case study <span aria-hidden="true">&nbsp;&rarr;</span>
          </Link>
        </div>
      </section>

      <section className="grid gap-8 bg-surface p-6 sm:p-8 lg:grid-cols-[minmax(16rem,0.65fr)_minmax(0,1.35fr)] lg:gap-12">
        <div>
          <p className="eyebrow">Proof Loop newsletter</p>
          <h2 className="font-display mt-2 max-w-[18ch] text-[22px] font-semibold leading-snug">
            Useful work, when it is ready.
          </h2>
        </div>
        <NewsletterCTA
          variant="compact"
          hideHeading
          blurb="Get reviewed AI engineering notes and future briefs. No automatic daily send, and no made-up cadence."
        />
      </section>
    </div>
  );
}
