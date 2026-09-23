import { describe, expect, it } from "vitest";

import { sanitizeAnalyticsEvent } from "@/components/PrivacyAnalytics";

import fs from "node:fs";
import path from "node:path";

describe("privacy analytics boundary", () => {
  it("injects the Vercel script only on a real Vercel deployment", () => {
    const layout = fs.readFileSync(path.join(process.cwd(), "app/layout.tsx"), "utf8");

    expect(layout).toContain('process.env.VERCEL === "1" ? <PrivacyAnalytics /> : null');
  });

  it("strips query strings and fragments from absolute and relative pageviews", () => {
    expect(
      sanitizeAnalyticsEvent({
        type: "pageview",
        url: "https://engineerious.com/api/search?q=private#result",
      }),
    ).toEqual({ type: "pageview", url: "https://engineerious.com/api/search" });

    expect(
      sanitizeAnalyticsEvent({ type: "pageview", url: "/daily/2026-08-25?source=email#take" }),
    ).toEqual({ type: "pageview", url: "/daily/2026-08-25" });
  });

  it("drops private desk traffic, custom events, and malformed URLs", () => {
    expect(
      sanitizeAnalyticsEvent({ type: "pageview", url: "https://engineerious.com/admin" }),
    ).toBeNull();
    expect(
      sanitizeAnalyticsEvent({ type: "pageview", url: "https://engineerious.com/admin/digests" }),
    ).toBeNull();
    expect(
      sanitizeAnalyticsEvent({ type: "event", url: "https://engineerious.com/blog" }),
    ).toBeNull();
    expect(sanitizeAnalyticsEvent({ type: "pageview", url: "http://[" })).toBeNull();
  });

  it("does not confuse a public path beginning with the same letters for admin", () => {
    expect(
      sanitizeAnalyticsEvent({ type: "pageview", url: "https://engineerious.com/administrator" }),
    ).toEqual({ type: "pageview", url: "https://engineerious.com/administrator" });
  });
});
