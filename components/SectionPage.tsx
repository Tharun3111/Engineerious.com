import Link from "next/link";

import { FeedList } from "@/components/FeedList";
import { NewsletterCTA } from "@/components/NewsletterCTA";
import { SectionTabs } from "@/components/SectionTabs";
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

  const { items, error } = await getFeed({
    type: section.type,
    sort,
    limit: PAGE_SIZE,
    offset,
  });

  const query = (nextPage: number) =>
    `${section.path}?sort=${sort}${nextPage > 1 ? `&page=${nextPage}` : ""}`;

  return (
    <div className="space-y-6 py-8">
      <header className="max-w-2xl space-y-1.5">
        <p className="eyebrow">{section.label}</p>
        <h1 className="text-[26px] font-bold tracking-tight">{section.blurb}</h1>
      </header>

      <SectionTabs active={section.path} sort={sort} />

      <FeedList items={items} error={error} startRank={offset + 1} />

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
