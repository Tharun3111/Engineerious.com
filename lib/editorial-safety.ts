import type { DigestStatus } from "@/db/schema";

export type ContentSourceStatus = "primary" | "secondary" | "mixed";

/**
 * Domains whose URLs are inherently first-party evidence: the originating lab,
 * repository, model card, standard, or paper host. Unknown hosts deliberately fall
 * back to secondary — a false "primary" label is worse than a conservative one.
 */
const PRIMARY_SOURCE_HOSTS = [
  "openai.com",
  "anthropic.com",
  "deepmind.google",
  "research.google",
  "ai.google.dev",
  "blog.google",
  "developers.googleblog.com",
  "ai.meta.com",
  "engineering.fb.com",
  "microsoft.com",
  "azure.microsoft.com",
  "nvidia.com",
  "huggingface.co",
  "github.com",
  "arxiv.org",
  "doi.org",
  "aclanthology.org",
  "openreview.net",
  "proceedings.mlr.press",
  "papers.nips.cc",
  "qwenlm.github.io",
  "mistral.ai",
  "deepseek.com",
  "cohere.com",
  "x.ai",
] as const;

function isPrimarySourceUrl(raw: string): boolean {
  try {
    const host = new URL(raw).hostname.toLowerCase().replace(/^www\./, "");
    return PRIMARY_SOURCE_HOSTS.some(
      (primaryHost) => host === primaryHost || host.endsWith(`.${primaryHost}`),
    );
  } catch {
    return false;
  }
}

/** Exact-membership check: generated stages may select URLs, never create them. */
export function assertUrlsAllowed(
  candidateUrls: readonly string[],
  allowedUrls: readonly string[],
  label: string,
): void {
  const allowed = new Set(allowedUrls);
  const rejected = [...new Set(candidateUrls.filter((url) => !allowed.has(url)))];
  if (rejected.length === 0) return;
  throw new Error(`${label} included URL(s) that were not gathered: ${rejected.join(", ")}`);
}

/** Conservative post-level label derived from every source the draft may rely on. */
export function deriveSourceStatus(urls: readonly string[]): ContentSourceStatus {
  if (urls.length === 0) return "mixed";
  const hasPrimary = urls.some(isPrimarySourceUrl);
  const hasSecondary = urls.some((url) => !isPrimarySourceUrl(url));
  if (hasPrimary && hasSecondary) return "mixed";
  return hasPrimary ? "primary" : "secondary";
}

export function isDigestWriteRetryable(status: DigestStatus): boolean {
  return status === "generating" || status === "failed";
}

/** `approved` is accepted only to recover rows stranded by the legacy publish flow. */
export function isDigestPublishable(status: DigestStatus): boolean {
  return status === "pending_review" || status === "approved";
}

/** neon-http and node-postgres expose raw execute rows with different wrappers. */
export function extractQueryRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object" && "rows" in result) {
    const rows = (result as { rows?: unknown }).rows;
    return Array.isArray(rows) ? (rows as T[]) : [];
  }
  return [];
}
