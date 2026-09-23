import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  enforcePublicMutationRateLimit,
  hashPublicMutationIdentity,
  type PublicMutationRateLimitScope,
} from "@/lib/public-rate-limit";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const SECRET = "ab".repeat(32);
const NOW = new Date("2026-08-25T12:34:00.000Z");
const dialect = new PgDialect();

const postgresDescribe = TEST_DATABASE_URL ? describe : describe.skip;

postgresDescribe("public mutation rate limiting on PostgreSQL", () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: TEST_DATABASE_URL, max: 24 });
    const functionCheck = await pool.query<{ function_name: string | null }>(
      "select to_regprocedure('consume_public_mutation_rate_limits(jsonb,timestamp with time zone)')::text as function_name",
    );
    expect(functionCheck.rows[0]?.function_name).not.toBeNull();
  });

  beforeEach(async () => {
    await pool.query("truncate table public_mutation_rate_limits");
  });

  afterAll(async () => {
    await pool?.end();
  });

  async function execute(query: SQL): Promise<unknown> {
    const built = dialect.sqlToQuery(query);
    return pool.query(built.sql, built.params);
  }

  async function subscribe(clientIdentity: string, normalizedEmail: string) {
    return enforcePublicMutationRateLimit(
      {
        action: "subscribe",
        request: new Request("https://engineerious.com/api/subscribe"),
        normalizedEmail,
      },
      {
        required: true,
        secret: SECRET,
        now: NOW,
        clientIdentity,
        execute,
      },
    );
  }

  async function submit(clientIdentity: string) {
    return enforcePublicMutationRateLimit(
      {
        action: "submit",
        request: new Request("https://engineerious.com/api/submit"),
      },
      {
        required: true,
        secret: SECRET,
        now: NOW,
        clientIdentity,
        execute,
      },
    );
  }

  async function storedCount(
    scope: PublicMutationRateLimitScope,
    identityHash: string,
  ): Promise<number | null> {
    const result = await pool.query<{ request_count: number }>(
      `select request_count
       from public_mutation_rate_limits
       where scope = $1 and identity_hash = $2`,
      [scope, identityHash],
    );
    return result.rows[0]?.request_count ?? null;
  }

  it("leaves a new email dimension untouched when its client is already exhausted", async () => {
    const client = "203.0.113.60";
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await expect(subscribe(client, `reader-${attempt}@example.com`)).resolves.toEqual({
        status: "allowed",
        enforced: true,
      });
    }

    const victimEmail = "victim@example.com";
    await expect(subscribe(client, victimEmail)).resolves.toMatchObject({
      status: "limited",
    });

    expect(
      await storedCount(
        "subscribe_client",
        hashPublicMutationIdentity(SECRET, "subscribe_client", client),
      ),
    ).toBe(10);
    expect(
      await storedCount(
        "subscribe_email",
        hashPublicMutationIdentity(SECRET, "subscribe_email", victimEmail),
      ),
    ).toBeNull();
  });

  it("leaves every client dimension untouched when concurrent requests target an exhausted email", async () => {
    const email = "exhausted@example.com";
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expect(subscribe(`198.51.100.${attempt + 1}`, email)).resolves.toEqual({
        status: "allowed",
        enforced: true,
      });
    }

    const blockedClients = Array.from(
      { length: 20 },
      (_, index) => `2001:db8::${index + 1}`,
    );
    const decisions = await Promise.all(
      blockedClients.map((client) => subscribe(client, email)),
    );

    expect(decisions.every((decision) => decision.status === "limited")).toBe(true);
    expect(
      await storedCount(
        "subscribe_email",
        hashPublicMutationIdentity(SECRET, "subscribe_email", email),
      ),
    ).toBe(3);

    const blockedClientHashes = blockedClients.map((client) =>
      hashPublicMutationIdentity(SECRET, "subscribe_client", client),
    );
    const storedClients = await pool.query<{ count: number }>(
      `select count(*)::integer as count
       from public_mutation_rate_limits
       where scope = 'subscribe_client' and identity_hash = any($1::text[])`,
      [blockedClientHashes],
    );
    expect(storedClients.rows[0]?.count).toBe(0);
  });

  it("admits exactly the submit allowance under real concurrent transactions", async () => {
    const client = "192.0.2.44";
    const decisions = await Promise.all(
      Array.from({ length: 25 }, () => submit(client)),
    );

    expect(decisions.filter((decision) => decision.status === "allowed")).toHaveLength(5);
    expect(decisions.filter((decision) => decision.status === "limited")).toHaveLength(20);
    expect(
      await storedCount(
        "submit_client",
        hashPublicMutationIdentity(SECRET, "submit_client", client),
      ),
    ).toBe(5);
  });
});
