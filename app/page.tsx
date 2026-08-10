import Link from "next/link";

import { NewsletterCTA } from "@/components/NewsletterCTA";
import { getPublishedPosts } from "@/lib/content/blog";
import { isoDate } from "@/lib/time";

export const revalidate = 300;

const REASONS_TO_VISIT = [
  {
    number: "01",
    label: "Build",
    title: "Implementation notes you can use",
    detail:
      "Practical patterns for evals, agents, retrieval, and the operational work hidden by a clean demo.",
  },
  {
    number: "02",
    label: "Understand",
    title: "Clear breakdowns of what changed",
    detail:
      "New models and approaches explained through their engineering impact, not launch-day excitement.",
  },
  {
    number: "03",
    label: "Decide",
    title: "Evidence before adoption",
    detail:
      "Sources, tests, limitations, and corrections stay attached to the conclusion so you can judge it yourself.",
  },
] as const;

const CURRENT_FOCUS = [
  {
    topic: "Evaluation",
    question: "How do you measure behavior instead of demo quality?",
    detail: "Evals, regression gates, observability, and release evidence.",
  },
  {
    topic: "Agents",
    question: "What changes when tool use becomes a production system?",
    detail: "Interfaces, permissions, failure modes, and operational control.",
  },
  {
    topic: "Retrieval",
    question: "Where does a RAG system actually lose quality?",
    detail: "Freshness, embeddings, ranking, context construction, and drift.",
  },
] as const;

export default function HomePage() {
  const posts = getPublishedPosts().slice(0, 3);
  const primaryHref = posts[0] ? `/blog/${posts[0].slug}` : "/subscribe";
  const primaryLabel = posts[0] ? "Read the latest note" : "Get the next field note";

  return (
    <div>
      <section className="grid min-h-[calc(100svh-4.5rem)] content-center gap-14 border-b border-rule py-16 sm:py-20 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-20 lg:py-24">
        <div className="max-w-4xl">
          <p className="flex items-center gap-3 text-[13px] font-semibold uppercase tracking-[0.12em] text-muted">
            <span aria-hidden className="h-3 w-3 bg-checkpoint" />
            For engineers and technical founders
          </p>
          <h1 className="font-display mt-7 max-w-4xl text-balance text-[48px] font-semibold leading-[0.98] tracking-[-0.045em] sm:text-[66px] lg:text-[78px]">
            Build AI systems that hold up outside the demo.
          </h1>
          <p className="mt-7 max-w-3xl text-pretty text-[18px] leading-8 text-muted sm:text-[21px]">
            Engineerious turns fast-moving models, agents, evaluation, and retrieval
            into practical engineering notes: what changed, what to test, and what can fail.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href={primaryHref} className="btn btn-primary">
              {primaryLabel}
            </Link>
            <a
              href="#what-you-get"
              className="inline-flex min-h-11 items-center font-semibold text-fg underline decoration-rule-strong underline-offset-4 hover:decoration-fg"
            >
              See what you’ll get
            </a>
          </div>
          <p className="mt-8 text-[15px] text-muted">
            Written and reviewed by Tharun Chowdary. AI assistance stays disclosed.
          </p>
        </div>

        <aside className="border-t border-rule pt-7 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-1">
          <p className="section-label">At a glance</p>
          <dl className="mt-4 divide-y divide-rule border-y border-rule">
            <div className="py-5">
              <dt className="text-[14px] font-semibold text-fg">Who it’s for</dt>
              <dd className="mt-1 text-[15px] leading-6 text-muted">
                Builders responsible for AI that must be reliable, observable, and useful.
              </dd>
            </div>
            <div className="py-5">
              <dt className="text-[14px] font-semibold text-fg">What you’ll find</dt>
              <dd className="mt-1 text-[15px] leading-6 text-muted">
                Field notes, model breakdowns, implementation lessons, and source-backed decisions.
              </dd>
            </div>
            <div className="py-5">
              <dt className="text-[14px] font-semibold text-fg">What you won’t find</dt>
              <dd className="mt-1 text-[15px] leading-6 text-muted">
                Automated link dumps, invented certainty, or first-person claims without review.
              </dd>
            </div>
          </dl>
        </aside>
      </section>

      <section id="what-you-get" className="scroll-mt-24 py-20 sm:py-24">
        <div className="grid gap-8 border-b border-rule pb-10 lg:grid-cols-[18rem_1fr]">
          <p className="section-label">Why Engineerious exists</p>
          <div>
            <h2 className="font-display max-w-3xl text-balance text-[40px] font-semibold leading-[1.05] tracking-[-0.035em] sm:text-[52px]">
              Less AI noise. More engineering judgment.
            </h2>
            <p className="mt-5 max-w-2xl text-[18px] leading-8 text-muted">
              Use the site to understand a change, test it responsibly, and make a better
              implementation decision.
            </p>
          </div>
        </div>

        <ol>
          {REASONS_TO_VISIT.map((reason) => (
            <li
              key={reason.number}
              className="grid gap-3 border-b border-rule py-8 sm:grid-cols-[4rem_9rem_1fr] sm:gap-6 lg:grid-cols-[5rem_12rem_1fr] lg:py-10"
            >
              <span className="text-[14px] font-semibold text-muted">{reason.number}</span>
              <span className="text-[14px] font-semibold uppercase tracking-[0.1em] text-fg">
                {reason.label}
              </span>
              <div className="grid gap-3 lg:grid-cols-[minmax(0,22rem)_1fr] lg:gap-12">
                <h3 className="font-display text-[27px] font-semibold leading-tight">
                  {reason.title}
                </h3>
                <p className="max-w-xl text-[16px] leading-7 text-muted">{reason.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {posts.length > 0 && (
        <section aria-labelledby="writing-heading" className="pb-20 sm:pb-24">
          <div className="flex flex-wrap items-end justify-between gap-5 border-b border-fg pb-5">
            <div>
              <p className="section-label">Latest writing</p>
              <h2 id="writing-heading" className="font-display mt-2 text-[38px] font-semibold leading-tight">
                Field notes and decisions
              </h2>
            </div>
            <Link href="/blog" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
              Read all writing
            </Link>
          </div>
          <ul>
            {posts.map((post) => (
              <li key={post.slug} className="border-b border-rule">
                <Link
                  href={`/blog/${post.slug}`}
                  className="grid gap-3 py-8 transition-colors duration-150 hover:bg-surface sm:grid-cols-[10rem_1fr_auto] sm:items-start sm:px-4"
                >
                  <span className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted">
                    {post.pillar.replaceAll("-", " ")}
                  </span>
                  <span>
                    <span className="font-display block text-[28px] font-semibold leading-tight">{post.title}</span>
                    <span className="mt-2 block max-w-2xl text-[16px] leading-7 text-muted">{post.dek}</span>
                  </span>
                  <span className="text-[13px] text-muted">{isoDate(post.date)} · {post.readingMinutes} min</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="bg-[#111827] px-5 py-14 text-white sm:px-10 sm:py-16 lg:px-14" aria-labelledby="focus-heading">
        <div className="grid gap-8 border-b border-white/25 pb-8 lg:grid-cols-[18rem_1fr]">
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-white/55">Current workbench</p>
          <div>
            <h2 id="focus-heading" className="font-display text-[40px] font-semibold leading-tight sm:text-[48px]">
              Questions I’m working through now
            </h2>
            <p className="mt-4 max-w-2xl text-[17px] leading-7 text-white/65">
              These are research directions, not published conclusions. The first verified notes are under review.
            </p>
          </div>
        </div>
        <ol>
          {CURRENT_FOCUS.map((item, index) => (
            <li key={item.topic} className="grid gap-3 border-b border-white/20 py-7 md:grid-cols-[4rem_10rem_1fr] md:gap-6">
              <span className="text-[13px] text-white/45">0{index + 1}</span>
              <span className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[#22c55e]">{item.topic}</span>
              <div className="grid gap-2 lg:grid-cols-[minmax(0,28rem)_1fr] lg:gap-12">
                <h3 className="text-[20px] font-semibold leading-7">{item.question}</h3>
                <p className="text-[15px] leading-6 text-white/60">{item.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-8 border-b border-rule py-20 sm:py-24 lg:grid-cols-[18rem_1fr]">
        <p className="section-label">Behind the publication</p>
        <div className="max-w-3xl">
          <h2 className="font-display text-[38px] font-semibold leading-tight sm:text-[46px]">
            I’m Tharun Chowdary.
          </h2>
          <p className="mt-5 text-[18px] leading-8 text-muted">
            I use Engineerious to learn AI engineering in public, separate evidence from
            hype, and turn difficult system behavior into useful explanations.
          </p>
          <Link href="/about" className="mt-6 inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
            About Tharun and the publishing standard
          </Link>
        </div>
      </section>

      <div className="py-20 sm:py-24">
        <NewsletterCTA
          heading="Get the next field note"
          blurb="Practical AI engineering notes sent when there is verified work worth sharing. No automated link dump and no fixed-volume promise."
        />
      </div>
    </div>
  );
}
