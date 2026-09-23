// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CommandPalette } from "@/components/CommandPalette";
import type { SearchItem } from "@/lib/search-index";

const router = { push: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const results: SearchItem[] = [
  {
    id: "writing:evals",
    kind: "writing",
    href: "/blog/evals",
    title: "Evals that hold up",
    description: "A reviewed field note.",
    label: "Eval-First AI Engineering",
    keywords: ["regression"],
  },
  {
    id: "daily:2026-08-25",
    kind: "daily",
    href: "/daily/2026-08-25",
    title: "AI Daily Brief — August 25",
    description: "The changes worth knowing today.",
    label: "August 25, 2026",
    keywords: ["models"],
  },
  {
    id: "topic:rag",
    kind: "topic",
    href: "/topics/rag",
    title: "RAG systems",
    description: "A topic hub for production retrieval.",
    label: "Topic hub",
    keywords: ["embeddings", "retrieval"],
  },
  {
    id: "concept:hybrid-search",
    kind: "concept",
    href: "/ai/concepts/hybrid-search",
    title: "Hybrid search",
    description: "A reviewed handbook reference.",
    label: "Handbook concept",
    keywords: ["ranking"],
  },
];

function successfulFetch() {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => results,
  });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("CommandPalette", () => {
  it("loads lazily and navigates a non-blog result using its supplied href", async () => {
    const fetchMock = successfulFetch();
    vi.stubGlobal("fetch", fetchMock);
    render(React.createElement(CommandPalette));

    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Search Engineerious" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/search");

    const dailyTitle = await screen.findByText("AI Daily Brief — August 25");
    const dailyResult = dailyTitle.closest("button");
    if (!dailyResult) throw new Error("Daily search result is not clickable");
    fireEvent.click(dailyResult);

    expect(router.push).toHaveBeenCalledWith("/daily/2026-08-25");
  });

  it("filters title, description, label, and hidden keywords", async () => {
    vi.stubGlobal("fetch", successfulFetch());
    render(React.createElement(CommandPalette));
    fireEvent.click(screen.getByRole("button", { name: "Search Engineerious" }));
    await screen.findByText("RAG systems");

    fireEvent.change(screen.getByRole("combobox", { name: "Search Engineerious" }), {
      target: { value: "embeddings" },
    });

    expect(screen.getByText("RAG systems")).toBeTruthy();
    expect(screen.queryByText("Evals that hold up")).toBeNull();
    expect(screen.getByText("1 of 4")).toBeTruthy();
  });

  it("labels and opens a handbook result at its real AI detail route", async () => {
    vi.stubGlobal("fetch", successfulFetch());
    render(React.createElement(CommandPalette));
    fireEvent.click(screen.getByRole("button", { name: "Search Engineerious" }));

    const title = await screen.findByText("Hybrid search");
    expect(screen.getByText("Concept · Handbook concept")).toBeTruthy();
    const result = title.closest("button");
    if (!result) throw new Error("Handbook search result is not clickable");
    fireEvent.click(result);

    expect(router.push).toHaveBeenCalledWith("/ai/concepts/hybrid-search");
  });

  it("supports arrows and Enter while keeping focus trapped and restorable", async () => {
    vi.stubGlobal("fetch", successfulFetch());
    render(React.createElement(CommandPalette));
    const trigger = screen.getByRole("button", { name: "Search Engineerious" });
    trigger.focus();
    fireEvent.click(trigger);
    await screen.findByText("AI Daily Brief — August 25");

    const input = screen.getByRole("combobox", { name: "Search Engineerious" });
    await waitFor(() => expect(document.activeElement).toBe(input));

    fireEvent.keyDown(input, { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close" }));
    fireEvent.keyDown(document.activeElement!, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(input);

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input.getAttribute("aria-activedescendant")).toContain("option-1");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(router.push).toHaveBeenCalledWith("/daily/2026-08-25");

    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("reports load failures truthfully and restores focus after Escape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "unavailable" }) }),
    );
    render(React.createElement(CommandPalette));
    const trigger = screen.getByRole("button", { name: "Search Engineerious" });
    document.body.focus();
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });

    expect(
      await screen.findByText("Search is unavailable right now. Close this panel and try again."),
    ).toBeTruthy();
    const input = screen.getByRole("combobox", { name: "Search Engineerious" });
    fireEvent.keyDown(input, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
