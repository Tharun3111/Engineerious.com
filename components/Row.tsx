import Link from "next/link";

import type { Item } from "@/db/schema";
import { hostname } from "@/lib/dedupe";
import { isHttpUrl } from "@/lib/editorial-safety";
import { sectionFor } from "@/lib/sections";
import { timeAgo } from "@/lib/time";

const TYPE_STYLE: Record<Item["type"], string> = {
  news: "pill",
  model: "pill pill-accent",
  oss: "pill",
};

/** Matches lib/sources.ts's "4-5 = primary lab / first-party release" band. */
const PRIMARY_SOURCE_THRESHOLD = 4;

/**
 * The card primitive for the three section feeds (/news, /models, /open-source),
 * via SectionPage -> FeedList. Not used on home (its own lane cards) or in
 * /admin (needs inline approve/reject actions this component doesn't support).
 */
export function Row({
  item,
  rank,
  highlightRank = false,
  showType = true,
}: {
  item: Item;
  rank?: number;
  /** Only meaningful when the list is actually score-sorted (sort=hot) — passing
   *  this on a chronological list would badge "most recent" as "most important". */
  highlightRank?: boolean;
  /** False on the single-type section pages (/news, /models, /open-source), where
   *  the pill would repeat the page's own title on all 50 rows. True on mixed
   *  lists (home, /archive/[date]) where the type is the row's only type signal. */
  showType?: boolean;
}) {
  const section = sectionFor(item.type);
  const safeItemUrl = isHttpUrl(item.url);
  const host = safeItemUrl ? hostname(item.url) : "";
  const rawDiscussion = (item.rawJson as { discussion?: unknown } | null)?.discussion;
  const discussion =
    typeof rawDiscussion === "string" && isHttpUrl(rawDiscussion) ? rawDiscussion : null;
  const isTopRanked = highlightRank && rank !== undefined && rank <= 3;
  const isPrimarySource = item.sourceWeight >= PRIMARY_SOURCE_THRESHOLD;

  return (
    <li className="card card-hover flex gap-3 p-4">
      {rank !== undefined && (
        <span
          aria-hidden
          className={
            isTopRanked
              ? "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-strong font-mono text-[12px] font-bold tabular-nums text-accent-fg"
              : "w-6 shrink-0 pt-0.5 text-right font-mono text-[13px] tabular-nums text-muted"
          }
        >
          {rank}
        </span>
      )}

      <div className="min-w-0 flex-1">
        {(showType || isPrimarySource) && (
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            {showType && <span className={TYPE_STYLE[item.type]}>{section.label}</span>}
            {isPrimarySource && (
              <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold uppercase tracking-wide text-positive">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-positive" />
                Primary source
              </span>
            )}
          </div>
        )}

        <p className="text-[17px] font-semibold leading-snug tracking-[-0.01em]">
          {safeItemUrl ? (
            <a href={item.url} target="_blank" rel="noopener noreferrer nofollow" className="hover:text-accent-strong hover:underline hover:decoration-1 hover:underline-offset-2">
              {item.title}
            </a>
          ) : (
            <span>{item.title}</span>
          )}
        </p>

        {item.aiNote && (
          <p className="mt-1 text-[13.5px] text-muted">
            <span className="mr-1 font-mono text-[11px] uppercase tracking-wide text-accent-strong">
              AI-generated context
            </span>
            {item.aiNote}
          </p>
        )}

        {!item.aiNote && item.summary && (
          <p className="mt-1 line-clamp-2 text-[13.5px] text-muted">{item.summary}</p>
        )}

        {/* item.source is the adapter slug ("news", "models") — on a section page
         * it repeats the pill AND the page title, so `host` is the only origin
         * worth a line here. Publisher first: it's what decides whether the row
         * is worth a click. */}
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[12px] text-muted">
          {host && (
            <>
              <span className="text-fg/70">{host}</span>
              <span aria-hidden>·</span>
            </>
          )}
          <span>{timeAgo(item.publishedAt ?? item.firstSeen)}</span>
          {item.points > 0 && (
            <>
              <span aria-hidden>·</span>
              <span>{item.points} pts</span>
            </>
          )}
          <span aria-hidden>·</span>
          <Link href={`${section.path}/${item.id}`} className="hover:text-fg">
            View details
          </Link>
          {discussion && (
            <>
              <span aria-hidden>·</span>
              <a href={discussion} target="_blank" rel="noopener noreferrer" className="hover:text-fg">
                Join discussion
              </a>
            </>
          )}
        </p>
      </div>
    </li>
  );
}
