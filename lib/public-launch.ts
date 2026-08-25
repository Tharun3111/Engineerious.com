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
 * /resources is also closed: it is a set of placeholder cards, not a reader-ready
 * resource library. A launch flag must never make placeholder claims indexable.
 *
 * DEFERRED: implemented surfaces waiting on a launch decision, gated on
 * PUBLIC_RESEARCH_ENABLED. A deferred route opens only for the exact value "true".
 */
export const CLOSED_PUBLIC_PREFIXES = ["/news", "/models", "/resources"] as const;

export const DEFERRED_PUBLIC_PREFIXES = [
  "/open-source",
  "/submit",
  "/pillars",
] as const;

export type PublicItemType = "news" | "model" | "oss";

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

/**
 * Public item visibility must be enforced where rows are read, not only where a
 * route is rendered. That keeps archive, search, sitemap-derived dates, and any
 * future feed consumer from leaking a type whose dedicated route is closed.
 *
 * For the current launch contract only reviewed open-source items have a public
 * feed surface, and only while the research gate is explicitly enabled.
 */
export function isPublicItemType(type: PublicItemType, enabledValue?: string): boolean {
  return type === "oss" && enabledValue === "true";
}
