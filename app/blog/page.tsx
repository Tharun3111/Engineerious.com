import type { Metadata } from "next";

import { NewsletterCTA } from "@/components/NewsletterCTA";
import { Census } from "@/components/Census";
import { LogTable } from "@/components/LogTable";
import { SectionTabs } from "@/components/SectionTabs";
import { getPublishedPosts } from "@/lib/content/blog";

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

      <Census posts={posts} />

      <LogTable
        posts={posts}
        emptyMessage="No entries are published yet. Drafts stay private until their claims, sources and authorship have been reviewed."
      />

      <NewsletterCTA />
    </div>
  );
}
