import { createHash } from "node:crypto";

const TRACKING_PARAMS = [
  /^utm_/i,
  /^ref$/i,
  /^ref_src$/i,
  /^source$/i,
  /^fbclid$/i,
  /^gclid$/i,
  /^mc_cid$/i,
  /^mc_eid$/i,
  /^igshid$/i,
];

/**
 * Canonical URL form used as the dedupe key. Overlapping feeds (an OpenAI post that
 * also lands on HN, MarkTechPost and a news API) must collapse to one row, so we
 * normalise host case, `www.`, tracking params, trailing slash and the fragment.
 */
export function canonicalizeUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    // Not parseable — hash the raw string so ingestion still dedupes exact repeats.
    return raw.trim();
  }

  url.protocol = url.protocol === "http:" ? "https:" : url.protocol;
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  url.hash = "";

  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.some((re) => re.test(key))) url.searchParams.delete(key);
  }
  url.searchParams.sort();

  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }

  return url.toString();
}

export function urlHash(raw: string): string {
  return createHash("sha256").update(canonicalizeUrl(raw)).digest("hex");
}

export function hostname(raw: string): string {
  try {
    return new URL(raw).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
