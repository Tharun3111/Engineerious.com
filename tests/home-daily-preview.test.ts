import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DailyHomeModule } from "@/app/page";
import { parsePublishedDailyBrief } from "@/lib/daily-brief";
import type { DailyBriefQueryResult } from "@/lib/daily-queries";
import { makeDailyBrief } from "@/tests/daily-fixtures";

function render(result: DailyBriefQueryResult): string {
  return renderToStaticMarkup(createElement(DailyHomeModule, { result }));
}

describe("homepage Daily preview", () => {
  it("renders only the validated public snapshot with its date, summary, and human take", () => {
    const brief = parsePublishedDailyBrief(makeDailyBrief());
    const html = render({
      brief: {
        digestId: 42,
        date: brief.date,
        publishedAt: new Date("2026-08-25T16:00:00.000Z"),
        brief,
      },
      error: null,
    });

    expect(html).toContain('data-feed-state="published"');
    expect(html).toContain('dateTime="2026-08-25"');
    expect(html).toContain("A reviewed day in AI engineering");
    expect(html).toContain("A grounded summary of the changes");
    expect(html).toContain("The biggest verified change");
    expect(html).toContain("Human perspective");
    expect(html).toContain("testable change rather than the headline");
    expect(html).toContain('href="/daily/2026-08-25"');
    expect(html).not.toContain("still on the editorial desk");
  });

  it("preserves the honest editorial-desk state when no snapshot is public", () => {
    const html = render({ brief: null, error: null });
    expect(html).toContain('data-feed-state="empty"');
    expect(html).toContain("The first reviewed brief is still on the editorial desk.");
    expect(html).toContain("It stays empty until the structured brief");
    expect(html).not.toContain("A reviewed day in AI engineering");
  });

  it("does not substitute private content when the public query is unavailable", () => {
    const html = render({ brief: null, error: "database unavailable" });
    expect(html).toContain('data-feed-state="unavailable"');
    expect(html).toContain("Private drafts are never used as a fallback.");
    expect(html).not.toContain("still on the editorial desk");
  });
});
