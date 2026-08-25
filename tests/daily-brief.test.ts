import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { digests } from "@/db/schema";
import {
  collectDailySourceUrls,
  createDailyStoryId,
  dailyBriefDraftSchema,
  factualContentHash,
  generatedDailyBriefSchema,
  myTakeContentHash,
  publishedDailyBriefSchema,
} from "@/lib/daily-brief";
import { makeDailyBrief } from "@/tests/daily-fixtures";

describe("Daily Brief v1 schema", () => {
  it("stores one private draft and one public snapshot, never a second quick-sheet copy", () => {
    const columns = getTableColumns(digests);
    expect(columns).toHaveProperty("dailyDraft");
    expect(columns).toHaveProperty("dailyPublished");
    expect(columns).toHaveProperty("draftVersion");
    expect(columns).not.toHaveProperty("dailyQuickSheet");
    expect(columns).not.toHaveProperty("quickSheet");
  });

  it("accepts an explicit v1 draft with nullable model facts", () => {
    expect(dailyBriefDraftSchema.safeParse(makeDailyBrief()).success).toBe(true);
  });

  it("requires schemaVersion 1 and explicit nullable model fields", () => {
    const wrongVersion = { ...makeDailyBrief(), schemaVersion: 2 };
    expect(dailyBriefDraftSchema.safeParse(wrongVersion).success).toBe(false);

    const missingLicense = makeDailyBrief();
    const model = { ...missingLicense.modelToKnow } as Record<string, unknown>;
    delete model.license;
    expect(
      dailyBriefDraftSchema.safeParse({ ...missingLicense, modelToKnow: model }).success,
    ).toBe(false);
  });

  it("allows only one to ten stories with unique IDs", () => {
    expect(dailyBriefDraftSchema.safeParse(makeDailyBrief({ stories: [] })).success).toBe(false);
    const duplicate = makeDailyBrief().stories[0];
    expect(
      dailyBriefDraftSchema.safeParse(makeDailyBrief({ stories: [duplicate, duplicate] })).success,
    ).toBe(false);
    expect(
      dailyBriefDraftSchema.safeParse(
        makeDailyBrief({
          stories: Array.from({ length: 11 }, (_, index) => ({
            ...duplicate,
            id: `story-${index}`,
          })),
        }),
      ).success,
    ).toBe(false);
  });

  it.each([
    ["story", () => {
      const brief = makeDailyBrief();
      brief.stories[0] = { ...brief.stories[0], sourceUrls: ["javascript:alert(1)"] };
      return brief;
    }],
    ["learning module", () => {
      const brief = makeDailyBrief();
      brief.oneThingToLearn = { ...brief.oneThingToLearn!, sourceUrls: ["mailto:test@example.com"] };
      return brief;
    }],
    ["model module", () => {
      const brief = makeDailyBrief();
      brief.modelToKnow = { ...brief.modelToKnow!, sourceUrls: ["data:text/plain,bad"] };
      return brief;
    }],
    ["tool module", () =>
      makeDailyBrief({
        toolOfTheDay: {
          name: "Unsafe tool",
          whatItIs: "A test fixture.",
          whenToUse: "Never.",
          sourceUrls: ["ftp://example.com/tool"],
        },
      })],
    ["paper module", () => {
      const brief = makeDailyBrief();
      brief.paperWorthKnowing = {
        ...brief.paperWorthKnowing!,
        sourceUrls: ["file:///tmp/paper.pdf"],
      };
      return brief;
    }],
  ])("rejects non-HTTP citations in the %s", (_label, build) => {
    expect(dailyBriefDraftSchema.safeParse(build()).success).toBe(false);
  });

  it("keeps generated authorship empty and requires a human take for publication", () => {
    expect(generatedDailyBriefSchema.safeParse(makeDailyBrief({ myTake: "" })).success).toBe(true);
    expect(generatedDailyBriefSchema.safeParse(makeDailyBrief()).success).toBe(false);
    expect(publishedDailyBriefSchema.safeParse(makeDailyBrief({ myTake: "   " })).success).toBe(false);
    expect(publishedDailyBriefSchema.safeParse(makeDailyBrief()).success).toBe(true);
  });
});

describe("Daily Brief deterministic helpers", () => {
  it("separates factual review from personal-take confirmation", () => {
    const first = makeDailyBrief();
    const changedTake = makeDailyBrief({ myTake: "A different human view." });
    const changedFact = makeDailyBrief({ title: "A materially different reviewed title" });

    expect(factualContentHash(first)).toBe(factualContentHash(changedTake));
    expect(factualContentHash(first)).not.toBe(factualContentHash(changedFact));
    expect(myTakeContentHash(first.myTake)).not.toBe(myTakeContentHash(changedTake.myTake));
    expect(myTakeContentHash("  same\r\ntext  ")).toBe(myTakeContentHash("same\ntext"));
  });

  it("derives stable IDs independent of source ordering", () => {
    const input = {
      date: "2026-08-25",
      headline: "A Stable Headline",
      sourceUrls: ["https://example.com/b", "https://example.com/a"],
    };
    expect(createDailyStoryId(input)).toBe(
      createDailyStoryId({ ...input, sourceUrls: [...input.sourceUrls].reverse() }),
    );
  });

  it("collects all source modules once in first-appearance order", () => {
    const urls = collectDailySourceUrls(makeDailyBrief());
    expect(urls[0]).toBe("https://example.com/announcement");
    expect(urls).toContain("https://example.com/model-card");
    expect(new Set(urls).size).toBe(urls.length);
  });
});
