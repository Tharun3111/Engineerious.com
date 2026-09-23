import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CuratedAiSignal } from "@/lib/curated-ai";

const mocks = vi.hoisted(() => ({
  getPublishedWritingPosts: vi.fn(),
  getCuratedAiCorpus: vi.fn(),
  getPublishedHandbookEntries: vi.fn(),
}));

vi.mock("@/lib/content/blog", () => ({
  getPublishedWritingPosts: mocks.getPublishedWritingPosts,
}));

vi.mock("@/lib/curated-ai-queries", () => ({
  getCuratedAiCorpus: mocks.getCuratedAiCorpus,
}));

vi.mock("@/lib/handbook", () => ({
  getPublishedHandbookEntries: mocks.getPublishedHandbookEntries,
}));

import AiDeskPage, { generateMetadata as generateAiMetadata } from "@/app/ai/page";
import TopicPage, {
  generateMetadata as generateTopicMetadata,
} from "@/app/topics/[slug]/page";

function signal(itemId: number, topicSlugs: CuratedAiSignal["topicSlugs"]): CuratedAiSignal {
  return {
    schemaVersion: 1,
    itemId,
    type: "news",
    title: `Reviewed signal ${itemId}`,
    url: `https://openai.com/research/${itemId}`,
    summary: "A reviewed source-linked summary.",
    category: "agents",
    topicSlugs,
    whyItMatters: "The change affects an engineering decision.",
    source: "OpenAI",
    sourceSlug: "openai-news",
    sourceWeight: 5,
    author: null,
    sourcePublishedAt: "2026-08-24T16:00:00.000Z",
    firstSeen: "2026-08-24T17:00:00.000Z",
    curatedAt: new Date(Date.UTC(2026, 7, 25, 10, itemId)).toISOString(),
    curatedBy: "Tharun Chowdary Malepati",
    rankScore: 1 / itemId,
  };
}

function handbook(topicSlugs: string[] = []) {
  return {
    kind: "concept" as const,
    routeKind: "concepts" as const,
    slug: "hybrid-search",
    title: "Hybrid search",
    summary: "A reviewed reference for lexical and semantic retrieval.",
    body: "## Definition\n\nA source-linked explanation.",
    myTake: "Use both channels only when each closes a measured gap.",
    tags: ["retrieval"],
    topicSlugs,
    sources: [{ label: "Primary docs", url: "https://example.com/search" }],
    draft: false,
    authenticityStatus: "verified" as const,
    origin: "human" as const,
    publishedAt: new Date("2026-08-20T10:00:00.000Z"),
    updatedAt: new Date("2026-08-24T10:00:00.000Z"),
    reviewedBy: "Tharun",
    reviewedAt: new Date("2026-08-24T11:00:00.000Z"),
    readingMinutes: 4,
  };
}

async function renderPage(page: () => Promise<React.ReactNode>): Promise<string> {
  return renderToStaticMarkup(createElement("div", null, await page()));
}

beforeEach(() => {
  mocks.getPublishedHandbookEntries.mockReturnValue([]);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("public AI desk", () => {
  it("stays honest and noindexed when no reviewed content is useful", async () => {
    mocks.getPublishedWritingPosts.mockResolvedValue([]);
    mocks.getCuratedAiCorpus.mockResolvedValue({ signals: [], error: null });

    const metadata = await generateAiMetadata();
    const html = await renderPage(AiDeskPage);

    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(html).toContain('data-feed-state="empty"');
    expect(html).toContain("Raw candidates remain off this page");
    expect(html).not.toContain('href="/topics/');
    expect(html).not.toContain("Engineering lenses");
    expect(html).not.toContain("Published handbook");
  });

  it("indexes reviewed signal and links only a topic that reaches its threshold", async () => {
    const signals = [signal(1, ["agents"]), signal(2, ["agents"]), signal(3, ["agents"])];
    mocks.getPublishedWritingPosts.mockResolvedValue([]);
    mocks.getCuratedAiCorpus.mockResolvedValue({ signals, error: null });

    const metadata = await generateAiMetadata();
    const html = await renderPage(AiDeskPage);

    expect(metadata.robots).toEqual({ index: true, follow: true });
    expect(html).toContain('href="/topics/agents"');
    expect(html).not.toContain('href="/topics/rag"');
    expect(html).not.toContain('href="/topics/mcp"');
    expect(html).toContain('id="signal-1"');
  });

  it("distinguishes an unavailable query from an empty editorial desk", async () => {
    mocks.getPublishedWritingPosts.mockResolvedValue([]);
    mocks.getCuratedAiCorpus.mockResolvedValue({ signals: [], error: "database unavailable" });

    const html = await renderPage(AiDeskPage);
    expect(html).toContain('data-feed-state="unavailable"');
    expect(html).toContain("Private or raw feed rows are not being shown as a fallback");
  });

  it("indexes a real handbook-only desk and renders no empty collections", async () => {
    mocks.getPublishedWritingPosts.mockResolvedValue([]);
    mocks.getCuratedAiCorpus.mockResolvedValue({ signals: [], error: null });
    mocks.getPublishedHandbookEntries.mockReturnValue([handbook()]);

    const metadata = await generateAiMetadata();
    const html = await renderPage(AiDeskPage);

    expect(metadata.robots).toEqual({ index: true, follow: true });
    expect(html).toContain("Published handbook");
    expect(html).toContain("Concepts");
    expect(html).toContain('href="/ai/concepts/hybrid-search"');
    expect(html).not.toContain("Frameworks");
    expect(html).not.toContain("Model notes");
    expect(html).not.toContain('href="/models/');
  });
});

describe("active topic route", () => {
  it("renders an active topic from three explicitly tagged reviewed signals", async () => {
    const signals = [signal(1, ["agents"]), signal(2, ["agents"]), signal(3, ["agents"])];
    mocks.getPublishedWritingPosts.mockResolvedValue([]);
    mocks.getCuratedAiCorpus.mockResolvedValue({ signals, error: null });

    const metadata = await generateTopicMetadata({
      params: Promise.resolve({ slug: "agents" }),
    });
    const html = await renderPage(() =>
      TopicPage({ params: Promise.resolve({ slug: "agents" }) }),
    );

    expect(metadata.robots).toEqual({ index: true, follow: true });
    expect(metadata.alternates).toEqual({ canonical: "/topics/agents" });
    expect(html).toContain("Active topic map");
    expect(html).toContain("Tool-using systems");
    expect(html).toContain('id="signal-1"');
    expect(html).not.toContain("Start here");
  });

  it("returns a noindex metadata state and 404 for an underfilled topic", async () => {
    const signals = [signal(1, ["rag"]), signal(2, ["rag"])];
    mocks.getPublishedWritingPosts.mockResolvedValue([]);
    mocks.getCuratedAiCorpus.mockResolvedValue({ signals, error: null });

    const metadata = await generateTopicMetadata({
      params: Promise.resolve({ slug: "rag" }),
    });
    expect(metadata.robots).toEqual({ index: false, follow: false });
    await expect(
      TopicPage({ params: Promise.resolve({ slug: "rag" }) }),
    ).rejects.toThrow();
  });

  it("404s an unknown slug without querying public content", async () => {
    await expect(
      TopicPage({ params: Promise.resolve({ slug: "retrieval" }) }),
    ).rejects.toThrow();
    expect(mocks.getPublishedWritingPosts).not.toHaveBeenCalled();
    expect(mocks.getCuratedAiCorpus).not.toHaveBeenCalled();
  });

  it("keeps low-ranked topic evidence active while capping public AI HTML", async () => {
    const higherUnrelated = Array.from({ length: 100 }, (_, index) =>
      signal(index + 1, []),
    );
    const lowRankedTopic = [
      signal(101, ["agents"]),
      signal(102, ["agents"]),
      signal(103, ["agents"]),
    ];
    mocks.getPublishedWritingPosts.mockResolvedValue([]);
    mocks.getCuratedAiCorpus.mockResolvedValue({
      signals: [...higherUnrelated, ...lowRankedTopic],
      error: null,
    });

    const aiHtml = await renderPage(AiDeskPage);
    const requestedHtml = await renderPage(() =>
      AiDeskPage({ searchParams: Promise.resolve({ signal: "101" }) }),
    );
    const missingHtml = await renderPage(() =>
      AiDeskPage({ searchParams: Promise.resolve({ signal: "999" }) }),
    );
    const topicHtml = await renderPage(() =>
      TopicPage({ params: Promise.resolve({ slug: "agents" }) }),
    );

    expect(aiHtml).toContain('href="/topics/agents"');
    expect(aiHtml).toContain('id="signal-100"');
    expect(aiHtml).not.toContain('id="signal-101"');
    expect(requestedHtml).toContain('id="signal-101"');
    expect(requestedHtml).toContain("100 ranked + requested snapshot");
    expect(requestedHtml).toMatch(
      /id="signal-101"[\s\S]*?aria-label="Live rank 101"/,
    );
    expect(missingHtml).not.toContain('id="signal-101"');
    expect(topicHtml).toContain('id="signal-101"');
    expect(topicHtml).toContain('id="signal-103"');
    expect(topicHtml).toMatch(/id="signal-101"[\s\S]*?aria-label="Live rank 101"/);
    expect(topicHtml).toMatch(/id="signal-103"[\s\S]*?aria-label="Live rank 103"/);
  });

  it("opens a topic for one explicitly tagged handbook entry and renders its Learn section", async () => {
    mocks.getPublishedWritingPosts.mockResolvedValue([]);
    mocks.getCuratedAiCorpus.mockResolvedValue({ signals: [], error: null });
    mocks.getPublishedHandbookEntries.mockReturnValue([handbook(["rag"])]);

    const metadata = await generateTopicMetadata({
      params: Promise.resolve({ slug: "rag" }),
    });
    const html = await renderPage(() =>
      TopicPage({ params: Promise.resolve({ slug: "rag" }) }),
    );

    expect(metadata.robots).toEqual({ index: true, follow: true });
    expect(html).toContain("Learn from the handbook");
    expect(html).toContain('href="/ai/concepts/hybrid-search"');
    expect(html).not.toContain("What changed");
  });
});
