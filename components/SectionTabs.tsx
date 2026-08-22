import Link from "next/link";

import type { FeedSort } from "@/lib/queries";

/** /news and /models are closed (lib/public-launch.ts) — a tab strip of one is
 *  just a heading, so SectionTabs renders nothing until a second surface returns. */
const PUBLIC_SECTIONS = [{ label: "Blog", path: "/blog" }] as const;

/** Tab strip + hot/new toggle. Server component — sort is a URL param, not state. */
export function SectionTabs({
  active,
  sort,
}: {
  /** Pathname of the active section, or "/" for the unified feed. */
  active: string;
  sort?: FeedSort;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-y border-rule">
      <nav aria-label="Content sections">
        <ul className="flex items-center gap-6 text-[15px] sm:gap-8">
          {PUBLIC_SECTIONS.map((tab) => {
            const isActive = tab.path === active;
            return (
              <li key={tab.path}>
                <Link
                  href={tab.path}
                  aria-current={isActive ? "page" : undefined}
                  className={
                    isActive
                      ? "flex min-h-12 items-center border-b-2 border-fg font-semibold text-fg"
                      : "flex min-h-12 items-center border-b-2 border-transparent text-muted hover:text-fg"
                  }
                >
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {sort && (
        <div className="flex min-h-12 items-center gap-1 text-[13px]">
          <span className="mr-2 text-muted">Sort</span>
          {(["hot", "new"] as const).map((option) => (
            <Link
              key={option}
              href={`${active}?sort=${option}`}
              aria-current={sort === option ? "true" : undefined}
              className={
                sort === option
                  ? "inline-flex min-h-11 items-center border-b-2 border-accent-strong px-2 font-semibold text-accent-strong"
                  : "inline-flex min-h-11 items-center border-b-2 border-transparent px-2 text-muted hover:text-fg"
              }
            >
              {option === "hot" ? "Top" : "Newest"}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
