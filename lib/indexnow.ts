import { env } from "@/lib/env";

/**
 * IndexNow — tells Bing/Yandex a URL changed instead of waiting for a recrawl.
 * Google does not participate in IndexNow; GSC still needs its own submission
 * (see docs/launch-runbook.md). Best-effort by design: called from the publish
 * path, which must never fail because a third-party indexing ping failed.
 */
export async function submitUrls(urls: string[]): Promise<void> {
  if (!env.indexNowKey || urls.length === 0) return;

  // Everything that can throw — including `new URL()` on a malformed siteUrl —
  // stays inside the try. A throw before the try starts would reject this
  // function's promise instead of being caught, breaking the "never throws"
  // contract callers (the admin approve route) rely on.
  try {
    const site = env.siteUrl.replace(/\/$/, "");
    const host = new URL(site).host;
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        host,
        key: env.indexNowKey,
        keyLocation: `${site}/${env.indexNowKey}.txt`,
        urlList: urls,
      }),
      // A hanging IndexNow endpoint must not hang the admin approve request it's
      // called from — cap it well under any platform function timeout.
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.error(`[indexnow] submit failed: ${res.status} ${await res.text()}`);
    }
  } catch (error) {
    console.error("[indexnow] submit failed:", error instanceof Error ? error.message : error);
  }
}
