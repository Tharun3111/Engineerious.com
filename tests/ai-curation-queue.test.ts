// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AiCurationQueue } from "@/components/AiCurationQueue";
import type { CuratedAiAdminRecord } from "@/lib/curated-ai-queries";

const router = { refresh: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

function record(overrides: Partial<CuratedAiAdminRecord> = {}): CuratedAiAdminRecord {
  return {
    id: 17,
    type: "news",
    title: "Raw factual title",
    url: "https://example.com/release",
    summary: "Raw factual summary",
    aiNote: "Machine-generated impact note",
    source: "Example Engineering",
    sourceSlug: "example-engineering",
    score: 8.2,
    firstSeen: "2026-08-25T12:00:00.000Z",
    publishedAt: null,
    expectedSourceVersion: "0".repeat(64),
    expectedCurationVersion: null,
    signal: null,
    hasCuratedState: false,
    curationError: null,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("AI curation queue", () => {
  it("uses factual fields as review inputs without inventing category, topics, or impact", () => {
    render(React.createElement(AiCurationQueue, { items: [record()] }));

    expect((screen.getByRole("textbox", { name: "Reviewed title" }) as HTMLInputElement).value).toBe(
      "Raw factual title",
    );
    expect((screen.getByRole("textbox", { name: "Reviewed summary" }) as HTMLTextAreaElement).value).toBe(
      "Raw factual summary",
    );
    expect((screen.getByRole("combobox", { name: "Category" }) as HTMLSelectElement).value).toBe("");
    expect((screen.getByRole("textbox", { name: "Why it matters" }) as HTMLTextAreaElement).value).toBe("");
    expect((screen.getByRole("checkbox", { name: "RAG" }) as HTMLInputElement).checked).toBe(false);
    expect(screen.getByText(/Machine-generated impact note/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Publish curated snapshot" })).toBeTruthy();
  });

  it("keeps unsafe legacy source URLs inert and unpublishable", () => {
    render(
      React.createElement(AiCurationQueue, {
        items: [record({ url: "data:text/html,payload" })],
      }),
    );

    expect(screen.queryByRole("link", { name: /Raw factual title/ })).toBeNull();
    expect(screen.getByText(/unsafe\/invalid URL/)).toBeTruthy();
    expect(screen.getByText(/Reject or repair this source/)).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Publish curated snapshot" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("shows a curated copy as immutable with an explicit unpublish action", () => {
    const signal = {
      schemaVersion: 1 as const,
      itemId: 17,
      type: "news" as const,
      title: "Reviewed title",
      url: "https://example.com/release",
      summary: "Reviewed summary",
      category: "infrastructure" as const,
      topicSlugs: ["rag"] as const,
      whyItMatters: "Reviewed consequence",
      source: "Example Engineering",
      sourceSlug: "example-engineering",
      sourceWeight: 1,
      author: null,
      sourcePublishedAt: null,
      firstSeen: "2026-08-25T12:00:00.000Z",
      curatedAt: "2026-08-25T14:00:00.000Z",
      curatedBy: "Tharun Chowdary Malepati",
      rankScore: 8.2,
    };
    render(
      React.createElement(AiCurationQueue, {
        items: [
          record({
            signal,
            hasCuratedState: true,
            expectedCurationVersion: "1".repeat(64),
          }),
        ],
      }),
    );

    expect(screen.getByText("Immutable public copy")).toBeTruthy();
    expect(screen.getByText("Reviewed consequence")).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "Reviewed title" })).toBeNull();
    expect(screen.getByRole("button", { name: "Unpublish curated snapshot" })).toBeTruthy();
  });

  it("submits the exact reviewed curation version when unpublishing", async () => {
    const expectedCurationVersion = "1".repeat(64);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      React.createElement(AiCurationQueue, {
        items: [
          record({
            signal: {
              schemaVersion: 1,
              itemId: 17,
              type: "news",
              title: "Reviewed title",
              url: "https://example.com/release",
              summary: "Reviewed summary",
              category: "infrastructure",
              topicSlugs: ["rag"],
              whyItMatters: "Reviewed consequence",
              source: "Example Engineering",
              sourceSlug: "example-engineering",
              sourceWeight: 1,
              author: null,
              sourcePublishedAt: null,
              firstSeen: "2026-08-25T12:00:00.000Z",
              curatedAt: "2026-08-25T14:00:00.000Z",
              curatedBy: "Tharun Chowdary Malepati",
              rankScore: 8.2,
            },
            hasCuratedState: true,
            expectedCurationVersion,
          }),
        ],
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Unpublish curated snapshot" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({
      id: 17,
      action: "unpublish",
      expectedCurationVersion,
    });
  });
});
