"use client";

import { Analytics } from "@vercel/analytics/next";

const ANALYTICS_BASE_URL = "https://engineerious.com";

export type PrivacyAnalyticsEvent = {
  type: "pageview" | "event";
  url: string;
};

/**
 * Pageviews are the entire analytics contract. Fail closed on custom events or
 * malformed URLs, remove query/hash data, and keep the private desk invisible.
 */
export function sanitizeAnalyticsEvent(event: PrivacyAnalyticsEvent): PrivacyAnalyticsEvent | null {
  if (event.type !== "pageview") return null;

  try {
    const absolute = /^https?:\/\//i.test(event.url);
    const url = new URL(event.url, ANALYTICS_BASE_URL);
    if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) return null;

    return {
      ...event,
      url: absolute ? `${url.origin}${url.pathname}` : url.pathname,
    };
  } catch {
    return null;
  }
}

export function PrivacyAnalytics() {
  return <Analytics beforeSend={sanitizeAnalyticsEvent} />;
}
