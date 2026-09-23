import type { Metadata } from "next";

import { EntryTable } from "@/components/EntryTable";
import { NewsletterCTA } from "@/components/NewsletterCTA";
import { SectionTabs } from "@/components/SectionTabs";
import { StatTiles } from "@/components/StatTiles";
import { getPublishedWritingPosts } from "@/lib/content/blog";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Writing",
  description:
    "What I've learned building AI systems that work past the demo — evaluation, agents, retrieval, and model infrastructure.",
  alternates: { canonical: "/blog" },
};

/**
 * Every entry Tharun has published, oldest to newest reversed. The one place
 * on the site that gets a little warmth — title, dek, pillar, read time.
 * Everything else is a row.
 */
export default async function BlogIndexPage() {
  const posts = await getPublishedWritingPosts();

  return (
    <div className="space-y-8 py-10 sm:py-14">
      <header className="border-b border-fg pb-6">
        <p className="eyebrow">Writing</p>
        <h1 className="font-display mt-3 max-w-[22ch] text-balance text-[26px] font-semibold leading-[1.3] tracking-[-0.025em] sm:text-[32px]">
          Engineering notes, explanations, and decisions worth writing down.
        </h1>
        <p className="mt-4 max-w-[52ch] text-[15px] leading-7 text-muted">
          Human-authored and clearly disclosed AI-assisted work lives here. Reviewed
          machine-produced briefs stay in Daily, where they belong.
        </p>
      </header>

      <SectionTabs active="/blog" />

      <StatTiles posts={posts} />

      <EntryTable
        posts={posts}
        emptyMessage="No entries are published yet. Drafts stay private until their claims, sources and authorship have been reviewed."
      />

      <NewsletterCTA />
    </div>
  );
}
