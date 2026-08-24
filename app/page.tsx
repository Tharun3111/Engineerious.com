import Link from "next/link";

import { AuthorBadge } from "@/components/AuthorBadge";
import { EntryTable } from "@/components/EntryTable";
import { NewsletterCTA } from "@/components/NewsletterCTA";
import { ScopeBlock } from "@/components/ScopeBlock";
import { StatTiles } from "@/components/StatTiles";
import { getPublishedPosts } from "@/lib/content/blog";
import { getPillar } from "@/lib/pillars";
import { isoDate } from "@/lib/time";

export const revalidate = 300;

/*
 * The front door teaches, or it shows why it's about to.
 *
 * Earlier versions of this page said the site was an agent-security
 * vulnerability tracker ("Your agent framework shipped a containment bug last
 * week") and led with a reproduction-status log. That was never the brief —
 * the actual intent, stated directly: build Tharun's personal brand, publish
 * his own writing about what he's learned building AI systems, and support it
 * with curated AI news. The one-line answer a visitor should leave with is
 * "Tharun teaches me AI engineering."
 *
 * So the hero demonstrates that instead of asserting it: the latest entry
 * renders inline with its scope block (what you'll be able to do after
 * reading it, and what it deliberately doesn't cover) — the site showing the
 * thing it does rather than describing it in the abstract.
 */
export default async function HomePage() {
  const posts = await getPublishedPosts();
  const latest = posts[0];
  const latestPillar = latest ? getPillar(latest.pillar) : undefined;

  return (
    <div className="space-y-10 py-10 sm:py-14">
      <section>
        <p className="eyebrow">AI engineering &middot; learned in public</p>
        <h1 className="font-display mt-3 max-w-[19ch] text-balance text-[28px] font-semibold leading-[1.28] tracking-[-0.03em] sm:text-[36px]">
          I write down what I learn about AI, so you don&rsquo;t have to learn it twice.
        </h1>
        <p className="mt-4 max-w-[62ch] text-[15.5px] leading-7 text-muted">
          Evaluation, MCP, retrieval, and the production details a clean demo leaves out
          &mdash; written by Tharun Chowdary, one entry at a time.
        </p>
      </section>

      {latest && (
        <section className="rounded-lg border border-rule bg-surface p-5 sm:p-6">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="eyebrow">Latest entry</span>
            <span className="ver text-muted">{isoDate(latest.date)}</span>
            <span className="ver text-muted">&middot; {latest.readingMinutes} min</span>
          </div>
          <h2 className="font-display mt-2 max-w-[32ch] text-balance text-[19px] font-semibold leading-[1.35] tracking-[-0.02em]">
            <Link href={`/blog/${latest.slug}`} className="hover:text-accent">
              {latest.title}
            </Link>
          </h2>
          <p className="mt-2 max-w-[64ch] text-[14.5px] leading-6 text-muted">{latest.dek}</p>
          {latestPillar && <p className="mt-2 ver text-accent">{latestPillar.name}</p>}
          <div className="mt-4">
            <ScopeBlock teaches={latest.teaches} notCovered={latest.notCovered} />
          </div>
        </section>
      )}

      <StatTiles posts={posts} />

      <div className="flex items-baseline justify-between gap-4 border-b border-fg pb-2.5">
        <h2 className="font-mono text-[13px] font-medium tracking-[-0.01em]">every entry</h2>
        <span className="section-label">{posts.length} total</span>
      </div>

      <EntryTable
        posts={posts}
        emptyMessage="Nothing published yet. The first entry goes up when there is one worth standing behind."
      />

      {posts.length > 0 && (
        <p className="text-[13.5px]">
          <Link href="/blog" className="font-mono font-medium text-accent hover:underline">
            All entries &rarr;
          </Link>
        </p>
      )}

      <section className="grid gap-8 border-t-2 border-fg pt-10 lg:grid-cols-[minmax(0,1fr)_28rem]">
        <div>
          <p className="section-label">Who writes this</p>
          <div className="mt-3 flex items-center gap-3">
            <AuthorBadge size="lg" />
            <h2 className="font-display max-w-[20ch] text-balance text-[21px] font-semibold leading-[1.25] tracking-[-0.02em]">
              Tharun Chowdary
            </h2>
          </div>
          <p className="mt-4 max-w-[52ch] text-[15px] leading-7 text-muted">
            I build AI systems and write down what breaks, what I got wrong, and what
            actually held up past the demo. Every entry says whether it was tested here
            and what it deliberately doesn&rsquo;t cover &mdash; the limits are part of the
            teaching.
          </p>
          <Link
            href="/about"
            className="mt-6 inline-flex min-h-11 items-center text-[13.5px] font-semibold text-accent underline decoration-1 underline-offset-4"
          >
            About Tharun
          </Link>
        </div>

        <div className="border border-rule bg-surface p-6 sm:p-8">
          <NewsletterCTA
            variant="compact"
            heading="Get the next entry"
            blurb="Sent when there's something worth reading, not on a schedule."
          />
        </div>
      </section>
    </div>
  );
}
