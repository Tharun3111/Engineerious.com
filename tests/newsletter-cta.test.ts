// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NewsletterCTA } from "@/components/NewsletterCTA";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Newsletter signup", () => {
  it("uses one enumeration-safe success message without provider detail", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(React.createElement(NewsletterCTA, { hideHeading: true }));
    fireEvent.change(screen.getByRole("textbox", { name: "Email address" }), {
      target: { value: "Reader@Example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Subscribe for updates" }));

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toBe(
        "Thanks. Your signup request has been received.",
      );
    });
    expect(screen.getByRole("textbox", { name: "Email address" })).toHaveProperty("value", "");
  });

  it("includes an accessibility-inert honeypot without adding it to the tab order", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(React.createElement(NewsletterCTA, { hideHeading: true }));
    const honeypot = container.querySelector<HTMLInputElement>('input[name="company"]');
    expect(honeypot).toBeTruthy();
    expect(honeypot?.tabIndex).toBe(-1);

    fireEvent.change(screen.getByRole("textbox", { name: "Email address" }), {
      target: { value: "reader@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Subscribe for updates" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({
      email: "reader@example.com",
      company: "",
    });
  });
});
