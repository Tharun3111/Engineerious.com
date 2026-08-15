import type { Metadata } from "next";

import { ArchiveCalendar } from "@/components/ArchiveCalendar";
import { NewsletterCTA } from "@/components/NewsletterCTA";
import { getAllActiveArchiveDates } from "@/lib/content/archive";
import { todayChicago } from "@/lib/time";

export const metadata: Metadata = {
  title: "Archive",
  description: "Every day's Engineerious post and coverage, browsable by date.",
  alternates: { canonical: "/archive" },
};

const MONTH_FORMAT = /^\d{4}-\d{2}$/;

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const today = todayChicago();
  const month = params.month && MONTH_FORMAT.test(params.month) ? params.month : today.slice(0, 7);

  const activeDates = await getAllActiveArchiveDates();
  const hasAnyContent = activeDates.size > 0;

  return (
    <div className="space-y-8 py-12 sm:py-16">
      <header className="grid gap-5 border-b border-fg pb-8 lg:grid-cols-[18rem_1fr] lg:gap-10">
        <p className="eyebrow">Archive</p>
        <div className="max-w-3xl">
          <h1 className="font-display text-balance text-[42px] font-semibold leading-[1.03] tracking-[-0.035em] sm:text-[56px]">
            Every day, in order.
          </h1>
          <p className="mt-5 max-w-2xl text-[17px] leading-7 text-muted sm:text-[18px]">
            Pick a date and see exactly what published that day — news, model updates, open-source releases, and the blog post.
          </p>
        </div>
      </header>

      {!hasAnyContent ? (
        <div data-feed-state="empty" className="grid gap-3 border-y border-rule py-8 sm:grid-cols-[10rem_1fr]">
          <p className="section-label">Archive status</p>
          <p className="max-w-2xl text-[16px] leading-7 text-muted">
            Nothing published yet — the archive fills in as posts clear review.
          </p>
        </div>
      ) : (
        <div data-feed-state="ok">
          <ArchiveCalendar month={month} activeDates={activeDates} todayDate={today} />
        </div>
      )}

      <NewsletterCTA />
    </div>
  );
}
