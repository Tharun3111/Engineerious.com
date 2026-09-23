// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DailyDigestEditor } from "@/components/DailyDigestEditor";

const router = { refresh: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const record = {
  id: 12,
  date: "2026-08-25",
  status: "pending_review",
  draftVersion: 3,
  draft: {
    schemaVersion: 1 as const,
    date: "2026-08-25",
    title: "AI Daily Brief — August 25",
    summary: "The engineering details worth knowing today.",
    stories: [
      {
        id: "story-1",
        category: "models" as const,
        sourceLabel: "OpenAI",
        headline: "A primary release",
        whatHappened: "OpenAI published a release.",
        whyItMatters: "The release changes an API capability.",
        forEngineers: "Read the migration notes before updating.",
        sourceUrls: ["https://openai.com/index/release"],
      },
    ],
    oneThingToLearn: null,
    modelToKnow: null,
    toolOfTheDay: null,
    paperWorthKnowing: null,
    myTake: "The migration path matters more than the announcement.",
  },
  reviewReport: {
    groundingViolations: [],
    voiceViolations: [],
    overallVerdict: "Ready for human review",
    readsAsGenericAiContent: false,
  },
  reviewCurrent: true,
  myTakeConfirmed: true,
  reviewedAt: "2026-08-25T12:00:00.000Z",
  myTakeConfirmedAt: "2026-08-25T13:00:00.000Z",
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Daily Digest editor", () => {
  it("exposes labeled fields and keyboard-operable reorder controls", () => {
    render(React.createElement(DailyDigestEditor, { record }));

    expect(screen.getByRole("textbox", { name: "Title" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "What happened" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Why it matters" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "For engineers" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Your observation" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Up" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Down" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Remove" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("blocks publication as soon as factual fields have unsaved changes", () => {
    render(React.createElement(DailyDigestEditor, { record }));

    const publish = screen.getByRole("button", { name: "Publish Daily" });
    expect((publish as HTMLButtonElement).disabled).toBe(false);

    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), {
      target: { value: "A changed factual title" },
    });

    expect(screen.getByText("unsaved changes")).toBeTruthy();
    expect((publish as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Save changes" }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole("button", { name: "Run factual review" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("states the web-only publication boundary beside the final action", () => {
    render(React.createElement(DailyDigestEditor, { record }));
    expect(
      screen.getByText(/Publish freezes this reviewed revision as the public Daily snapshot/)
        .textContent,
    ).toContain("It does not send a newsletter.");
  });
});
