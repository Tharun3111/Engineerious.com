import Link from "next/link";

import type { Item } from "@/db/schema";
import { hostname } from "@/lib/dedupe";
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
 * The card primitive. Every public feed on the site — home, and all three sections
 * — is a list of these. (The admin moderation queue has its own row markup: it
 * needs inline approve/reject actions this component doesn't support.)
 */
export function Row({
  item,
  rank,
  highlightRank = false,
}: {
  item: Item;
  rank?: number;
  /** Only meaningful when the list is actually score-sorted (sort=hot) — passing
   *  this on a chronological list would badge "most recent" as "most important". */
  highlightRank?: boolean;
}) {
  const section = sectionFor(item.type);
  const host = hostname(item.url);
  const discussion = (item.rawJson as { discussion?: string } | null)?.discussion;
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
        <div className="flex flex-wrap items-center gap-2">
          <span className={TYPE_STYLE[item.type]}>{section.label}</span>
          {isPrimarySource && (
            <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold uppercase tracking-wide text-checkpoint">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-checkpoint" />
              Primary source
            </span>
          )}
          {host && <span className="font-mono text-[12px] text-muted">{host}</span>}
        </div>

        <p className="mt-1.5 text-[15.5px] font-medium leading-snug">
          <a href={item.url} target="_blank" rel="noopener noreferrer nofollow" className="hover:text-accent-strong hover:underline hover:decoration-1 hover:underline-offset-2">
            {item.title}
          </a>
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

        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11.5px] text-muted">
          <span>{item.source}</span>
          <span aria-hidden>·</span>
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
