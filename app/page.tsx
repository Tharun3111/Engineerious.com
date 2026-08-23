import Link from "next/link";

import { Census } from "@/components/Census";
import { LogTable } from "@/components/LogTable";
import { NewsletterCTA } from "@/components/NewsletterCTA";
import { getPublishedPosts } from "@/lib/content/blog";

export const revalidate = 300;

/*
 * The front door is the log.
 *
 * What stood here before: a Today bar, a full-viewport hero beside a dark Proof
 * Loop diagram panel, three numbered desk-lane cards, an "Open research log" of
 * three hardcoded questions with nothing behind them, four evidence boxes, a bio
 * block and a newsletter block. Nine sections, and the writing itself sat roughly
 * 3,000px down.
 *
 * The reviewers all landed on the same reading: the page explained itself six
 * separate times and demonstrated nothing. The desk lanes duplicated the nav for a
 * fourth time; the research log advertised active investigations that were a
 * `const` array.
 *
 * So it shows the thing instead of describing it. One statement, the census, the
 * log. A visitor who scrolls past the headline hits real entries with their
 * reproduction status attached — the only argument this site actually has.
 */
export default async function HomePage() {
  const posts = await getPublishedPosts();

  return (
    <div className="space-y-10 py-12 sm:py-16">
      <section className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-end">
        <h1 className="font-display max-w-[19ch] text-balance text-[40px] font-semibold leading-[1.04] tracking-[-0.03em] sm:text-[56px] lg:text-[62px]">
          Your agent framework shipped a containment bug last week.
        </h1>
        <div className="space-y-4 lg:pb-2">
          <p className="text-[16px] leading-7 text-muted">
            I track disclosed exploits, containment failures and patched versions across
            LangChain, CrewAI, AutoGen and MCP &mdash; and every entry says whether I
            could reproduce it here.
          </p>
          <p className="text-[16px] leading-7 text-muted">
            Most of the industry reports the claim.{" "}
            <span className="font-semibold text-fg">This log reports the attempt.</span>
          </p>
        </div>
      </section>

      <Census posts={posts} />

      <LogTable
        posts={posts}
        emptyMessage="Nothing published yet. The first entry goes up when there is one worth standing behind."
      />

      {posts.length > 0 && (
        <p className="text-[14px]">
          <Link href="/blog" className="font-semibold underline decoration-1 underline-offset-4">
            The full log
          </Link>
        </p>
      )}

      <section className="grid gap-8 border-t-2 border-fg pt-10 lg:grid-cols-[minmax(0,1fr)_28rem]">
        <div>
          <p className="section-label">Who writes this</p>
          <h2 className="font-display mt-3 max-w-[20ch] text-balance text-[30px] font-semibold leading-[1.12] tracking-[-0.025em]">
            One engineer, and the receipts are on every entry.
          </h2>
          <p className="mt-4 max-w-[52ch] text-[16px] leading-7 text-muted">
            Every record carries its origin, its sources, whether the claims were tested,
            and who reviewed it. The schema refuses to mark anything verified without a
            named human reviewer and a timestamp &mdash; so when an entry says nobody
            reproduced it, that is the site telling on itself.
          </p>
          <Link
            href="/about"
            className="mt-6 inline-flex min-h-11 items-center text-[14px] font-semibold underline decoration-1 underline-offset-4"
          >
            About Tharun and the standard
          </Link>
        </div>

        {/* `compact` so the CTA's own border-y doesn't draw a second frame inside
            this card. */}
        <div className="border border-rule bg-surface p-6 sm:p-8">
          <NewsletterCTA
            variant="compact"
            heading="Get the next entry"
            blurb="Sent when something changes, not on a schedule."
          />
        </div>
      </section>
    </div>
  );
}
