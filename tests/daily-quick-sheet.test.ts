import { describe, expect, it } from "vitest";

import { deriveDailyQuickSheet, parsePublishedDailyBrief } from "@/lib/daily-brief";
import { makeDailyBrief } from "@/tests/daily-fixtures";

describe("Daily Quick Sheet", () => {
  it("derives every semantic slot from the immutable public brief", () => {
    const sheet = deriveDailyQuickSheet(parsePublishedDailyBrief(makeDailyBrief()));
    expect(sheet.biggestStory.title).toBe("The biggest verified change");
    expect(sheet.model?.title).toBe("Example Model");
    expect(sheet.openSource?.title).toBe("An open-source implementation ships");
    expect(sheet.framework?.title).toBe("A framework changes its execution model");
    expect(sheet.research?.title).toBe("A reproducible systems paper");
    expect(sheet.worthLearning?.title).toBe("Evaluation boundaries");
    expect(sheet.myTake.detail).toContain("testable change");
  });

  it("prefers the first category story over its fallback spotlight", () => {
    const base = makeDailyBrief();
    const modelStory = {
      ...base.stories[0],
      id: "story-model",
      category: "models" as const,
      headline: "The reviewed model story",
    };
    const researchStory = {
      ...base.stories[0],
      id: "story-research",
      category: "research" as const,
      headline: "The reviewed research story",
    };
    const sheet = deriveDailyQuickSheet(
      parsePublishedDailyBrief(makeDailyBrief({ stories: [base.stories[0], modelStory, researchStory] })),
    );
    expect(sheet.model?.title).toBe("The reviewed model story");
    expect(sheet.research?.title).toBe("The reviewed research story");
  });

  it("represents unavailable optional slots as null instead of inventing content", () => {
    const onlyStory = makeDailyBrief().stories[0];
    const sheet = deriveDailyQuickSheet(
      parsePublishedDailyBrief(
        makeDailyBrief({
          stories: [onlyStory],
          oneThingToLearn: null,
          modelToKnow: null,
          paperWorthKnowing: null,
        }),
      ),
    );
    expect(sheet.model).toBeNull();
    expect(sheet.openSource).toBeNull();
    expect(sheet.framework).toBeNull();
    expect(sheet.research).toBeNull();
    expect(sheet.worthLearning).toBeNull();
  });
});
