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
  todayDate,
}: {
  /** YYYY-MM */
  month: string;
  activeDates: Set<string>;
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
            const isToday = date === todayDate;

            if (!isActive) {
              return (
                <div
                  key={key}
                  className={`flex aspect-square items-center justify-center border-b border-r border-rule p-1 font-mono text-[13px] text-muted/50 ${isToday ? "ring-1 ring-inset ring-rule-strong" : ""}`}
                >
                  {dayNumber}
                </div>
              );
            }

            return (
              <Link
                key={key}
                href={`/archive/${date}`}
                className={`card-hover flex aspect-square items-center justify-center border-b border-r border-rule bg-accent-tint p-1 font-mono text-[13px] font-semibold text-accent-strong hover:bg-accent-strong hover:text-accent-fg ${isToday ? "ring-1 ring-inset ring-accent-strong" : ""}`}
              >
                {dayNumber}
              </Link>
            );
          }),
        )}
      </div>
    </div>
  );
}
