import type { Metadata } from "next";
import Link from "next/link";

import { NewsletterCTA } from "@/components/NewsletterCTA";
import { PillarBadge } from "@/components/PillarBadge";
import { SectionTabs } from "@/components/SectionTabs";
import { getPublishedPosts } from "@/lib/content/blog";
import { PILLARS } from "@/lib/pillars";
import { isoDate } from "@/lib/time";

export const metadata: Metadata = {
  title: "Engineering blog",
  description:
    "Practical guides on AI evaluation, agents, retrieval, model infrastructure, and production reliability.",
  alternates: { canonical: "/blog" },
};

/**
 * The one place on the site that gets a little warmth — title, dek, pillar, read
 * time. Everything else is a row.
 */
export default async function BlogIndexPage() {
  const posts = await getPublishedPosts();

  return (
    <div className="space-y-8 py-12 sm:py-16">
      <header className="grid gap-5 border-b border-fg pb-8 lg:grid-cols-[18rem_1fr] lg:gap-10">
        <p className="eyebrow">Engineering blog / 03</p>
        <div className="max-w-3xl">
          <h1 className="font-display text-balance text-[42px] font-semibold leading-[1.03] tracking-[-0.035em] sm:text-[56px]">
            Practical guides for building reliable AI systems.
          </h1>
          <p className="mt-5 max-w-2xl text-[17px] leading-7 text-muted sm:text-[18px]">
            Learn from tested approaches, production failures, and open questions across evaluation, agents, retrieval, and model infrastructure.
          </p>
        </div>
      </header>

      <SectionTabs active="/blog" />

      <nav aria-label="Pillars" className="flex flex-wrap gap-2">
        {PILLARS.map((pillar) => (
          <PillarBadge key={pillar.slug} slug={pillar.slug} />
        ))}
      </nav>

      {posts.length === 0 ? (
        <div data-feed-state="empty" className="grid gap-3 border-y border-rule py-8 sm:grid-cols-[10rem_1fr]">
          <p className="section-label">Editorial status</p>
          <p className="max-w-2xl text-[16px] leading-7 text-muted">
            No engineering guides are published yet. Drafts stay private until their claims, sources, and authorship have been reviewed. Subscribe below to get the first one.
          </p>
        </div>
      ) : (
        <ul data-feed-state="ok" data-feed-count={posts.length} className="grid gap-4 sm:grid-cols-2">
          {posts.map((post) => (
            <li key={post.slug} className="card card-hover flex flex-col p-5">
              <div className="flex flex-wrap items-center gap-2">
                <PillarBadge slug={post.pillar} />
                {post.draft && <span className="pill">draft</span>}
              </div>
              <h2 className="mt-3 text-[17px] font-semibold leading-snug">
                <Link href={`/blog/${post.slug}`} className="hover:text-accent-strong">
                  {post.title}
                </Link>
              </h2>
              <p className="mt-1.5 flex-1 text-[13.5px] text-muted">{post.dek}</p>
              <p className="mt-3 font-mono text-[11.5px] text-muted">
                {isoDate(post.date)} · {post.readingMinutes} min read
              </p>
            </li>
          ))}
        </ul>
      )}

      <NewsletterCTA />
    </div>
  );
}
