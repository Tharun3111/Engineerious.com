import Link from "next/link";

import {
  deriveDailyQuickSheet,
  type DailyQuickSheetSlot,
  type PublishedDailyBrief,
} from "@/lib/daily-brief";

function Slot({ slot }: { slot: DailyQuickSheetSlot }) {
  return (
    <li className="grid gap-1 py-3.5 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:gap-5">
      <span className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-accent-strong">
        {slot.label}
      </span>
      <div>
        <p className="text-[14px] font-semibold leading-5 text-fg">{slot.title}</p>
        <p className="mt-1 text-[13.5px] leading-5 text-muted">{slot.detail}</p>
        {slot.sourceUrl ? (
          <Link
            href={slot.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1.5 inline-flex min-h-11 items-center font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-accent hover:underline"
          >
            Source <span className="sr-only">(opens in a new tab)</span>
          </Link>
        ) : null}
      </div>
    </li>
  );
}

export function DailyQuickSheet({ brief }: { brief: PublishedDailyBrief }) {
  const sheet = deriveDailyQuickSheet(brief);
  const optionalSlots = [
    sheet.model,
    sheet.openSource,
    sheet.framework,
    sheet.research,
    sheet.worthLearning,
  ].filter((slot): slot is DailyQuickSheetSlot => slot !== null);
  const slots = [sheet.biggestStory, ...optionalSlots, sheet.myTake];

  return (
    <aside
      aria-labelledby="daily-quick-sheet-title"
      className="border-l-2 border-accent bg-surface px-5 py-5 sm:px-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-rule pb-3">
        <div>
          <p className="eyebrow">Quick sheet</p>
          <h2 id="daily-quick-sheet-title" className="font-display mt-1 text-[18px] font-semibold">
            {sheet.label}
          </h2>
        </div>
        <p className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted">
          {sheet.storyCount} {sheet.storyCount === 1 ? "story" : "stories"} &middot;{" "}
          {sheet.sourceCount} {sheet.sourceCount === 1 ? "source" : "sources"}
        </p>
      </div>
      <ol className="divide-y divide-rule">
        {slots.map((slot) => (
          <Slot key={`${slot.label}:${slot.title}`} slot={slot} />
        ))}
      </ol>
    </aside>
  );
}
