import { beforeEach, describe, expect, it, vi } from "vitest";

import { parsePublishedDailyBrief } from "@/lib/daily-brief";
import { makeDailyBrief } from "@/tests/daily-fixtures";

const mocks = vi.hoisted(() => ({
  getPublishedWritingPosts: vi.fn(),
  getDailyBriefArchive: vi.fn(),
  getCuratedAiCorpus: vi.fn(),
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

import { GET } from "@/app/api/search/route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getPublishedWritingPosts.mockResolvedValue([
    {
      slug: "production-rag",
      title: "Production RAG",
      dek: "A reviewed retrieval field note.",
      pillar: "rag-mlops",
      format: "field_note",
      tags: ["RAG"],
      teaches: ["retrieval evaluation"],
      draft: false,
      authenticityStatus: "verified",
      origin: "human",
      date: new Date("2026-08-24T12:00:00.000Z"),
    },
  ]);
  const brief = parsePublishedDailyBrief(makeDailyBrief());
  mocks.getDailyBriefArchive.mockResolvedValue({
    briefs: [
      {
        digestId: 7,
        date: brief.date,
        publishedAt: new Date("2026-08-25T12:00:00.000Z"),
        brief,
      },
    ],
    error: null,
  });
  mocks.getCuratedAiCorpus.mockResolvedValue({
    signals: [
      {
        schemaVersion: 1,
        itemId: 42,
        type: "news",
        title: "A reviewed agent release",
        url: "https://example.com/agents",
        summary: "A public immutable summary.",
        category: "agents",
        topicSlugs: ["agents"],
        whyItMatters: "The tool boundary changed.",
        source: "Example Lab",
        sourceSlug: "example-lab",
        sourceWeight: 1,
        author: null,
        sourcePublishedAt: "2026-08-25T08:00:00.000Z",
        firstSeen: "2026-08-25T08:05:00.000Z",
        curatedAt: "2026-08-25T10:00:00.000Z",
        curatedBy: "Tharun",
        rankScore: 12,
      },
    ],
    error: null,
  });
});

describe("GET /api/search", () => {
  it("orchestrates only public loaders and returns the normalized cross-content index", async () => {
    const response = await GET();
    const index = await response.json();

    expect(mocks.getPublishedWritingPosts).toHaveBeenCalledOnce();
    expect(mocks.getDailyBriefArchive).toHaveBeenCalledWith(100);
    expect(mocks.getCuratedAiCorpus).toHaveBeenCalledOnce();
    expect(index.map((entry: { kind: string }) => entry.kind)).toEqual([
      "writing",
      "daily",
      "signal",
      "topic",
      "project",
    ]);
    expect(index).toContainEqual(
      expect.objectContaining({ id: "signal:42", href: "/ai#signal-42" }),
    );
    expect(index).toContainEqual(
      expect.objectContaining({ id: "topic:rag", href: "/topics/rag" }),
    );
    expect(index).not.toContainEqual(expect.objectContaining({ id: "topic:agents" }));
    expect(Object.keys(index.find((entry: { id: string }) => entry.id === "signal:42")).sort()).toEqual(
      ["id", "kind", "href", "title", "description", "label", "keywords"].sort(),
    );
    expect(response.headers.get("Cache-Control")).toBe(
      "private, no-store",
    );
  });

  it("fails a broken source closed without replacing it with private data", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.getPublishedWritingPosts.mockRejectedValue(new Error("writing unavailable"));
    mocks.getDailyBriefArchive.mockRejectedValue(new Error("daily unavailable"));
    mocks.getCuratedAiCorpus.mockRejectedValue(new Error("signals unavailable"));

    const response = await GET();
    const index = await response.json();

    expect(index.every((entry: { kind: string }) => entry.kind === "project")).toBe(true);
    expect(index.some((entry: { href: string }) => entry.href.startsWith("/blog/"))).toBe(false);
    expect(index.some((entry: { href: string }) => entry.href.startsWith("/daily/"))).toBe(false);
    expect(index.some((entry: { href: string }) => entry.href.startsWith("/ai#"))).toBe(false);
    expect(errorSpy).toHaveBeenCalledTimes(3);
    errorSpy.mockRestore();
  });

  it("uses the full corpus for topics but indexes only /ai-targetable top-100 signals", async () => {
    mocks.getPublishedWritingPosts.mockResolvedValue([]);
    const makeSignal = (itemId: number, topicSlugs: string[], rankScore: number) => ({
      schemaVersion: 1 as const,
      itemId,
      type: "news" as const,
      title: `Signal ${itemId}`,
      url: `https://example.com/${itemId}`,
      summary: "Reviewed summary.",
      category: "agents" as const,
      topicSlugs,
      whyItMatters: "Reviewed consequence.",
      source: "Example Lab",
      sourceSlug: "example-lab",
      sourceWeight: 1,
      author: null,
      sourcePublishedAt: null,
      firstSeen: "2026-08-25T08:00:00.000Z",
      curatedAt: new Date(Date.UTC(2026, 7, 25, 10, itemId)).toISOString(),
      curatedBy: "Tharun",
      rankScore,
    });
    const higherUnrelated = Array.from({ length: 100 }, (_, index) =>
      makeSignal(index + 1, [], 200 - index),
    );
    const lowRankedTopic = [
      makeSignal(101, ["agents"], 0.03),
      makeSignal(102, ["agents"], 0.02),
      makeSignal(103, ["agents"], 0.01),
    ];
    mocks.getCuratedAiCorpus.mockResolvedValue({
      signals: [...higherUnrelated, ...lowRankedTopic],
      error: null,
    });

    const response = await GET();
    const index = await response.json();
    const signalResults = index.filter((entry: { kind: string }) => entry.kind === "signal");

    expect(index).toContainEqual(
      expect.objectContaining({ id: "topic:agents", href: "/topics/agents" }),
    );
    expect(signalResults).toHaveLength(100);
    expect(signalResults).toContainEqual(
      expect.objectContaining({ id: "signal:100", href: "/ai#signal-100" }),
    );
    expect(signalResults).not.toContainEqual(expect.objectContaining({ id: "signal:101" }));
  });
});
