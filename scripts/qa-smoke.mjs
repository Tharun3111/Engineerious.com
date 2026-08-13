#!/usr/bin/env node
/**
 * Dependency-free deploy gate. Checks status codes, feed population, and the
 * presence of the newsletter form on every route that matters.
 *
 *   npm run qa:smoke                                  # localhost:3000
 *   BASE_URL=https://<preview>.vercel.app npm run qa:smoke
 *
 * This is the cheap half of QA. The expensive half — real rendering, responsive
 * breakpoints, console/network errors, visual diffs — is gstack /qa and /browse.
 * See gstack/README.md.
 */

const baseUrl = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** `feed: true` asserts the page rendered populated rows, not an empty/error state. */
const ROUTES = [
  { path: "/", newsletter: true },
  { path: "/news", feed: true, contains: "AI news for engineering decisions." },
  { path: "/models", feed: true, contains: "Model updates compared for real-world use." },
  { path: "/blog", feed: true, contains: "Practical guides for building reliable AI systems." },
  // Gated by PUBLIC_RESEARCH_ENABLED (middleware.ts + lib/public-launch.ts). This
  // list assumes the flag is "true" (the current default — see docs/launch-runbook.md).
  // Set QA_GATE_CLOSED=true when checking a deployment with the flag off.
  ...(process.env.QA_GATE_CLOSED === "true"
    ? [
        { path: "/open-source", expect: 404 },
        { path: "/resources", expect: 404 },
        { path: "/pillars/eval-first", expect: 404 },
        { path: "/submit", expect: 404 },
      ]
    : [
        { path: "/open-source", contains: "Open-source releases worth evaluating." },
        { path: "/resources", contains: "Guides and templates for reliable AI systems" },
        { path: "/pillars/eval-first" },
        { path: "/submit", contains: "Suggest a link for review" },
      ]),
  { path: "/about", newsletter: true },
  { path: "/subscribe", newsletter: true },
  { path: "/rss.xml", contains: "<rss" },
  { path: "/sitemap.xml", contains: "<urlset" },
  { path: "/robots.txt", contains: "Sitemap:" },
  { path: "/admin", expectOneOf: [401, 503] },
  { path: "/api/cron/news", expect: 401 },
  { path: "/api/cron/rank", expect: 401 },
];

const failures = [];
const warnings = [];

for (const route of ROUTES) {
  const url = `${baseUrl}${route.path}`;
  const expectedStatuses = route.expectOneOf ?? [route.expect ?? 200];

  let res;
  let html = "";
  const started = Date.now();

  try {
    res = await fetch(url, { redirect: "manual" });
    html = await res.text();
  } catch (error) {
    failures.push(`${route.path} — request failed: ${error.message}`);
    continue;
  }

  const ms = Date.now() - started;

  if (!expectedStatuses.includes(res.status)) {
    failures.push(
      `${route.path} — expected ${expectedStatuses.join(" or ")}, got ${res.status}`,
    );
    continue;
  }
  if (res.status !== 200) {
    console.log(`✓ ${route.path} → ${res.status} (${ms}ms)`);
    continue;
  }

  if (route.contains && !html.includes(route.contains)) {
    failures.push(`${route.path} — missing expected content: ${route.contains}`);
    continue;
  }

  if (route.feed) {
    if (html.includes('data-feed-state="error"')) {
      failures.push(`${route.path} — feed rendered an ERROR state (check DATABASE_URL)`);
      continue;
    }
    if (html.includes('data-feed-state="empty"')) {
      // Not fatal on a fresh install: the cron may simply not have run yet.
      warnings.push(`${route.path} — feed is EMPTY (has the ingestion cron run?)`);
    }
  }

  if (route.newsletter && !html.includes('data-testid="newsletter-cta"')) {
    failures.push(`${route.path} — newsletter CTA is missing`);
    continue;
  }

  console.log(`✓ ${route.path} (${ms}ms)`);
}

for (const warning of warnings) console.warn(`⚠ ${warning}`);

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed:`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}

console.log(`\nAll ${ROUTES.length} checks passed against ${baseUrl}.`);
