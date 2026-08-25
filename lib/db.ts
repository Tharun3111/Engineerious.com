import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { Pool } from "pg";

import * as schema from "@/db/schema";
import { env } from "@/lib/env";

export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

/**
 * Neon's serverless client (`@neondatabase/serverless` + `drizzle-orm/neon-http`)
 * speaks Neon's HTTP proxy protocol, not the Postgres wire protocol — it can only
 * reach actual Neon infrastructure. Local development against Docker/any other
 * plain Postgres needs `node-postgres` instead, so the driver is picked from the
 * connection string's host. Production, pointed at a real Neon URL, is unaffected.
 */
function create(url: string): Database {
  const isNeon = /\.neon\.(tech|build)\b/.test(url);
  return (
    isNeon
      ? drizzleNeon(neon(url), { schema, casing: "snake_case" })
      : drizzlePg(new Pool({ connectionString: url }), { schema, casing: "snake_case" })
  ) as unknown as Database;
}

let cached: Database | undefined;

/**
 * Lazy singleton. Kept lazy so `next build` succeeds on a machine with no
 * DATABASE_URL — pages that need data call `getDb()` inside a try/catch and fall
 * back to an explicit "feed unavailable" state rather than failing the render.
 */
export function getDb(): Database {
  if (!env.databaseUrl) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.");
  }
  cached ??= create(env.databaseUrl);
  return cached;
}

/** A configured deployment database is part of the publication contract. Local
 * authoring may render MDX without Postgres, but CI and every Vercel environment
 * must fail a build instead of caching an outage as an empty publication. */
export function shouldFailOnDatabaseError({
  databaseUrl = env.databaseUrl,
  vercelEnv = process.env.VERCEL_ENV,
  ci = process.env.CI,
}: {
  databaseUrl?: string;
  vercelEnv?: string;
  ci?: string;
} = {}): boolean {
  return Boolean(databaseUrl) && (Boolean(vercelEnv) || ci === "true");
}

export { schema };
