import Link from "next/link";

import { NewsletterCTA } from "@/components/NewsletterCTA";
import { getPublishedPosts } from "@/lib/content/blog";
import { isoDate } from "@/lib/time";

export const revalidate = 300;

const DESK_LANES = [
  {
    code: "SIGNAL / 01",
    title: "AI News",
    prompt: "Track what changed",
    detail:
      "Source-checked releases, research, incidents, and policy shifts with the engineering impact attached.",
    href: "/news",
    action: "Open the news desk",
    accent: "bg-[#0A5FA5]",
  },
  {
    code: "MODEL / 02",
    title: "Model Watch",
    prompt: "Compare before switching",
    detail:
      "Model updates translated into capability, access, constraints, and the tests worth running before adoption.",
    href: "/models",
    action: "Inspect model updates",
    accent: "bg-[#22C55E]",
  },
  {
    code: "FIELD / 03",
    title: "Field Notes",
    prompt: "Learn from the system",
    detail:
      "Longer explanations of evals, agents, retrieval, and the production details that a clean demo leaves out.",
    href: "/blog",
    action: "Read the field notes",
    accent: "bg-[#F59E0B]",
  },
] as const;

const CURRENT_FOCUS = [
  {
    topic: "Evaluation",
    question: "How do you measure behavior instead of demo quality?",
    detail: "Regression gates, release evidence, observability, and useful human judgment.",
  },
  {
    topic: "Agents",
    question: "Where should an autonomous workflow be forced to stop?",
    detail: "Tool boundaries, permissions, timeouts, review points, and incident containment.",
  },
  {
    topic: "Retrieval",
    question: "When quality drops, did retrieval fail or did the index drift?",
    detail: "Freshness, embeddings, ranking, context construction, and operational diagnosis.",
  },
] as const;

const EVIDENCE_STANDARD = [
  { term: "Source", detail: "The primary evidence behind the claim." },
  { term: "Test status", detail: "What was tested, and what was not." },
  { term: "Limits", detail: "The uncertainty that still changes the decision." },
  { term: "Correction", detail: "A visible path to amend the record." },
] as const;

function ProofLoop() {
  return (
    <div className="proof-loop-panel" aria-label="Engineerious publishing method">
      <div className="flex items-center justify-between gap-4 border-b border-white/15 px-5 py-4 sm:px-6">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
            Publishing method
          </p>
          <p className="mt-1 text-[15px] font-semibold text-white">The Proof Loop</p>
        </div>
        <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-white/55">
          <span className="status-pulse" aria-hidden />
          Human gate active
        </span>
      </div>

      <div className="relative mx-auto aspect-square w-full max-w-[31rem] px-3 py-4 sm:p-6">
        <svg
          viewBox="0 0 520 520"
          className="h-full w-full"
          role="img"
          aria-labelledby="proof-loop-title proof-loop-description"
        >
          <title id="proof-loop-title">Engineerious Proof Loop</title>
          <desc id="proof-loop-description">
            Evidence moves through observe, test, and decide before reaching a human publishing checkpoint.
          </desc>
          <circle cx="260" cy="260" r="179" className="proof-loop-track" />
          <path d="M292 84A179 179 0 1 0 438 226" className="proof-loop-active" />
          <rect x="374" y="102" width="50" height="50" rx="2" fill="#22C55E" />

          <g className="proof-loop-stage">
            <circle cx="139" cy="129" r="5" />
            <text x="139" y="113" textAnchor="middle">OBSERVE</text>
          </g>
          <g className="proof-loop-stage">
            <circle cx="112" cy="354" r="5" />
            <text x="112" y="382" textAnchor="middle">TEST</text>
          </g>
          <g className="proof-loop-stage">
            <circle cx="384" cy="362" r="5" />
            <text x="384" y="390" textAnchor="middle">DECIDE</text>
          </g>

          <text x="260" y="224" textAnchor="middle" className="proof-loop-kicker">
            EVIDENCE BEFORE ADOPTION
          </text>
          <text x="260" y="263" textAnchor="middle" className="proof-loop-word">
            Source
          </text>
          <text x="260" y="296" textAnchor="middle" className="proof-loop-word">
            Status
          </text>
          <text x="260" y="329" textAnchor="middle" className="proof-loop-word">
            Unknowns
          </text>
        </svg>
      </div>

      <dl className="grid grid-cols-2 border-t border-white/15 text-white sm:grid-cols-3">
        <div className="border-r border-white/15 px-4 py-4 sm:px-5">
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">Origin</dt>
          <dd className="mt-1 text-[13px] font-medium">Always disclosed</dd>
        </div>
        <div className="px-4 py-4 sm:border-r sm:border-white/15 sm:px-5">
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">Claims</dt>
          <dd className="mt-1 text-[13px] font-medium">Source attached</dd>
        </div>
        <div className="col-span-2 border-t border-white/15 px-4 py-4 sm:col-span-1 sm:border-t-0 sm:px-5">
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">Publish</dt>
          <dd className="mt-1 text-[13px] font-medium">Human decision</dd>
        </div>
      </dl>
    </div>
  );
}

export default function HomePage() {
  const posts = getPublishedPosts().slice(0, 3);

  return (
    <div className="pb-6">
      <section className="home-hero-grid relative isolate overflow-hidden border-x border-b border-rule">
        <div className="grid min-h-[calc(100svh-4.5rem)] lg:grid-cols-[minmax(0,1.05fr)_minmax(24rem,0.75fr)]">
          <div className="flex flex-col justify-center px-5 py-16 sm:px-10 sm:py-20 lg:px-14 lg:py-24 xl:px-16">
            <p className="flex items-center gap-3 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-strong">
              <span aria-hidden className="h-px w-8 bg-accent-strong" />
              Independent AI engineering desk
            </p>
            <h1 className="mt-7 max-w-4xl text-balance text-[52px] font-bold leading-[0.94] tracking-[-0.055em] text-fg sm:text-[70px] lg:text-[76px] xl:text-[88px]">
              AI releases are not <span className="font-display font-medium italic text-accent-strong">engineering decisions.</span>
            </h1>
            <p className="mt-7 max-w-2xl text-pretty text-[18px] leading-8 text-muted sm:text-[20px]">
              Engineerious traces what changed in models and tools, then turns it into tests,
              limits, and implementation choices you can inspect.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/news" className="btn btn-primary px-5">
                Open the news desk
                <span aria-hidden>↗</span>
              </Link>
              <Link href="/models" className="btn btn-secondary px-5">
                Inspect model updates
              </Link>
            </div>
            <div className="mt-10 grid max-w-2xl gap-3 border-t border-rule pt-5 text-[13px] leading-5 text-muted sm:grid-cols-2">
              <p>
                <span className="font-semibold text-fg">For:</span> engineers and technical founders responsible for systems that must work beyond the demo.
              </p>
              <p>
                <span className="font-semibold text-fg">By:</span> Tharun Chowdary, with AI assistance and review status kept visible.
              </p>
            </div>
          </div>

          <div className="flex items-center border-t border-rule bg-[#DCEAF2] p-4 sm:p-8 lg:border-l lg:border-t-0 lg:p-7 xl:p-10">
            <ProofLoop />
          </div>
        </div>
      </section>

      <section id="desk" className="scroll-mt-24 py-20 sm:py-24" aria-labelledby="desk-heading">
        <div className="grid gap-6 border-b border-rule pb-8 lg:grid-cols-[minmax(0,1fr)_28rem] lg:items-end">
          <div>
            <p className="section-label text-accent-strong">The desk</p>
            <h2 id="desk-heading" className="mt-3 max-w-3xl text-balance text-[40px] font-bold leading-[1.02] tracking-[-0.04em] sm:text-[56px]">
              Choose the evidence you need.
            </h2>
          </div>
          <p className="max-w-xl text-[17px] leading-7 text-muted lg:pb-1">
            Each route answers a different question. News tells you what moved. Models tell you what to compare. Field notes show how the system behaves.
          </p>
        </div>

        <div className="grid border-b border-rule md:grid-cols-3">
          {DESK_LANES.map((lane) => (
            <Link
              key={lane.href}
              href={lane.href}
              className="desk-lane group relative flex min-h-[22rem] flex-col border-x border-t border-rule bg-surface p-6 md:min-h-[25rem] md:border-l-0 md:border-r md:p-7 first:md:border-l"
            >
              <span className={`absolute inset-x-0 top-0 h-1 ${lane.accent}`} aria-hidden />
              <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.15em] text-muted">
                {lane.code}
              </span>
              <div className="mt-14">
                <p className="text-[15px] font-semibold text-accent-strong">{lane.prompt}</p>
                <h3 className="mt-2 text-[36px] font-bold leading-none tracking-[-0.035em]">{lane.title}</h3>
                <p className="mt-5 max-w-sm text-[16px] leading-7 text-muted">{lane.detail}</p>
              </div>
              <span className="mt-auto flex items-center justify-between border-t border-rule pt-5 text-[14px] font-semibold">
                {lane.action}
                <span className="desk-lane-arrow text-[21px]" aria-hidden>→</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {posts.length > 0 && (
        <section aria-labelledby="writing-heading" className="pb-20 sm:pb-24">
          <div className="flex flex-wrap items-end justify-between gap-5 border-b-2 border-fg pb-5">
            <div>
              <p className="section-label text-accent-strong">Verified writing</p>
              <h2 id="writing-heading" className="mt-2 text-[38px] font-bold leading-tight tracking-[-0.03em]">
                Latest field notes
              </h2>
            </div>
            <Link href="/blog" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
              Read all field notes
            </Link>
          </div>
          <ul>
            {posts.map((post) => (
              <li key={post.slug} className="border-b border-rule">
                <Link
                  href={`/blog/${post.slug}`}
                  className="grid gap-3 py-8 transition-colors duration-150 hover:bg-surface sm:grid-cols-[10rem_1fr_auto] sm:items-start sm:px-4"
                >
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                    {post.pillar.replaceAll("-", " ")}
                  </span>
                  <span>
                    <span className="block text-[28px] font-bold leading-tight tracking-[-0.02em]">{post.title}</span>
                    <span className="mt-2 block max-w-2xl text-[16px] leading-7 text-muted">{post.dek}</span>
                  </span>
                  <span className="font-mono text-[11px] text-muted">{isoDate(post.date)} · {post.readingMinutes} min</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="border border-rule bg-surface" aria-labelledby="workbench-heading">
        <div className="grid lg:grid-cols-[0.72fr_1.28fr]">
          <div className="border-b border-rule p-6 sm:p-10 lg:border-b-0 lg:border-r lg:p-12">
            <p className="section-label text-accent-strong">Open research log</p>
            <h2 id="workbench-heading" className="mt-4 text-balance text-[39px] font-bold leading-[1.04] tracking-[-0.04em] sm:text-[48px]">
              The questions behind the next issue.
            </h2>
            <p className="mt-5 text-[17px] leading-7 text-muted">
              These are active investigations, not polished conclusions. The first verified notes are under review.
            </p>
            <Link href="/about" className="mt-8 inline-flex min-h-11 items-center text-[14px] font-semibold text-accent-strong underline underline-offset-4">
              See the publishing standard
            </Link>
          </div>

          <ul className="divide-y divide-rule">
            {CURRENT_FOCUS.map((item) => (
              <li key={item.topic} className="group grid gap-3 p-6 sm:grid-cols-[8rem_1fr] sm:p-8 lg:p-9">
                <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-strong">
                  {item.topic}
                </span>
                <div>
                  <h3 className="max-w-2xl text-[21px] font-semibold leading-7 tracking-[-0.015em]">{item.question}</h3>
                  <p className="mt-2 max-w-2xl text-[15px] leading-6 text-muted">{item.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <dl className="grid border-t border-rule sm:grid-cols-2 lg:grid-cols-4">
          {EVIDENCE_STANDARD.map((item) => (
            <div key={item.term} className="border-b border-rule p-5 sm:border-r lg:border-b-0 last:border-r-0">
              <dt className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-fg">{item.term}</dt>
              <dd className="mt-2 text-[14px] leading-6 text-muted">{item.detail}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="grid gap-12 py-20 sm:py-24 lg:grid-cols-[0.78fr_1.22fr] lg:gap-16" aria-label="Publication and newsletter">
        <div className="lg:pt-2">
          <p className="section-label text-accent-strong">Behind the desk</p>
          <h2 className="mt-4 text-[39px] font-bold leading-[1.04] tracking-[-0.04em] sm:text-[48px]">
            Built in public by Tharun Chowdary.
          </h2>
          <p className="mt-5 max-w-xl text-[17px] leading-7 text-muted">
            I use Engineerious to learn AI engineering in public, separate evidence from hype, and turn difficult system behavior into useful explanations.
          </p>
          <Link href="/about" className="mt-7 inline-flex min-h-11 items-center text-[14px] font-semibold text-accent-strong underline underline-offset-4">
            About Tharun and Engineerious
          </Link>
        </div>

        <div className="bg-[#E4F0F6] p-6 sm:p-9">
          <NewsletterCTA
            heading="Stay close to the work"
            blurb="Get a field note when a useful, verified conclusion is ready. No automated link dump and no volume promise."
          />
        </div>
      </section>
    </div>
  );
}
