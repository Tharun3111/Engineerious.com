import type { DailyBriefDraft } from "@/lib/daily-brief";

export function makeDailyBrief(
  overrides: Partial<DailyBriefDraft> = {},
): DailyBriefDraft {
  return {
    schemaVersion: 1,
    date: "2026-08-25",
    title: "A reviewed day in AI engineering",
    summary: "A grounded summary of the changes that matter to working engineers.",
    stories: [
      {
        id: "story-business",
        category: "business",
        sourceLabel: "Example Research Lab",
        headline: "The biggest verified change",
        whatHappened: "The organization published a primary-source announcement.",
        whyItMatters: "The change alters a concrete engineering constraint.",
        forEngineers: "Review the migration boundary before adopting it.",
        sourceUrls: ["https://example.com/announcement"],
      },
      {
        id: "story-open-source",
        category: "open_source",
        sourceLabel: "Example repository",
        headline: "An open-source implementation ships",
        whatHappened: "A maintained implementation was released with documentation.",
        whyItMatters: "Teams can inspect and adapt the implementation.",
        forEngineers: "Evaluate its tests and operational assumptions first.",
        sourceUrls: ["https://github.com/example/project"],
      },
      {
        id: "story-framework",
        category: "frameworks",
        sourceLabel: "Framework documentation",
        headline: "A framework changes its execution model",
        whatHappened: "The official documentation describes the updated execution path.",
        whyItMatters: "Existing orchestration code may behave differently.",
        forEngineers: "Re-run integration tests against the new behavior.",
        sourceUrls: ["https://docs.example.com/framework"],
      },
    ],
    oneThingToLearn: {
      title: "Evaluation boundaries",
      explanation: "Separate model quality from system reliability when designing an evaluation.",
      sourceUrls: ["https://example.com/evaluations"],
    },
    modelToKnow: {
      name: "Example Model",
      whatItDoes: "It handles a documented class of language tasks.",
      modelSize: null,
      contextWindow: "32k tokens",
      license: null,
      whyInteresting: "Its release notes expose a useful deployment tradeoff.",
      sourceUrls: ["https://example.com/model-card"],
    },
    toolOfTheDay: null,
    paperWorthKnowing: {
      title: "A reproducible systems paper",
      takeaway: "The reported method makes one system tradeoff measurable.",
      sourceUrls: ["https://arxiv.org/abs/2608.00001"],
    },
    myTake: "The engineering value is in the narrower, testable change rather than the headline.",
    ...overrides,
  };
}
