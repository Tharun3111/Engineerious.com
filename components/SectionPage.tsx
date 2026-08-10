import Link from "next/link";

import { FeedList } from "@/components/FeedList";
import { NewsletterCTA } from "@/components/NewsletterCTA";
import { SectionTabs } from "@/components/SectionTabs";
import { isDbConfigured } from "@/lib/env";
import { getFeed, type FeedSort } from "@/lib/queries";
import type { Section } from "@/lib/sections";

const PAGE_SIZE = 50;

/** Shared body for /news, /models and /open-source — same rows, different filter. */
export async function SectionPage({
  section,
  searchParams,
}: {
  section: Section;
  searchParams: Promise<{ sort?: string; page?: string }>;
}) {
  const params = await searchParams;
  const sort: FeedSort = params.sort === "new" ? "new" : "hot";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const { items, error } = isDbConfigured()
    ? await getFeed({
        type: section.type,
        sort,
        limit: PAGE_SIZE,
        offset,
      })
    : { items: [], error: null };

  const query = (nextPage: number) =>
    `${section.path}?sort=${sort}${nextPage > 1 ? `&page=${nextPage}` : ""}`;

  return (
    <div className="space-y-8 py-12 sm:py-16">
      <header className="grid gap-5 border-b border-fg pb-8 lg:grid-cols-[18rem_1fr] lg:gap-10">
        <p className="eyebrow">{section.eyebrow}</p>
        <div className="max-w-3xl">
          <h1 className="font-display text-balance text-[42px] font-semibold leading-[1.03] tracking-[-0.035em] sm:text-[56px]">
            {section.blurb}
          </h1>
          <p className="mt-5 max-w-2xl text-[17px] leading-7 text-muted sm:text-[18px]">
            {section.description}
          </p>
        </div>
      </header>

      <SectionTabs active={section.path} sort={sort} />

      <FeedList
        items={items}
        error={error}
        startRank={offset + 1}
        emptyMessage={section.emptyMessage}
      />

      {!error && (page > 1 || items.length === PAGE_SIZE) && (
        <nav aria-label="Pagination" className="flex justify-between gap-4">
          {page > 1 ? (
            <Link href={query(page - 1)} className="btn btn-secondary btn-sm">
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          {items.length === PAGE_SIZE && (
            <Link href={query(page + 1)} className="btn btn-secondary btn-sm">
              More →
            </Link>
          )}
        </nav>
      )}

      <NewsletterCTA variant="compact" />
    </div>
  );
}
