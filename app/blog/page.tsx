import type { Metadata } from "next";
import Link from "next/link";

import { NewsletterCTA } from "@/components/NewsletterCTA";
import { Plate, plateStateFor } from "@/components/Plate";
import { SectionTabs } from "@/components/SectionTabs";
import { getPublishedPosts } from "@/lib/content/blog";
import { getPillar } from "@/lib/pillars";
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
        <p className="eyebrow">The log</p>
        <div className="max-w-3xl">
          <h1 className="font-display text-balance text-[40px] font-semibold leading-[1.04] tracking-[-0.033em] sm:text-[52px]">
            What escaped, and whether I could make it happen again.
          </h1>
          <p className="mt-5 max-w-[46ch] text-[16.5px] leading-7 text-muted">
            Every entry states whether the finding was reproduced here. Most of the
            industry reports the claim. This log reports the attempt.
          </p>
        </div>
      </header>

      <SectionTabs active="/blog" />

      {posts.length === 0 ? (
        <div data-feed-state="empty" className="grid gap-3 border-y border-rule py-8 sm:grid-cols-[10rem_1fr]">
          <p className="section-label">Editorial status</p>
          <p className="max-w-2xl text-[16px] leading-7 text-muted">
            No engineering guides are published yet. Drafts stay private until their claims, sources, and authorship have been reviewed. Subscribe below to get the first one.
          </p>
        </div>
      ) : (
        <div data-feed-state="ok" data-feed-count={posts.length} className="overflow-x-auto">
          <table className="w-full border-collapse text-[14px]">
            <thead>
              <tr>
                {["Reproduction", "Entry", "Origin", "Sources", "Published"].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="whitespace-nowrap border-b border-fg pb-2.5 pr-4 text-left font-sans text-[10.5px] font-semibold uppercase tracking-[0.11em] text-muted"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => {
                const pillar = getPillar(post.pillar);
                return (
                  <tr key={post.slug} className="align-top transition-colors duration-150 hover:bg-surface">
                    <td className="border-b border-rule py-4 pr-4">
                      <Plate state={plateStateFor(post)} />
                    </td>
                    <td className="border-b border-rule py-4 pr-4">
                      <Link href={`/blog/${post.slug}`} className="block max-w-[52ch]">
                        <span className="block text-[16px] font-semibold leading-snug tracking-[-0.005em]">
                          {post.title}
                        </span>
                        <span className="mt-1 block text-[13.5px] leading-6 text-muted">
                          {pillar ? pillar.name : "Unfiled"}
                          {post.draft ? " · draft" : ""}
                        </span>
                      </Link>
                    </td>
                    <td className="ver border-b border-rule py-4 pr-4 text-muted">
                      {post.origin === "human" ? "human" : post.origin === "ai_assisted" ? "ai-assisted" : "ai draft"}
                    </td>
                    <td className="ver border-b border-rule py-4 pr-4 text-muted">{post.sourceStatus}</td>
                    <td className="ver border-b border-rule py-4 pr-4 text-muted">{isoDate(post.date)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <NewsletterCTA />
    </div>
  );
}
