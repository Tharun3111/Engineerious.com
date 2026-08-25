import { describe, expect, it } from "vitest";

import { sanitizeAnalyticsEvent } from "@/components/PrivacyAnalytics";

describe("privacy analytics boundary", () => {
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
