import type { Metadata } from "next";
import Link from "next/link";

import { NewsletterCTA } from "@/components/NewsletterCTA";
import { getArchiveIndex } from "@/lib/content/archive";
import { longDate } from "@/lib/time";

export const metadata: Metadata = {
  title: "Archive",
  description: "Every day's Engineerious post and coverage, browsable by date.",
  alternates: { canonical: "/archive" },
};

export default async function ArchivePage() {
  const days = await getArchiveIndex();

  return (
    <div className="space-y-8 py-12 sm:py-16">
      <header className="grid gap-5 border-b border-fg pb-8 lg:grid-cols-[18rem_1fr] lg:gap-10">
        <p className="eyebrow">Archive</p>
        <div className="max-w-3xl">
          <h1 className="font-display text-balance text-[42px] font-semibold leading-[1.03] tracking-[-0.035em] sm:text-[56px]">
            Every day, in order.
          </h1>
          <p className="mt-5 max-w-2xl text-[17px] leading-7 text-muted sm:text-[18px]">
            Pick a date and see exactly what published that day.
          </p>
        </div>
      </header>

      {days.length === 0 ? (
        <div data-feed-state="empty" className="grid gap-3 border-y border-rule py-8 sm:grid-cols-[10rem_1fr]">
          <p className="section-label">Archive status</p>
          <p className="max-w-2xl text-[16px] leading-7 text-muted">
            Nothing published yet — the archive fills in as posts clear review.
          </p>
        </div>
      ) : (
        <ul data-feed-state="ok" data-feed-count={days.length} className="divide-y divide-rule border-y border-rule">
          {days.map(({ date, posts }) => (
            <li key={date} className="grid gap-2 py-4 sm:grid-cols-[10rem_1fr]">
              <Link href={`/archive/${date}`} className="font-mono text-[13px] text-muted hover:text-accent-strong">
                {longDate(new Date(`${date}T00:00:00Z`))}
              </Link>
              <ul className="space-y-1">
                {posts.map((post) => (
                  <li key={post.slug}>
                    <Link href={`/blog/${post.slug}`} className="text-[15px] font-semibold hover:text-accent-strong">
                      {post.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      <NewsletterCTA />
    </div>
  );
}
