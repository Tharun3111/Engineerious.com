// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PendingItemsQueue, RepurposeQueue, SubmissionsQueue } from "@/components/AdminQueue";
import type { Item, RepurposeJob, Submission } from "@/db/schema";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

function submission(url: string): Submission {
  return {
    id: 1,
    type: "news",
    title: "Legacy submission",
    url,
    note: null,
    submitterEmail: null,
    status: "pending",
    createdAt: new Date("2026-08-25T12:00:00.000Z"),
  };
}

function item(url: string): Item {
  return {
    id: 7,
    type: "news",
    status: "pending",
    title: "Legacy feed item",
    url,
    urlHash: "hash",
    summary: null,
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
  };
}

function repurposeJob(id: number, publishedUrl: string | null): RepurposeJob {
  return {
    id,
    postSlug: `post-${id}`,
    platform: "linkedin",
    status: "published",
    draft: "Reviewed copy",
    meta: null,
    scheduledFor: null,
    publishedUrl,
    error: null,
    createdAt: new Date("2026-08-25T12:00:00.000Z"),
    updatedAt: new Date("2026-08-25T12:00:00.000Z"),
  };
}

afterEach(cleanup);

describe("submission moderation URL safety", () => {
  it("renders legacy non-HTTP URLs as inert text and prevents acceptance", () => {
    render(React.createElement(SubmissionsQueue, {
      submissions: [submission("javascript:alert(document.domain)")],
    }));

    expect(screen.queryByRole("link", { name: "Legacy submission" })).toBeNull();
    expect(screen.getByText("Legacy submission").tagName).toBe("SPAN");
    expect(screen.getByText(/unsafe\/invalid URL/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Accept" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect((screen.getByRole("button", { name: "Reject" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it("keeps validated HTTP(S) submissions clickable", () => {
    render(React.createElement(SubmissionsQueue, {
      submissions: [submission("https://example.com/article")],
    }));

    const link = screen.getByRole("link", { name: "Legacy submission" });
    expect(link.getAttribute("href")).toBe("https://example.com/article");
    expect(screen.queryByText(/unsafe\/invalid URL/)).toBeNull();
    expect((screen.getByRole("button", { name: "Accept" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });
});

describe("ingested-item moderation URL safety", () => {
  it("renders a legacy unsafe source as inert text and disables approval", () => {
    render(React.createElement(PendingItemsQueue, {
      items: [item("data:text/html,payload")],
    }));

    expect(screen.queryByRole("link", { name: "Legacy feed item" })).toBeNull();
    expect(screen.getByText("Legacy feed item").tagName).toBe("SPAN");
    expect(screen.getByText(/unsafe\/invalid URL/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Approve" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect((screen.getByRole("button", { name: "Reject" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });
});

describe("repurpose publication URL safety", () => {
  it("keeps valid links clickable and renders unsafe legacy values as inert text", () => {
    render(
      React.createElement(RepurposeQueue, {
        jobs: [
          repurposeJob(1, " https://www.linkedin.com/posts/safe "),
          repurposeJob(2, "data:text/html,legacy-payload"),
        ],
      }),
    );

    const links = screen.getAllByRole("link", { name: "view post ↗" });
    expect(links).toHaveLength(1);
    expect(links[0]?.getAttribute("href")).toBe("https://www.linkedin.com/posts/safe");
    expect(screen.getByText("unsafe/invalid published URL").tagName).toBe("SPAN");
    expect(document.querySelector('a[href^="data:"]')).toBeNull();
  });
});
