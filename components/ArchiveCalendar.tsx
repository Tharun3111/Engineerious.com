import Link from "next/link";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseMonth(month: string): { year: number; monthIndex: number } {
  const [year, m] = month.split("-").map(Number);
  return { year, monthIndex: m - 1 };
}

function formatMonth(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/** 0 = Sunday .. 6 = Saturday. Pure calendar math via Date.UTC — never touches
 *  wall-clock "now" or any timezone, so it can't drift with server locale. */
function firstWeekday(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
}

function monthLabel(year: number, monthIndex: number): string {
  return new Date(Date.UTC(year, monthIndex, 1)).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

/**
 * Month grid — the primary navigation for /archive. Days with content are real
 * links to /archive/[date]; days without are plain dimmed text, not clickable.
 * Pure server component: month navigation is ?month=YYYY-MM via Link, no client JS.
 */
export function ArchiveCalendar({
  month,
  activeDates,
  postDates,
  todayDate,
}: {
  /** YYYY-MM */
  month: string;
  activeDates: Set<string>;
  /** Subset of activeDates that has a published blog post, not just ingested items. */
  postDates?: Set<string>;
  /** todayChicago() — used for the "today" marker and to cap forward navigation. */
  todayDate: string;
}) {
  const { year, monthIndex } = parseMonth(month);
  const totalDays = daysInMonth(year, monthIndex);
  const startWeekday = firstWeekday(year, monthIndex);
  const monthPrefix = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;

  const cells: (string | null)[] = [
    ...Array<null>(startWeekday).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => `${monthPrefix}-${String(i + 1).padStart(2, "0")}`),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const prev = monthIndex === 0 ? { year: year - 1, monthIndex: 11 } : { year, monthIndex: monthIndex - 1 };
  const next = monthIndex === 11 ? { year: year + 1, monthIndex: 0 } : { year, monthIndex: monthIndex + 1 };
  const currentMonth = todayDate.slice(0, 7);
  const canGoNext = formatMonth(next.year, next.monthIndex) <= currentMonth;

  return (
    <div>
      <div className="flex items-center justify-between gap-4 pb-4">
        <h2 className="text-[20px] font-semibold tracking-tight">{monthLabel(year, monthIndex)}</h2>
        <nav aria-label="Change month" className="flex items-center gap-1">
          <Link
            href={`/archive?month=${formatMonth(prev.year, prev.monthIndex)}`}
            className="btn btn-secondary btn-sm"
            aria-label="Previous month"
          >
            ←
          </Link>
          {canGoNext ? (
            <Link
              href={`/archive?month=${formatMonth(next.year, next.monthIndex)}`}
              className="btn btn-secondary btn-sm"
              aria-label="Next month"
            >
              →
            </Link>
          ) : (
            <span aria-hidden className="btn btn-secondary btn-sm opacity-30">
              →
            </span>
          )}
        </nav>
      </div>

      <div className="grid grid-cols-7 border-l border-t border-rule text-center">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="border-b border-r border-rule bg-surface-2 py-2 font-mono text-[11px] font-semibold uppercase tracking-wide text-muted">
            {label}
          </div>
        ))}

        {weeks.flatMap((week, weekIndex) =>
          week.map((date, dayIndex) => {
            const key = `${weekIndex}-${dayIndex}`;
            if (!date) {
              return <div key={key} className="border-b border-r border-rule bg-surface-2/40" />;
            }

            const dayNumber = Number(date.slice(-2));
            const isActive = activeDates.has(date);
            const hasPost = postDates?.has(date) ?? false;
            const isToday = date === todayDate;

            if (!isActive) {
              return (
                <div
                  key={key}
                  className={`flex min-h-14 items-start justify-end border-b border-r border-rule p-2 font-mono text-[13px] text-muted/50 sm:min-h-16 ${isToday ? "ring-1 ring-inset ring-rule-strong" : ""}`}
                >
                  {dayNumber}
                </div>
              );
            }

            return (
              <Link
                key={key}
                href={`/archive/${date}`}
                aria-label={`${date}${hasPost ? " — includes a blog post" : ""}`}
                className={`card-hover group flex min-h-14 flex-col items-end justify-between border-b border-r border-rule bg-accent-tint p-2 font-mono text-[13px] font-semibold text-accent-strong hover:bg-accent-strong hover:text-accent-fg sm:min-h-16 ${isToday ? "ring-1 ring-inset ring-accent-strong" : ""}`}
              >
                <span>{dayNumber}</span>
                {/* A day with a post is the reason to click; a day with only
                 *  ingested items is browsable but not an event. The tint alone
                 *  couldn't tell those apart. */}
                {hasPost && (
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 self-start rounded-full bg-accent-strong group-hover:bg-accent-fg"
                  />
                )}
              </Link>
            );
          }),
        )}
      </div>

      <p className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="h-3 w-3 border border-rule bg-accent-tint" />
          Published that day
        </span>
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent-strong" />
          Includes a blog post
        </span>
      </p>
    </div>
  );
}
