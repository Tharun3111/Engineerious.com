import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AiSignalList, signalSourceRole } from "@/components/AiSignalList";
import type { CuratedAiSignal } from "@/lib/curated-ai";

function signal(overrides: Partial<CuratedAiSignal> = {}): CuratedAiSignal {
  return {
    schemaVersion: 1,
    itemId: 42,
    type: "news",
    title: "A reviewed model release",
    url: "https://openai.com/index/release",
    summary: "The release changes a documented API capability.",
    category: "models",
    topicSlugs: ["agents"],
    whyItMatters: "Engineers need to review the migration path before upgrading.",
    source: "OpenAI",
    sourceSlug: "openai-news",
    sourceWeight: 5,
    author: null,
    sourcePublishedAt: "2026-08-24T16:00:00.000Z",
    firstSeen: "2026-08-24T17:00:00.000Z",
    curatedAt: "2026-08-25T10:00:00.000Z",
    curatedBy: "Tharun Chowdary Malepati",
    rankScore: 0.125,
    ...overrides,
  };
}

function render(signals: readonly CuratedAiSignal[], error: string | null = null): string {
  return renderToStaticMarkup(createElement(AiSignalList, { signals, error }));
}

describe("AI signal list", () => {
  it("renders immutable reviewed fields with live rank and a direct external source", () => {
    const html = render([signal()]);

    expect(html).toContain('id="signal-42"');
    expect(html).toContain('data-feed-state="ok"');
    expect(html).toContain("Live rank");
    expect(html).toContain("score 0.125");
    expect(html).toContain("Reported");
    expect(html).toContain("Primary source");
    expect(html).toContain("Why it matters");
    expect(html).toContain("Aug 24, 2026");
    expect(html).toContain('href="https://openai.com/index/release"');
    expect(html).toContain('target="_blank"');
    expect(html).not.toContain("/news/42");
    expect(html).not.toContain("/models/42");
  });

  it("classifies only source roles that can be derived honestly", () => {
    expect(signalSourceRole(signal())).toBe("primary");
    expect(
      signalSourceRole(
        signal({
          sourceSlug: "wired-ai",
          sourceWeight: 2,
          url: "https://wired.com/story/report",
        }),
      ),
    ).toBe("secondary");
    expect(
      signalSourceRole(
        signal({
          sourceSlug: "hn-algolia",
          sourceWeight: 1,
          url: "https://example.com/an-unknown-origin",
        }),
      ),
    ).toBeNull();
    expect(
      signalSourceRole(
        signal({
          sourceSlug: "unknown-high-weight-source",
          sourceWeight: 5,
          url: "https://example.com/an-unknown-origin",
        }),
      ),
    ).toBeNull();
  });

  it("keeps empty, unavailable, and partially valid states distinct", () => {
    expect(render([])).toContain('data-feed-state="empty"');
    expect(render([], "database unavailable")).toContain('data-feed-state="unavailable"');

    const partial = render([signal()], "one snapshot failed validation");
    expect(partial).toContain('data-feed-state="partial"');
    expect(partial).toContain('data-feed-state="ok"');
    expect(partial).toContain("valid reviewed items below remain public");
  });
});
