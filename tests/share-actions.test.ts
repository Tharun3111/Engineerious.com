// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ShareActions } from "@/components/ShareActions";

const props = {
  title: "A reviewed AI brief",
  text: "What changed & why it matters.",
  url: "https://engineerious.com/daily/2026-08-25",
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("ShareActions", () => {
  it("uses the native share sheet when the browser provides one", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share, clipboard: { writeText: vi.fn() } });
    render(React.createElement(ShareActions, props));

    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    await waitFor(() => expect(share).toHaveBeenCalledWith(props));
    expect(screen.getByRole("status").textContent).toBe("Shared.");
  });

  it("copies the permanent URL when native sharing is unavailable or fails", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    render(React.createElement(ShareActions, props));

    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(props.url));
    expect(screen.getByRole("status").textContent).toBe("Link copied.");
  });

  it("provides encoded email, LinkedIn, and X links without shortening the permalink", () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn() } });
    render(React.createElement(ShareActions, props));

    const email = screen.getByRole("link", { name: "Share by email" }).getAttribute("href");
    expect(email).toContain(encodeURIComponent(props.title));
    expect(email).toContain(encodeURIComponent(props.url));

    const linkedin = new URL(
      screen.getByRole("link", { name: /Share on LinkedIn/ }).getAttribute("href")!,
    );
    expect(linkedin.searchParams.get("url")).toBe(props.url);

    const x = new URL(screen.getByRole("link", { name: /Share on X/ }).getAttribute("href")!);
    expect(x.searchParams.get("url")).toBe(props.url);
    expect(x.searchParams.get("text")).toContain(props.title);
  });
});
