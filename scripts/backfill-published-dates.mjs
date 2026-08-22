#!/usr/bin/env node
/**
 * Backfill posts.published_at from the digest's editorial date.
 *
 * WHY. Approving a digest used to stamp `publishedAt: now`, so a reviewed backlog
 * collapsed: four digests approved in one sitting all received the same instant.
 * /blog (which renders publishedAt) showed four posts dated 2026-08-21 about one
 * incident, while /archive (which groups by digests.date) correctly spread them
 * across 08-16..08-21. The same post carried two different dates depending on which
 * page you were on, RSS emitted four items nine seconds apart with slugs backdated
 * six days, and sitemap lastmod tracked the approval click rather than the content.
 *
 * app/api/admin/digests/route.ts now writes the editorial date going forward. This
 * repairs the rows approved before that fix.
 *
 * DRY RUN BY DEFAULT. Prints the exact rows it would change and exits without
 * writing. Pass --apply to commit the update.
 *
 *   node scripts/backfill-published-dates.mjs                  # show the diff
 *   node scripts/backfill-published-dates.mjs --apply          # write it
 *
 * Requires DATABASE_URL. Against Neon, use the pooled connection string.
 */
import { readFileSync } from "node:fs";

import pg from "pg";

function loadEnv() {
  if (process.env.DATABASE_URL) return;
  for (const file of [".env.local", ".env"]) {
    try {
      for (const line of readFileSync(file, "utf8").split("\n")) {
        const match = line.match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/);
        if (match) {
          process.env.DATABASE_URL = match[1].replace(/^["']|["']$/g, "");
          return;
        }
      }
    } catch {
      // Next candidate.
    }
  }
}

function fail(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

const apply = process.argv.includes("--apply");

loadEnv();
if (!process.env.DATABASE_URL) fail("DATABASE_URL is not set (checked env, .env.local, .env).");

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL) ? false : { rejectUnauthorized: false },
});

// Noon UTC keeps the rendered calendar day stable either side of the Chicago
// offset, matching what the approve route now writes.
const SELECT = `
  SELECT p.slug,
         p.published_at                      AS current_published_at,
         (d.date + TIME '12:00')::timestamptz AS editorial_at,
         d.date                              AS editorial_date
    FROM digests d
    JOIN posts   p ON p.slug = d.blog_post_slug
   WHERE d.blog_post_slug IS NOT NULL
     AND p.published_at IS DISTINCT FROM (d.date + TIME '12:00')::timestamptz
   ORDER BY d.date
`;

try {
  await client.connect();
  const { rows } = await client.query(SELECT);

  if (rows.length === 0) {
    console.log("\n  Nothing to change — every post already carries its digest's editorial date.\n");
    process.exit(0);
  }

  console.log(`\n  ${rows.length} post(s) would change:\n`);
  for (const row of rows) {
    const from = row.current_published_at ? new Date(row.current_published_at).toISOString().slice(0, 10) : "null";
    const to = new Date(row.editorial_at).toISOString().slice(0, 10);
    console.log(`    ${row.slug}`);
    console.log(`      ${from}  ->  ${to}`);
  }

  if (!apply) {
    console.log("\n  Dry run. Re-run with --apply to write these changes.\n");
    process.exit(0);
  }

  // Single statement, so a failure part-way cannot leave the table half-migrated.
  const { rowCount } = await client.query(`
    UPDATE posts p
       SET published_at = (d.date + TIME '12:00')::timestamptz,
           updated_at   = now()
      FROM digests d
     WHERE d.blog_post_slug = p.slug
       AND d.blog_post_slug IS NOT NULL
       AND p.published_at IS DISTINCT FROM (d.date + TIME '12:00')::timestamptz
  `);
  console.log(`\n  Updated ${rowCount} post(s).`);
  console.log("  Redeploy or wait for revalidate (300s) for /blog, RSS and the sitemap to catch up.\n");
} catch (error) {
  // node-postgres surfaces connection failures as an AggregateError whose own
  // `.message` is the empty string — the real causes hang off `.errors`. Reporting
  // `error.message` alone prints "Backfill failed:" and nothing else.
  const detail =
    error instanceof AggregateError && error.errors?.length
      ? error.errors.map((e) => e.message || e.code).join("; ")
      : error.message || error.code || String(error);
  fail(`Backfill failed: ${detail}`);
} finally {
  await client.end().catch(() => {});
}
