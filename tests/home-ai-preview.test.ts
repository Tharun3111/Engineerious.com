import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AiHomeModule } from "@/app/page";
import type { CuratedAiSignal } from "@/lib/curated-ai";

function signal(itemId: number): CuratedAiSignal {
  return {
    schemaVersion: 1,
    itemId,
    type: "news",
    title: `Reviewed signal ${itemId}`,
    url: `https://example.com/source-${itemId}`,
    summary: "A human-reviewed summary tied to the original source.",
    category: "infrastructure",
    topicSlugs: ["agents"],
    whyItMatters: "It changes an engineering tradeoff worth evaluating.",
    source: "Example Lab",
    sourceSlug: "example-lab",
    sourceWeight: 2,
    author: null,
    sourcePublishedAt: "2026-08-25T12:00:00.000Z",
    firstSeen: "2026-08-25T12:05:00.000Z",
    curatedAt: "2026-08-25T13:00:00.000Z",
    curatedBy: "Tharun Chowdary Malepati",
    rankScore: 0.5,
  };
}

describe("homepage curated AI preview", () => {
  it("omits the module when no immutable reviewed snapshots are public", () => {
    const html = renderToStaticMarkup(
      createElement(AiHomeModule, {
        result: { signals: [], error: "database unavailable" },
      }),
    );

    expect(html).toBe("");
    expect(html).not.toContain("raw feed");
  });

  it("renders only the public signals supplied by the curated query boundary", () => {
    const html = renderToStaticMarkup(
      createElement(AiHomeModule, {
        result: { signals: [signal(1), signal(2)], error: null },
      }),
    );

    expect(html).toContain("Reviewed signal, not a raw feed");
    expect(html).toContain("Reviewed signal 1");
    expect(html).toContain("Reviewed signal 2");
    expect(html).toContain('href="/ai"');
  });
});
