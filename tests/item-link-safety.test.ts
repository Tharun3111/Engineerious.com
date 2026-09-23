// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Row } from "@/components/Row";
import type { Item } from "@/db/schema";

function item(overrides: Partial<Item> = {}): Item {
  return {
    id: 7,
    type: "news",
    status: "approved",
    title: "External release",
    url: "https://example.com/release",
    urlHash: "hash",
    summary: "A summary",
    aiNote: null,
    source: "External",
    sourceSlug: "external",
    sourceWeight: 1,
    author: null,
    points: 0,
    score: 0,
    firstSeen: new Date("2026-08-25T12:00:00.000Z"),
    publishedAt: null,
    rankedAt: null,
    rawJson: null,
    curatedSnapshot: null,
    curatedAt: null,
    curatedBy: null,
    ...overrides,
  };
}

afterEach(cleanup);

describe("public item link safety", () => {
  it("never makes unsafe legacy item or discussion destinations clickable", () => {
    render(
      React.createElement(Row, {
        item: item({
          url: "data:text/html,payload",
          rawJson: { discussion: "javascript:alert(document.domain)" },
        }),
      }),
    );

    expect(screen.queryByRole("link", { name: "External release" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Join discussion" })).toBeNull();
    expect(screen.getByRole("link", { name: "View details" }).getAttribute("href")).toBe(
      "/news/7",
    );
  });

  it("keeps validated HTTP(S) source and discussion links available", () => {
    render(
      React.createElement(Row, {
        item: item({ rawJson: { discussion: "https://news.ycombinator.com/item?id=7" } }),
      }),
    );

    expect(screen.getByRole("link", { name: "External release" }).getAttribute("href")).toBe(
      "https://example.com/release",
    );
    expect(screen.getByRole("link", { name: "Join discussion" }).getAttribute("href")).toBe(
      "https://news.ycombinator.com/item?id=7",
    );
  });
});
