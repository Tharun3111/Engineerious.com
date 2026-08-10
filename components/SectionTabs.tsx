import Link from "next/link";

import { SECTIONS } from "@/lib/sections";
import type { FeedSort } from "@/lib/queries";

/** Tab strip + hot/new toggle. Server component — sort is a URL param, not state. */
export function SectionTabs({
  active,
  sort,
}: {
  /** Pathname of the active section, or "/" for the unified feed. */
  active: string;
  sort?: FeedSort;
}) {
  const tabs = [{ label: "Top", path: "/" }, ...SECTIONS.map((s) => ({ label: s.label, path: s.path }))];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <nav aria-label="Sections" className="rounded-full border border-rule bg-surface p-1">
        <ul className="flex flex-wrap items-center gap-0.5 text-[13.5px]">
          {tabs.map((tab) => {
            const isActive = tab.path === active;
            return (
              <li key={tab.path}>
                <Link
                  href={tab.path}
                  aria-current={isActive ? "page" : undefined}
                  className={
                    isActive
                      ? "block rounded-full bg-fg px-3.5 py-1.5 font-medium text-bg"
                      : "block rounded-full px-3.5 py-1.5 text-muted hover:text-fg"
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
        <div className="flex gap-1 rounded-full border border-rule bg-surface p-1 font-mono text-[12px]">
          {(["hot", "new"] as const).map((option) => (
            <Link
              key={option}
              href={`${active}?sort=${option}`}
              aria-current={sort === option ? "true" : undefined}
              className={
                sort === option
                  ? "rounded-full bg-accent-tint px-3 py-1 text-accent-strong"
                  : "rounded-full px-3 py-1 text-muted hover:text-fg"
              }
            >
              {option}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
