const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** HN-style compact age: "12 minutes ago", "3 hours ago", "2 days ago". */
export function timeAgo(date: Date | string | null | undefined, now = new Date()): string {
  if (!date) return "unknown";
  const then = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.max(0, Math.round((now.getTime() - then.getTime()) / 1000));

  if (seconds < MINUTE) return "just now";
  if (seconds < HOUR) return plural(Math.floor(seconds / MINUTE), "minute");
  if (seconds < DAY) return plural(Math.floor(seconds / HOUR), "hour");
  if (seconds < 30 * DAY) return plural(Math.floor(seconds / DAY), "day");
  if (seconds < 365 * DAY) return plural(Math.floor(seconds / (30 * DAY)), "month");
  return plural(Math.floor(seconds / (365 * DAY)), "year");
}

function plural(n: number, unit: string) {
  return `${n} ${unit}${n === 1 ? "" : "s"} ago`;
}

export function isoDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().slice(0, 10);
}

export function longDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
