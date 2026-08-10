#!/usr/bin/env node
/**
 * Trigger an ingestion cron against a running server.
 *
 *   npm run cron:news
 *   npm run cron:all
 *   BASE_URL=https://engineerious-xyz.vercel.app npm run cron:all
 *
 * Reads CRON_SECRET from .env.local / .env so you do not paste it into a shell
 * history. Exits non-zero if any adapter in the run failed — usable as a CI step.
 */
import { readFileSync } from "node:fs";

const FEEDS = ["news", "models", "oss", "rank"];

function loadEnvFile(path) {
  try {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key]) continue;
      process.env[key] = rawValue.replace(/^["']|["']$/g, "");
    }
  } catch {
    // No env file is fine — the value may come from the real environment.
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const target = process.argv[2] ?? "all";
const baseUrl = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const secret = process.env.CRON_SECRET;

if (!secret) {
  console.error("CRON_SECRET is not set. Add it to .env.local (see .env.example).");
  process.exit(1);
}

const feeds = target === "all" ? FEEDS : [target];
if (feeds.some((feed) => !FEEDS.includes(feed))) {
  console.error(`Unknown feed "${target}". Use one of: ${FEEDS.join(", ")}, all`);
  process.exit(1);
}

let failed = false;

for (const feed of feeds) {
  const url = `${baseUrl}/api/cron/${feed}`;
  process.stdout.write(`→ ${url}\n`);

  const started = Date.now();
  try {
    const res = await fetch(url, { headers: { authorization: `Bearer ${secret}` } });
    const body = await res.json().catch(() => ({}));
    const seconds = ((Date.now() - started) / 1000).toFixed(1);

    if (!res.ok) {
      failed = true;
      console.error(`  ✗ ${res.status} ${res.statusText} (${seconds}s)`, body);
      continue;
    }

    if (feed === "rank") {
      console.log(`  ✓ rescored ${body.rescored ?? "?"} items (${seconds}s)`);
      continue;
    }

    console.log(
      `  ✓ ${body.ok}/${body.adapters} adapters, ${body.fetched} fetched, ${body.written} written (${seconds}s)`,
    );

    for (const result of body.results ?? []) {
      if (!result.ok) {
        failed = true;
        console.error(`    ✗ ${result.slug}: ${result.error}`);
      } else if (result.skipped) {
        console.log(`    – ${result.slug}: ${result.skipped}`);
      }
    }
  } catch (error) {
    failed = true;
    console.error(`  ✗ request failed: ${error.message}`);
  }
}

process.exit(failed ? 1 : 0);
