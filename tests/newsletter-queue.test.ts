// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  NewsletterQueue,
  SubscriberDeliveryQueue,
} from "@/components/NewsletterQueue";
import type { NewsletterQueueRecord } from "@/lib/newsletter-queries";

const router = { refresh: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

function newsletter(
  overrides: Partial<NewsletterQueueRecord> = {},
): NewsletterQueueRecord {
  return {
    id: 8,
    date: "2026-08-25",
    publishedAt: "2026-08-25T12:00:00.000Z",
    dailyTitle: "AI Daily Brief — August 25",
    newsletterStatus: null,
    newsletterSubject: null,
    emailHtml: null,
    newsletterVersion: 0,
    newsletterApprovedAt: null,
    newsletterApprovedBy: null,
    newsletterBroadcastId: null,
    newsletterClaimedAt: null,
    newsletterError: null,
    emailSentAt: null,
    ...overrides,
  };
}

function successfulFetch(status: string, newsletterVersion: number) {
  return vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({ ok: true, id: 8, status, newsletterVersion }),
      { status: 200, headers: { "content-type": "application/json" } },
    ),
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  router.refresh.mockReset();
});

describe("Newsletter outbox UI", () => {
  it("does not present a failed queue lookup as an empty ready state", () => {
    render(
      React.createElement(NewsletterQueue, {
        newsletters: [],
        error: "Database unavailable",
      }),
    );

    expect(screen.getByRole("alert").textContent).toContain("Do not prepare or send");
    expect(screen.queryByText(/No published structured Daily Brief/)).toBeNull();
  });

  it("keeps prepare separate from approval and delivery", async () => {
    const fetchMock = successfulFetch("draft", 1);
    vi.stubGlobal("fetch", fetchMock);
    render(React.createElement(NewsletterQueue, { newsletters: [newsletter()] }));

    expect(screen.getByText(/Preparation creates a deterministic email/).textContent).toContain(
      "does not approve or send anything",
    );
    expect(screen.queryByRole("button", { name: "Approve newsletter" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Send newsletter" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Prepare newsletter" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({
      id: 8,
      action: "prepare",
      expectedVersion: 0,
    });
  });

  it("sandboxes the exact preview and requires subject changes to be saved before approval", () => {
    render(
      React.createElement(NewsletterQueue, {
        newsletters: [
          newsletter({
            newsletterStatus: "draft",
            newsletterSubject: "Reviewed subject",
            emailHtml: "<!doctype html><html><body>Reviewed email</body></html>",
            newsletterVersion: 2,
          }),
        ],
      }),
    );

    const frame = screen.getByTitle("Newsletter preview for 2026-08-25");
    expect(frame.getAttribute("sandbox")).toBe("");
    expect(frame.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect((frame as HTMLIFrameElement).srcdoc).toContain("Reviewed email");

    const save = screen.getByRole("button", { name: "Save subject" }) as HTMLButtonElement;
    const approve = screen.getByRole("button", {
      name: "Approve newsletter",
    }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect(approve.disabled).toBe(false);

    fireEvent.change(screen.getByRole("textbox", { name: "Subject" }), {
      target: { value: "Edited subject" },
    });
    expect(save.disabled).toBe(false);
    expect(approve.disabled).toBe(true);
    expect(screen.getByText(/14\/200 characters/).textContent).toContain("unsaved");
  });

  it("requires confirmation before the external send and never exposes Send while claimed", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const fetchMock = successfulFetch("queued", 4);
    vi.stubGlobal("fetch", fetchMock);
    const { rerender } = render(
      React.createElement(NewsletterQueue, {
        newsletters: [
          newsletter({
            newsletterStatus: "approved",
            newsletterSubject: "Approved subject",
            emailHtml: "<p>Approved</p>",
            newsletterVersion: 3,
            newsletterApprovedAt: "2026-08-25T13:00:00.000Z",
            newsletterApprovedBy: "Tharun Chowdary Malepati",
          }),
        ],
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Send newsletter" }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Send newsletter" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(init.body))).toMatchObject({
      action: "send",
      expectedVersion: 3,
    });

    rerender(
      React.createElement(NewsletterQueue, {
        newsletters: [
          newsletter({
            newsletterStatus: "sending",
            newsletterSubject: "Approved subject",
            emailHtml: "<p>Approved</p>",
            newsletterVersion: 4,
            newsletterBroadcastId: "broadcast_8",
          }),
        ],
      }),
    );
    expect(screen.queryByRole("button", { name: "Send newsletter" })).toBeNull();
    expect(screen.getByRole("button", { name: "Reconcile provider" })).toBeTruthy();
    expect(screen.getByText(/Do not send again/)).toBeTruthy();
  });

  it("holds an uncertain creation without a provider ID for manual inspection", () => {
    render(
      React.createElement(NewsletterQueue, {
        newsletters: [
          newsletter({
            newsletterStatus: "sending",
            newsletterSubject: "Approved subject",
            emailHtml: "<p>Approved</p>",
            newsletterVersion: 4,
            newsletterError: "Broadcast creation did not return a response.",
          }),
        ],
      }),
    );

    expect(screen.queryByRole("button", { name: "Send newsletter" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reconcile provider" })).toBeNull();
    expect(screen.getByText(/Inspect Resend before manual recovery/)).toBeTruthy();
  });
});

describe("Subscriber delivery repair UI", () => {
  it("fails closed when subscriber readiness cannot be loaded", () => {
    render(
      React.createElement(SubscriberDeliveryQueue, {
        total: 0,
        subscribers: [],
        error: "Database unavailable",
      }),
    );

    expect(screen.getByRole("alert").textContent).toContain("Do not send");
    expect(screen.queryByText(/All active captured subscribers/)).toBeNull();
  });

  it("shows the send blocker and retries one contact at a time", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ ok: true, delivery: "ready" }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(
      React.createElement(SubscriberDeliveryQueue, {
        total: 1,
        subscribers: [
          {
            id: 41,
            email: "reader@example.com",
            subscribedAt: "2026-08-25T11:00:00.000Z",
            resendSyncAttemptedAt: "2026-08-25T11:01:00.000Z",
            resendSyncError: "Resend returned 503",
          },
        ],
      }),
    );

    expect(screen.getByText(/Newsletter sends stay blocked/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry contact sync" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({ action: "retry_sync", id: 41 });
  });

});
