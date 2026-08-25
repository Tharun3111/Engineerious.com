import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";

import { AiSignalList } from "@/components/AiSignalList";
import { EvidenceRail } from "@/components/EvidenceRail";
import { getPublishedWritingPosts } from "@/lib/content/blog";
import { getCuratedAiCorpus } from "@/lib/curated-ai-queries";
import { getActiveTopics, hasUsefulAiContent } from "@/lib/topics";

export const revalidate = 300;

export function aiDeskRobots(useful: boolean): Metadata["robots"] {
  return { index: useful, follow: true };
}

const loadAiDesk = cache(async () => {
  const [posts, signalResult] = await Promise.all([
    getPublishedWritingPosts(),
    getCuratedAiCorpus(),
  ]);
  return {
    posts,
    signalResult,
    displaySignals: signalResult.signals.slice(0, 100),
    activeTopics: getActiveTopics(posts, signalResult.signals),
  };
});

export async function generateMetadata(): Promise<Metadata> {
  const { posts, signalResult } = await loadAiDesk();
  const useful = hasUsefulAiContent(posts, signalResult.signals);
  return {
    title: "AI Engineering Desk",
    description:
      "Human-curated AI engineering signal, with source-linked summaries, practical consequences, and active topic maps.",
    alternates: { canonical: "/ai" },
    robots: aiDeskRobots(useful),
  };
}

export default async function AiDeskPage() {
  const { signalResult, displaySignals, activeTopics } = await loadAiDesk();

  return (
    <div className="mx-auto max-w-5xl py-10 sm:py-14">
      <header className="grid gap-7 border-b border-fg pb-9 lg:grid-cols-[minmax(0,1.5fr)_minmax(15rem,0.65fr)] lg:gap-14">
        <div>
          <p className="eyebrow">AI engineering desk</p>
          <h1 className="font-display mt-3 max-w-[24ch] text-balance text-[29px] font-semibold leading-[1.22] tracking-[-0.035em] sm:text-[40px]">
            The useful signal starts after the feed.
          </h1>
          <p className="mt-5 max-w-[64ch] text-[16px] leading-7 text-muted">
            Raw feeds collect candidates. This desk shows only the items a human has
            classified, checked, and approved as immutable public copy. Rank can move as
            the source feed changes; the reviewed copy cannot.
          </p>
        </div>

        <aside className="border-l-2 border-accent pl-5" aria-label="Publication boundary">
          <p className="section-label">Publication boundary</p>
          <dl className="mt-3 divide-y divide-rule border-y border-rule">
            <div className="py-3">
              <dt className="font-mono text-[10px] uppercase tracking-[0.11em] text-muted">Input</dt>
              <dd className="mt-1 text-[13.5px] leading-5">Approved feed candidate</dd>
            </div>
            <div className="py-3">
              <dt className="font-mono text-[10px] uppercase tracking-[0.11em] text-muted">Public copy</dt>
              <dd className="mt-1 text-[13.5px] leading-5">Reviewed, source-linked snapshot</dd>
            </div>
            <div className="py-3">
              <dt className="font-mono text-[10px] uppercase tracking-[0.11em] text-muted">Automation</dt>
              <dd className="mt-1 text-[13.5px] leading-5">Cannot publish by itself</dd>
            </div>
          </dl>
        </aside>
      </header>

      <div className="py-8">
        <EvidenceRail compact />
      </div>

      {activeTopics.length > 0 ? (
        <section aria-labelledby="active-topics-title" className="border-t border-fg pt-5">
          <div className="grid gap-2 border-b border-rule pb-4 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-6">
            <p className="section-label">Active maps</p>
            <div>
              <h2 id="active-topics-title" className="font-display text-[19px] font-semibold">
                Topics with enough reviewed material to be useful
              </h2>
              <p className="mt-1 max-w-[62ch] text-[13.5px] leading-6 text-muted">
                A hub opens with one verified Writing entry or three explicitly tagged
                reviewed signals. Titles are never keyword-guessed into a topic.
              </p>
            </div>
          </div>
          <ul className="divide-y divide-rule">
            {activeTopics.map((activity) => (
              <li key={activity.topic.slug}>
                <Link
                  href={`/topics/${activity.topic.slug}`}
                  className="grid min-h-20 gap-2 py-4 hover:text-accent sm:grid-cols-[9rem_minmax(0,1fr)_auto] sm:items-center sm:gap-6"
                >
                  <span className="font-display text-[15px] font-semibold">
                    {activity.topic.label}
                  </span>
                  <span className="text-[14px] leading-6 text-muted">
                    {activity.topic.description}
                  </span>
                  <span className="font-mono text-[10.5px] text-muted">
                    {activity.writing.length} writing &middot; {activity.signals.length} signal
                    {activity.signals.length === 1 ? "" : "s"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section
        aria-labelledby="reviewed-signal-title"
        className={activeTopics.length > 0 ? "mt-12" : ""}
      >
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="section-label">Current intelligence</p>
            <h2 id="reviewed-signal-title" className="font-display mt-1 text-[21px] font-semibold">
              Reviewed signal
            </h2>
          </div>
          {displaySignals.length > 0 ? (
            <span className="pill pill-accent">
              {displaySignals.length === signalResult.signals.length ? "" : "Top "}
              {displaySignals.length} public item
              {displaySignals.length === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>

        <AiSignalList
          signals={displaySignals}
          error={signalResult.error}
          emptyMessage="No reviewed signal is public yet. Raw candidates remain off this page until a human approves their exact public copy."
        />
      </section>

      <footer className="mt-10 flex flex-wrap gap-3 border-t border-rule pt-6">
        <Link href="/blog" className="btn btn-secondary">
          Read verified writing
        </Link>
        <Link href="/editorial-standards" className="btn btn-ghost">
          How review works <span aria-hidden="true">&rarr;</span>
        </Link>
      </footer>
    </div>
  );
}
