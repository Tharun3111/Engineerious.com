import { describe, expect, it } from "vitest";

import { buildDailySitemapEntries } from "@/app/sitemap";
import { parsePublishedDailyBrief } from "@/lib/daily-brief";
import type { PublicDailyBrief } from "@/lib/daily-queries";
import { makeDailyBrief } from "@/tests/daily-fixtures";

function publicBrief(date: string, publishedAt: string): PublicDailyBrief {
  const brief = parsePublishedDailyBrief(
    makeDailyBrief({
      date,
      title: `Reviewed Daily ${date}`,
    }),
  );
  return {
    digestId: Number(date.slice(-2)),
    date,
    publishedAt: new Date(publishedAt),
    brief,
  };
}

describe("Daily sitemap entries", () => {
  it("omits the thin Daily landing page when no validated snapshot exists", () => {
    expect(buildDailySitemapEntries("https://engineerious.com", [])).toEqual([]);
  });

  it("includes the landing page and published dates with their real publication timestamps", () => {
    const latest = publicBrief("2026-08-25", "2026-08-25T16:15:00.000Z");
    const previous = publicBrief("2026-08-24", "2026-08-25T01:30:00.000Z");
    const entries = buildDailySitemapEntries("https://engineerious.com", [latest, previous]);

    expect(entries.map((entry) => entry.url)).toEqual([
      "https://engineerious.com/daily",
      "https://engineerious.com/daily/2026-08-25",
      "https://engineerious.com/daily/2026-08-24",
    ]);
    expect(entries[0].lastModified).toBe(latest.publishedAt);
    expect(entries[1].lastModified).toBe(latest.publishedAt);
    expect(entries[2].lastModified).toBe(previous.publishedAt);
    expect(entries.every((entry) => entry.lastModified instanceof Date)).toBe(true);
  });
});
