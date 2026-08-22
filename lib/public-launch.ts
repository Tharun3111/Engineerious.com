/**
 * Two tiers, because they answer different questions.
 *
 * CLOSED: not ready, and not re-openable by flipping an env var. /news and /models
 * each stated a promise their own first ten rows broke — /models offered "the tests
 * worth running before you switch" above two strangers' copies of the Hugging Face
 * quickstart, /news offered "explains the engineering impact" above "Stop eating
 * Lady Gaga's Oreos". Ingestion keeps running; these are closed as reader-facing
 * surfaces until something curates them. Re-open by moving the entry to DEFERRED,
 * or deleting it from both lists.
 *
 * DEFERRED: built and tested, waiting on a launch decision, gated on
 * PUBLIC_RESEARCH_ENABLED. Note that this flag is currently "true" in production,
 * which is why /resources (four "Coming soon" cards) and /open-source (raw
 * `<details open>` markup leaking into rendered text) are live and indexed today.
 * That is an environment problem, not a code one — but it is also the reason /news
 * and /models are in CLOSED rather than here: a gate that a stale env var can
 * silently disable is not a gate.
 */
export const CLOSED_PUBLIC_PREFIXES = ["/news", "/models"] as const;

export const DEFERRED_PUBLIC_PREFIXES = [
  "/open-source",
  "/resources",
  "/submit",
  "/pillars",
] as const;

function matchesPrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isClosedPublicPath(pathname: string): boolean {
  return matchesPrefix(pathname, CLOSED_PUBLIC_PREFIXES);
}

export function isDeferredPublicPath(pathname: string): boolean {
  return matchesPrefix(pathname, DEFERRED_PUBLIC_PREFIXES);
}

export function shouldCloseResearchPath(pathname: string, enabledValue?: string): boolean {
  if (isClosedPublicPath(pathname)) return true;
  return enabledValue !== "true" && isDeferredPublicPath(pathname);
}
