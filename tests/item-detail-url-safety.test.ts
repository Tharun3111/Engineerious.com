// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Item } from "@/db/schema";

const mocks = vi.hoisted(() => ({ getItem: vi.fn() }));

vi.mock("@/lib/queries", () => ({ getItem: mocks.getItem }));
vi.mock("next/navigation", () => ({ notFound: vi.fn(() => { throw new Error("not found"); }) }));
vi.mock("@/components/NewsletterCTA", () => ({ NewsletterCTA: () => null }));

import { ItemDetail } from "@/components/ItemDetail";

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

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("item detail URL safety", () => {
  it("suppresses unsafe legacy source and discussion destinations", async () => {
    mocks.getItem.mockResolvedValue(
      item({
        url: "data:text/html,payload",
        rawJson: { discussion: "ftp://example.com/thread" },
      }),
    );

    render(await ItemDetail({ id: "7", expectedType: "news" }));

    expect(screen.getByText("The stored source URL is unavailable.")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Open on/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /discussion/i })).toBeNull();
  });
});
