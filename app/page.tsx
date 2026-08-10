import Link from "next/link";

import { NewsletterCTA } from "@/components/NewsletterCTA";
import { PillarBadge } from "@/components/PillarBadge";
import { SocialLinks } from "@/components/SocialLinks";
import { getPublishedPosts } from "@/lib/content/blog";
import { env } from "@/lib/env";
import { isoDate } from "@/lib/time";

export const revalidate = 300;

const FOCUS_AREAS = [
  {
    label: "Evaluation",
    title: "Measure behavior, not demo quality",
    detail: "Evals, regression gates, observability, and the evidence behind a release decision.",
  },
  {
    label: "Agents & MCP",
    title: "Treat tool use as a production system",
    detail: "Interfaces, failure modes, permissions, and the operational work hidden by a clean demo.",
  },
  {
    label: "Retrieval",
    title: "Debug the whole information path",
    detail: "Index freshness, embeddings, ranking, and the practical causes of RAG quality drift.",
  },
] as const;

export default function HomePage() {
  const posts = getPublishedPosts().slice(0, 3);
  const contactHref = env.contactEmail
    ? `mailto:${env.contactEmail}`
    : env.linkedinUrl ?? "/about#contact";

  return (
    <div className="space-y-20 py-10 sm:py-16">
      <section className="relative overflow-hidden rounded-3xl border border-rule bg-surface px-6 py-14 sm:px-12 sm:py-20">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full bg-accent-tint blur-3xl"
        />
        <div className="relative grid items-end gap-10 lg:grid-cols-[1fr_18rem]">
          <div className="max-w-3xl">
            <p className="eyebrow">Tharun Chowdary · AI engineering</p>
            <h1 className="mt-4 text-[38px] font-bold leading-[1.06] tracking-[-0.035em] sm:text-[56px]">
              I learn AI systems by building, testing, and explaining them.
            </h1>
            <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-muted sm:text-[18px]">
              Engineerious is my public notebook for practical AI engineering: clear
              thinking about models, evaluation, agents, retrieval, and what changes
              how I build.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/subscribe" className="btn btn-primary">
                Follow the work
              </Link>
              <a href={contactHref} className="btn btn-secondary">
                Work with me
              </a>
            </div>
          </div>

          <aside className="border-l-2 border-accent pl-5">
            <p className="section-label">Current publishing standard</p>
            <p className="mt-2 text-[14.5px] leading-relaxed text-muted">
              First-person claims are published only after I verify them. AI-assisted
              text stays disclosed. Useful evidence beats content volume.
            </p>
            <SocialLinks className="mt-4" />
          </aside>
        </div>
      </section>

      <section aria-labelledby="focus-heading">
        <div className="max-w-2xl">
          <p className="section-label">What I am working through</p>
          <h2 id="focus-heading" className="mt-2 text-[28px] font-bold tracking-tight">
            Practical questions behind reliable AI products
          </h2>
        </div>
        <ul className="mt-6 grid gap-4 md:grid-cols-3">
          {FOCUS_AREAS.map((area, index) => (
            <li key={area.label} className="card p-6">
              <p className="font-mono text-[11px] text-accent-strong">0{index + 1}</p>
              <p className="mt-5 section-label">{area.label}</p>
              <h3 className="mt-2 text-[18px] font-semibold leading-snug">{area.title}</h3>
              <p className="mt-3 text-[14px] leading-relaxed text-muted">{area.detail}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="writing-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="section-label">Verified writing</p>
            <h2 id="writing-heading" className="mt-2 text-[28px] font-bold tracking-tight">
              Notes I can stand behind
            </h2>
          </div>
          {posts.length > 0 && (
            <Link href="/blog" className="btn btn-secondary btn-sm">
              Read all writing →
            </Link>
          )}
        </div>

        {posts.length === 0 ? (
          <div className="mt-6 grid gap-5 rounded-2xl border border-rule bg-surface p-6 sm:grid-cols-[1fr_auto] sm:items-center sm:p-8">
            <div>
              <p className="font-semibold">The first field notes are under review.</p>
              <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-muted">
                I am auditing sources, tested claims, and first-person details before
                publishing. Subscribe if you want the verified pieces when they are ready.
              </p>
            </div>
            <Link href="/subscribe" className="btn btn-secondary">
              Get the first note
            </Link>
          </div>
        ) : (
          <ul className="mt-6 grid gap-4 sm:grid-cols-3">
            {posts.map((post) => (
              <li key={post.slug} className="card card-hover flex flex-col p-5">
                <PillarBadge slug={post.pillar} />
                <h3 className="mt-3 text-[17px] font-semibold leading-snug">
                  <Link href={`/blog/${post.slug}`} className="hover:text-accent-strong">
                    {post.title}
                  </Link>
                </h3>
                <p className="mt-2 flex-1 text-[13.5px] leading-relaxed text-muted">{post.dek}</p>
                <p className="mt-4 font-mono text-[11.5px] text-muted">
                  {isoDate(post.date)} · {post.readingMinutes} min
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="contact" className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <div className="card p-7 sm:p-9">
          <p className="eyebrow">Build, collaborate, discuss</p>
          <h2 className="mt-2 text-[25px] font-bold tracking-tight">
            Working on a difficult AI engineering problem?
          </h2>
          <p className="mt-3 max-w-xl text-[14.5px] leading-relaxed text-muted">
            I am open to thoughtful conversations about AI engineering roles,
            collaborations, technical writing, and practical systems work.
          </p>
          <a href={contactHref} className="btn btn-secondary mt-6">
            Start a conversation
          </a>
        </div>
        <NewsletterCTA variant="compact" />
      </section>
    </div>
  );
}
