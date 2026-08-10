import type { Metadata } from "next";
import Link from "next/link";

import { NewsletterCTA } from "@/components/NewsletterCTA";
import { PillarBadge } from "@/components/PillarBadge";
import { getAllPosts } from "@/lib/content/blog";
import { PILLARS } from "@/lib/pillars";
import { isoDate } from "@/lib/time";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Long-form writing on eval-first AI engineering, MCP in production, and production RAG & MLOps.",
  alternates: { canonical: "/blog" },
};

/**
 * The one place on the site that gets a little warmth — title, dek, pillar, read
 * time. Everything else is a row.
 */
export default function BlogIndexPage() {
  const posts = getAllPosts();

  return (
    <div className="space-y-8 py-8">
      <header className="max-w-2xl space-y-2">
        <p className="eyebrow">Blog</p>
        <h1 className="text-[26px] font-bold tracking-tight leading-tight">
          Systems thinking, not demos
        </h1>
        <p className="text-[15px] text-muted">
          Three pillars, written from things that actually ran in production —
          including the parts that did not work.
        </p>
      </header>

      <nav aria-label="Pillars" className="flex flex-wrap gap-2">
        {PILLARS.map((pillar) => (
          <PillarBadge key={pillar.slug} slug={pillar.slug} />
        ))}
      </nav>

      {posts.length === 0 ? (
        <p data-feed-state="empty" className="card p-5 text-[14px] text-muted">
          No posts published yet.
        </p>
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
