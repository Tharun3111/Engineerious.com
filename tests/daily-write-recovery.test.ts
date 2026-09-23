import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { selectDailyWriteRecovery } from "@/lib/daily-write-recovery";

describe("Daily WRITE checkpoint recovery", () => {
  it("generates a structured draft only when no checkpoint exists", () => {
    expect(selectDailyWriteRecovery({ blogPostSlug: null, dailyDraft: null })).toBe(
      "generate_structured",
    );
  });

  it("reuses the structured checkpoint without paying for WRITE again", () => {
    expect(
      selectDailyWriteRecovery({
        blogPostSlug: null,
        dailyDraft: { date: "2026-08-25", title: "Today", stories: [] },
      }),
    ).toBe("resume_structured");
  });

  it("keeps legacy post recovery available", () => {
    expect(
      selectDailyWriteRecovery({ blogPostSlug: "2026-08-25-legacy", dailyDraft: null }),
    ).toBe("resume_legacy");
  });

  it("fails loudly when both checkpoint formats are present", () => {
    expect(() =>
      selectDailyWriteRecovery({
        blogPostSlug: "2026-08-25-legacy",
        dailyDraft: { date: "2026-08-25", title: "Today", stories: [] },
      }),
    ).toThrow(/both a legacy blog post and a structured Daily draft/);
  });

  it("checks checkpoint conflicts before every digest status or review shortcut", () => {
    const route = readFileSync(
      `${process.cwd()}/app/api/cron/daily-write/route.ts`,
      "utf8",
    );
    const claimStart = route.indexOf("async function claimDigestForWrite");
    const conflictCheck = route.indexOf("const recoveryMode = selectDailyWriteRecovery", claimStart);
    const researchLookup = route.indexOf("const [run] = await db.select()", claimStart);
    const rejectedShortcut = route.indexOf('if (digest.status === "rejected")', claimStart);
    const pastWritingShortcut = route.indexOf('if (digest.status === "pending_review"', claimStart);
    const reviewedShortcut = route.indexOf("if (digest.blogPostSlug && digest.reviewReport)", claimStart);

    expect(claimStart).toBeGreaterThanOrEqual(0);
    expect(conflictCheck).toBeGreaterThan(claimStart);
    expect(conflictCheck).toBeLessThan(researchLookup);
    expect(conflictCheck).toBeLessThan(rejectedShortcut);
    expect(conflictCheck).toBeLessThan(pastWritingShortcut);
    expect(conflictCheck).toBeLessThan(reviewedShortcut);
  });
});
