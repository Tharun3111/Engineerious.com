import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPublishedWritingPosts: vi.fn(),
  getDailyBriefArchive: vi.fn(),
  getCuratedAiCorpus: vi.fn(),
  getPublishedHandbookEntries: vi.fn(),
}));

vi.mock("@/lib/content/blog", () => ({
  getPublishedWritingPosts: mocks.getPublishedWritingPosts,
}));
vi.mock("@/lib/daily-queries", () => ({
  getDailyBriefArchive: mocks.getDailyBriefArchive,
}));
vi.mock("@/lib/curated-ai-queries", () => ({
  getCuratedAiCorpus: mocks.getCuratedAiCorpus,
}));
vi.mock("@/lib/handbook", () => ({
  getPublishedHandbookEntries: mocks.getPublishedHandbookEntries,
  isPublishedHandbookEntry: (entry: { draft: boolean }) => !entry.draft,
}));

import { getPublicNotebookCorpus } from "@/lib/notebook-corpus";

function publicHandbookEntry() {
  return {
    kind: "concept" as const,
    routeKind: "concepts" as const,
    slug: "retrieval-evaluation",
    title: "Retrieval evaluation",
    summary: "A reviewed reference.",
    body: "## Definition\n\nMeasure retrieval separately from generation.",
    myTake: "Start with a small judged set and inspect every miss.",
    tags: ["retrieval"],
    topicSlugs: ["rag"],
    sources: [
      {
        label: "Evaluation guide",
        publisher: "Example Lab",
        url: "https://example.com/evals",
        accessedAt: new Date("2026-08-24T00:00:00.000Z"),
      },
    ],
    updatedAt: new Date("2026-08-24T12:00:00.000Z"),
    draft: false,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getPublishedWritingPosts.mockRejectedValue(new Error("writing unavailable"));
  mocks.getDailyBriefArchive.mockRejectedValue(new Error("daily unavailable"));
  mocks.getCuratedAiCorpus.mockRejectedValue(new Error("signals unavailable"));
  mocks.getPublishedHandbookEntries.mockReturnValue([publicHandbookEntry()]);
});

describe("public notebook source isolation", () => {
  it("keeps a healthy public source when every other source fails closed", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const documents = await getPublicNotebookCorpus();

    expect(documents).toEqual([
      expect.objectContaining({
        id: "concept:retrieval-evaluation",
        href: "/ai/concepts/retrieval-evaluation",
        citations: [
          {
            label: "Evaluation guide",
            publisher: "Example Lab",
            url: "https://example.com/evals",
            accessedAt: "2026-08-24T00:00:00.000Z",
          },
        ],
      }),
    ]);
    expect(mocks.getPublishedWritingPosts).toHaveBeenCalledOnce();
    expect(mocks.getDailyBriefArchive).toHaveBeenCalledWith(100);
    expect(mocks.getCuratedAiCorpus).toHaveBeenCalledOnce();
    expect(mocks.getPublishedHandbookEntries).toHaveBeenCalledOnce();
    expect(errorSpy).toHaveBeenCalledTimes(3);
    errorSpy.mockRestore();
  });

  it("returns no documents instead of reaching for a private fallback", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.getPublishedHandbookEntries.mockImplementation(() => {
      throw new Error("handbook unavailable");
    });

    await expect(getPublicNotebookCorpus()).resolves.toEqual([]);
    expect(errorSpy).toHaveBeenCalledTimes(4);
    errorSpy.mockRestore();
  });
});
