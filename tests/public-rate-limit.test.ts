import { readFileSync } from "node:fs";
import { join } from "node:path";

import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

import { isValidPublicMutationRateLimitSecret } from "@/lib/env";
import {
  enforcePublicMutationRateLimit,
  getPublicMutationClientIdentity,
  hashPublicMutationIdentity,
  mustEnforcePublicMutationRateLimit,
  normalizePublicMutationEmail,
} from "@/lib/public-rate-limit";

const SECRET = "ab".repeat(32);
const OTHER_SECRET = "cd".repeat(32);
const NOW = new Date("2026-08-25T12:34:00.000Z");

function request(headers: HeadersInit = {}): Request {
  return new Request("https://engineerious.com/api/subscribe", { headers });
}

describe("public mutation identity privacy", () => {
  it("accepts only a random-key-shaped 32-128 byte hex secret", () => {
    expect(isValidPublicMutationRateLimitSecret(SECRET)).toBe(true);
    expect(isValidPublicMutationRateLimitSecret("ab".repeat(128))).toBe(true);
    expect(isValidPublicMutationRateLimitSecret(undefined)).toBe(false);
    expect(isValidPublicMutationRateLimitSecret("ab".repeat(31))).toBe(false);
    expect(isValidPublicMutationRateLimitSecret("ab".repeat(129))).toBe(false);
    expect(isValidPublicMutationRateLimitSecret(`${"ab".repeat(31)}a`)).toBe(false);
    expect(isValidPublicMutationRateLimitSecret("not-a-hex-secret".repeat(8))).toBe(false);
  });

  it("normalizes email and stores a domain-separated keyed digest, never the identity", () => {
    const normalized = normalizePublicMutationEmail("  Reader@Example.COM  ");
    const emailHash = hashPublicMutationIdentity(
      SECRET,
      "subscribe_email",
      normalized,
    );

    expect(normalized).toBe("reader@example.com");
    expect(emailHash).toMatch(/^[0-9a-f]{64}$/);
    expect(emailHash).not.toContain(normalized);
    expect(
      hashPublicMutationIdentity(SECRET, "subscribe_email", normalized),
    ).toBe(emailHash);
    expect(
      hashPublicMutationIdentity(OTHER_SECRET, "subscribe_email", normalized),
    ).not.toBe(emailHash);
    expect(
      hashPublicMutationIdentity(SECRET, "subscribe_client", normalized),
    ).not.toBe(emailHash);
  });

  it("prefers Vercel's overwritten address header and rejects malformed identities", () => {
    expect(
      getPublicMutationClientIdentity(
        request({
          "x-vercel-forwarded-for": "2001:db8::7",
          "x-forwarded-for": "198.51.100.8",
        }),
      ),
    ).toBe("2001:db8::7");
    expect(
      getPublicMutationClientIdentity(
        request({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }),
      ),
    ).toBe("203.0.113.9");
    expect(
      getPublicMutationClientIdentity(request({ "x-forwarded-for": "attacker-value" })),
    ).toBeNull();
    expect(getPublicMutationClientIdentity(request())).toBeNull();
  });
});

describe("atomic fixed-window enforcement", () => {
  it("consumes subscribe client and normalized-email dimensions in one atomic statement", async () => {
    const dialect = new PgDialect();
    let built: ReturnType<PgDialect["sqlToQuery"]> | undefined;
    const execute = vi.fn(async (query) => {
      built = dialect.sqlToQuery(query);
      return {
        rows: [{ scope: "subscribe_client" }, { scope: "subscribe_email" }],
      };
    });

    const decision = await enforcePublicMutationRateLimit(
      {
        action: "subscribe",
        request: request({ "x-vercel-forwarded-for": "203.0.113.42" }),
        normalizedEmail: "  Reader@Example.COM  ",
      },
      { required: true, secret: SECRET, now: NOW, execute },
    );

    expect(decision).toEqual({ status: "allowed", enforced: true });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(built).toBeDefined();
    const normalizedSql = built!.sql.replace(/\s+/g, " ");
    expect(normalizedSql).toContain(
      'select "consumed_scope" as "scope" from "consume_public_mutation_rate_limits"($1::jsonb, $2)',
    );
    const payload = JSON.parse(String(built!.params[0])) as Array<{
      scope: string;
      identity_hash: string;
    }>;
    expect(payload.map((dimension) => dimension.scope)).toEqual([
      "subscribe_client",
      "subscribe_email",
    ]);

    const serializedParameters = JSON.stringify(built!.params);
    expect(serializedParameters).not.toContain("203.0.113.42");
    expect(serializedParameters.toLowerCase()).not.toContain("reader@example.com");
    expect(
      payload.filter((dimension) => /^[0-9a-f]{64}$/.test(dimension.identity_hash)),
    ).toHaveLength(2);
  });

  it("denies when either subscribe dimension is exhausted and uses its real window", async () => {
    const decision = await enforcePublicMutationRateLimit(
      {
        action: "subscribe",
        request: request({ "x-forwarded-for": "203.0.113.20" }),
        normalizedEmail: "reader@example.com",
      },
      {
        required: true,
        secret: SECRET,
        now: NOW,
        execute: async () => ({ rows: [{ scope: "subscribe_client" }] }),
      },
    );

    expect(decision).toEqual({ status: "limited", retryAfterSeconds: 1_560 });
  });

  it("does not allow concurrent submit attempts past the database-returned limit", async () => {
    const dialect = new PgDialect();
    let consumed = 0;
    const execute = vi.fn(async (query) => {
      const built = dialect.sqlToQuery(query);
      const [dimension] = JSON.parse(String(built.params[0])) as Array<{
        scope: string;
        request_limit: number;
      }>;
      const current = ++consumed;
      await Promise.resolve();
      return current <= dimension.request_limit ? [{ scope: dimension.scope }] : [];
    });
    const sharedRequest = request({ "x-forwarded-for": "198.51.100.77" });

    const decisions = await Promise.all(
      Array.from({ length: 25 }, () =>
        enforcePublicMutationRateLimit(
          { action: "submit", request: sharedRequest },
          { required: true, secret: SECRET, now: NOW, execute },
        ),
      ),
    );

    expect(decisions.filter((decision) => decision.status === "allowed")).toHaveLength(5);
    expect(decisions.filter((decision) => decision.status === "limited")).toHaveLength(20);
    expect(execute).toHaveBeenCalledTimes(25);
  });

  it("fails closed in production for missing prerequisites or database errors", async () => {
    const execute = vi.fn(async () => {
      throw new Error("database unavailable");
    });

    await expect(
      enforcePublicMutationRateLimit(
        { action: "submit", request: request({ "x-forwarded-for": "203.0.113.4" }) },
        { required: true, secret: SECRET, now: NOW, execute },
      ),
    ).resolves.toEqual({ status: "unavailable" });
    await expect(
      enforcePublicMutationRateLimit(
        { action: "submit", request: request({ "x-forwarded-for": "203.0.113.4" }) },
        { required: true, secret: "weak", now: NOW, execute },
      ),
    ).resolves.toEqual({ status: "unavailable" });
    await expect(
      enforcePublicMutationRateLimit(
        { action: "submit", request: request() },
        { required: true, secret: SECRET, now: NOW, execute },
      ),
    ).resolves.toEqual({ status: "unavailable" });

    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("keeps unconfigured local authoring usable without writing a weak counter", async () => {
    const execute = vi.fn();
    await expect(
      enforcePublicMutationRateLimit(
        { action: "submit", request: request() },
        { required: false, secret: "", now: NOW, execute },
      ),
    ).resolves.toEqual({ status: "allowed", enforced: false });
    expect(execute).not.toHaveBeenCalled();
  });

  it("requires enforcement for production and every Vercel environment", () => {
    expect(
      mustEnforcePublicMutationRateLimit({ nodeEnv: "production", vercelEnv: undefined }),
    ).toBe(true);
    expect(
      mustEnforcePublicMutationRateLimit({ nodeEnv: "development", vercelEnv: "preview" }),
    ).toBe(true);
    expect(
      mustEnforcePublicMutationRateLimit({ nodeEnv: "test", vercelEnv: undefined }),
    ).toBe(false);
  });
});

describe("rate-limit deployment contract", () => {
  const root = process.cwd();
  const envExample = readFileSync(join(root, ".env.example"), "utf8");
  const readme = readFileSync(join(root, "README.md"), "utf8");
  const runbook = readFileSync(join(root, "docs/launch-runbook.md"), "utf8");
  const migration = readFileSync(
    join(root, "db/migrations/0010_bent_susan_delgado.sql"),
    "utf8",
  );

  it("documents the required generated secret and migrate-before-deploy order", () => {
    expect(envExample).toContain("PUBLIC_MUTATION_RATE_LIMIT_SECRET");
    expect(envExample).toContain("openssl rand -hex 32");
    expect(readme).toContain("PUBLIC_MUTATION_RATE_LIMIT_SECRET");
    expect(runbook).toContain("0010_bent_susan_delgado.sql");
    expect(runbook).toContain("before deploying");
  });

  it("migrates only hashed identities with an atomic composite counter key", () => {
    expect(migration).toContain('"identity_hash" text NOT NULL');
    expect(migration).not.toMatch(/"(?:client_)?ip"/i);
    expect(migration).not.toContain('"email" text');
    expect(migration).toContain(
      'PRIMARY KEY("scope","identity_hash","window_started_at")',
    );
    expect(migration).toContain("public_mutation_rate_limits_identity_hash_check");
    expect(migration).toContain("pg_advisory_xact_lock(lock_key)");
    expect(migration).toContain("ORDER BY ordered_keys.lock_key");
    expect(migration).toContain("IF EXISTS (");
    expect(migration).toContain("RETURN QUERY");
    expect(migration).toContain('RETURNS TABLE("consumed_scope" text)');
    expect(migration).not.toContain('RETURNS TABLE("scope" text)');
  });
});
