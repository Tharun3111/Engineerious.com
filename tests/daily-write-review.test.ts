import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DailyBriefDraft } from "@/lib/daily-brief";
import { complete } from "@/lib/llm";
import type { Finding } from "@/lib/research";
import { reviewDailyBrief } from "@/lib/review";
import { writeDailyBrief } from "@/lib/write";

vi.mock("@/lib/llm", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/llm")>();
  return { ...original, complete: vi.fn() };
});

const completeMock = vi.mocked(complete);
const sourceUrl = "https://openai.com/index/example-release";
const secondSourceUrl = "https://github.com/example/example-agent/releases/tag/v1";

const findings: Finding[] = [
  {
    title: "Example model release",
    summary: "The lab released Example Model with tool calling for API users.",
    sourceUrls: [sourceUrl],
    category: "model_release",
    novelty: "high",
    relevantPillar: null,
  },
];

function modelDraft(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    date: "2026-08-25",
    title: "AI Daily Brief — August 25",
    summary: "One model release worth tracking today.",
    stories: [
      {
        id: "model-chosen-id",
        category: "models",
        sourceLabel: "OpenAI",
        headline: "Example Model adds tool calling",
        whatHappened: "The lab released Example Model with tool calling for API users.",
        whyItMatters: "Tool calling changes how API applications can connect model output to actions.",
        forEngineers: "Review the tool-calling interface before changing an existing integration.",
        sourceUrls: [sourceUrl],
      },
    ],
    oneThingToLearn: null,
    modelToKnow: null,
    toolOfTheDay: null,
    paperWorthKnowing: null,
    myTake: "The model tried to impersonate Tharun.",
    ...overrides,
  };
}

function reviewableDraft(overrides: Partial<DailyBriefDraft> = {}): DailyBriefDraft {
  return modelDraft({ myTake: "PRIVATE HUMAN TAKE — DO NOT SEND TO THE REVIEWER", ...overrides }) as DailyBriefDraft;
}

describe("structured Daily WRITE", () => {
  beforeEach(() => completeMock.mockReset());

  it("forces the human-only take empty and replaces model IDs deterministically", async () => {
    completeMock.mockResolvedValueOnce(JSON.stringify(modelDraft()));

    const result = await writeDailyBrief({
      findings,
      stockQuotes: [],
      date: "2026-08-25",
    });

    expect(result.myTake).toBe("");
    expect(result.stories[0].id).toMatch(/^story-[a-f0-9]{16}$/);
    expect(result.stories[0].id).not.toBe("model-chosen-id");
    expect(result.stories[0].sourceUrls).toEqual([sourceUrl]);
  });

  it("rejects a well-formed source URL that was not in research", async () => {
    completeMock.mockResolvedValueOnce(
      JSON.stringify(
        modelDraft({
          stories: [
            {
              ...(modelDraft().stories as Array<Record<string, unknown>>)[0],
              sourceUrls: ["https://example.com/invented"],
            },
          ],
        }),
      ),
    );

    await expect(
      writeDailyBrief({ findings, stockQuotes: [], date: "2026-08-25" }),
    ).rejects.toThrow(/Daily WRITE sources included URL\(s\) that were not gathered/);
  });

  it("normalizes duplicate disposable model IDs before enforcing uniqueness", async () => {
    const firstStory = (modelDraft().stories as Array<Record<string, unknown>>)[0];
    completeMock.mockResolvedValueOnce(
      JSON.stringify(
        modelDraft({
          stories: [
            firstStory,
            {
              ...firstStory,
              id: "model-chosen-id",
              sourceLabel: "Example Agent",
              headline: "Example Agent publishes its first release",
              whatHappened: "Example Agent published its first release.",
              whyItMatters: "The release makes the agent package available to developers.",
              forEngineers: "Read the release notes before evaluating the package.",
              sourceUrls: [secondSourceUrl],
            },
          ],
        }),
      ),
    );

    const result = await writeDailyBrief({
      findings: [
        ...findings,
        {
          title: "Example Agent release",
          summary: "Example Agent published its first release.",
          sourceUrls: [secondSourceUrl],
          category: "tool_framework",
          novelty: "medium",
          relevantPillar: null,
        },
      ],
      stockQuotes: [],
      date: "2026-08-25",
    });

    expect(new Set(result.stories.map((story) => story.id)).size).toBe(2);
  });

  it("rejects machine-authored claims of first-hand testing", async () => {
    const story = (modelDraft().stories as Array<Record<string, unknown>>)[0];
    completeMock.mockResolvedValueOnce(
      JSON.stringify(
        modelDraft({
          stories: [{ ...story, whatHappened: "I tested the release in production." }],
        }),
      ),
    );

    await expect(
      writeDailyBrief({ findings, stockQuotes: [], date: "2026-08-25" }),
    ).rejects.toThrow(/claims first-hand work/);
  });
});

describe("structured Daily REVIEW", () => {
  beforeEach(() => completeMock.mockReset());

  it("reviews factual fields without exposing or judging My Take", async () => {
    completeMock.mockResolvedValueOnce(
      JSON.stringify({
        groundingViolations: [],
        voiceViolations: [],
        overallVerdict: "Ready for human review",
        readsAsGenericAiContent: false,
      }),
    );

    await reviewDailyBrief({ draft: reviewableDraft(), findings });

    expect(completeMock).toHaveBeenCalledOnce();
    const call = completeMock.mock.calls[0][0];
    expect(call.prompt).toContain("Example Model adds tool calling");
    expect(call.prompt).not.toContain("PRIVATE HUMAN TAKE");
  });

  it("fails the deterministic source allowlist before paying for REVIEW", async () => {
    const unsafe = reviewableDraft({
      stories: [
        {
          ...(modelDraft().stories as DailyBriefDraft["stories"])[0],
          sourceUrls: ["https://example.com/not-researched"],
        },
      ],
    });

    await expect(reviewDailyBrief({ draft: unsafe, findings })).rejects.toThrow(
      /Daily REVIEW sources included URL\(s\) that were not gathered/,
    );
    expect(completeMock).not.toHaveBeenCalled();
  });
});
