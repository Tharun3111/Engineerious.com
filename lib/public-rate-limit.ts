import { createHmac } from "node:crypto";
import { isIP } from "node:net";

import { sql, type SQL } from "drizzle-orm";

import { getDb } from "@/lib/db";
import {
  env,
  isValidPublicMutationRateLimitSecret,
} from "@/lib/env";
import { extractQueryRows } from "@/lib/editorial-safety";

const HMAC_DOMAIN = "engineerious:public-mutation-rate-limit:v1";
const LOCAL_CLIENT_IDENTITY = "local-development-client";

export const PUBLIC_MUTATION_RATE_LIMIT_POLICIES = {
  subscribeClient: {
    scope: "subscribe_client",
    limit: 10,
    windowSeconds: 15 * 60,
  },
  subscribeEmail: {
    scope: "subscribe_email",
    limit: 3,
    windowSeconds: 60 * 60,
  },
  submitClient: {
    scope: "submit_client",
    limit: 5,
    windowSeconds: 60 * 60,
  },
} as const;

export type PublicMutationRateLimitScope =
  (typeof PUBLIC_MUTATION_RATE_LIMIT_POLICIES)[keyof typeof PUBLIC_MUTATION_RATE_LIMIT_POLICIES]["scope"];

export type PublicMutationRateLimitDecision =
  | { status: "allowed"; enforced: true | false }
  | { status: "limited"; retryAfterSeconds: number }
  | { status: "unavailable" };

type Policy = {
  scope: PublicMutationRateLimitScope;
  limit: number;
  windowSeconds: number;
};

type Dimension = Policy & {
  identityHash: string;
  windowStartedAt: Date;
  windowEndsAt: Date;
};

type Execute = (query: SQL) => Promise<unknown>;

/** Runtime injection is intentionally narrow and exists for deterministic tests. */
export type PublicMutationRateLimitRuntime = {
  secret?: string;
  required?: boolean;
  now?: Date;
  clientIdentity?: string | null;
  execute?: Execute;
};

export function mustEnforcePublicMutationRateLimit({
  nodeEnv = process.env.NODE_ENV,
  vercelEnv = process.env.VERCEL_ENV,
}: {
  nodeEnv?: string;
  vercelEnv?: string;
} = {}): boolean {
  return nodeEnv === "production" || Boolean(vercelEnv);
}

/**
 * Vercel overwrites these forwarding headers at its edge. Prefer the Vercel-only
 * form so a proxy in front of Vercel cannot replace the address used here. A
 * non-Vercel deployment must likewise configure its trusted proxy to overwrite
 * x-forwarded-for rather than append untrusted client input.
 */
export function getPublicMutationClientIdentity(request: Request): string | null {
  const forwarded =
    request.headers.get("x-vercel-forwarded-for") ??
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip");
  if (!forwarded) return null;

  const candidate = forwarded.split(",", 1)[0]?.trim();
  if (!candidate || candidate.length > 128 || isIP(candidate) === 0) return null;
  return candidate;
}

export function normalizePublicMutationEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashPublicMutationIdentity(
  secret: string,
  scope: PublicMutationRateLimitScope,
  identity: string,
): string {
  if (!isValidPublicMutationRateLimitSecret(secret)) {
    throw new Error("Invalid MUTATION_RATE_LIMIT_SECRET.");
  }

  return createHmac("sha256", Buffer.from(secret, "hex"))
    .update(HMAC_DOMAIN)
    .update("\0")
    .update(scope)
    .update("\0")
    .update(identity)
    .digest("hex");
}

function dimensionFor(
  policy: Policy,
  identity: string,
  secret: string,
  now: Date,
): Dimension {
  const windowMilliseconds = policy.windowSeconds * 1_000;
  const windowStartedAt = new Date(
    Math.floor(now.getTime() / windowMilliseconds) * windowMilliseconds,
  );

  return {
    ...policy,
    identityHash: hashPublicMutationIdentity(secret, policy.scope, identity),
    windowStartedAt,
    windowEndsAt: new Date(windowStartedAt.getTime() + windowMilliseconds),
  };
}

function mutationQuery(dimensions: readonly Dimension[], now: Date): SQL {
  const payload = JSON.stringify(
    dimensions.map((dimension) => ({
      scope: dimension.scope,
      identity_hash: dimension.identityHash,
      window_started_at: dimension.windowStartedAt.toISOString(),
      request_limit: dimension.limit,
      expires_at: dimension.windowEndsAt.toISOString(),
    })),
  );

  // The migration-owned function acquires transaction-level advisory locks for
  // every dimension in deterministic order, refreshes its READ COMMITTED snapshot,
  // and increments all counters only after all have capacity. Keeping this as one
  // outer statement works with Neon's HTTP driver, which does not expose interactive
  // transactions, while the function itself provides the all-or-nothing boundary.
  return sql`
    select "consumed_scope" as "scope"
    from "consume_public_mutation_rate_limits"(${payload}::jsonb, ${now})
  `;
}

async function consumeDimensions(
  dimensions: readonly Dimension[],
  now: Date,
  execute: Execute,
): Promise<PublicMutationRateLimitDecision> {
  const result = await execute(mutationQuery(dimensions, now));
  const returnedScopes = new Set(
    extractQueryRows<{ scope?: unknown }>(result)
      .map((row) => row.scope)
      .filter((scope): scope is string => typeof scope === "string"),
  );

  const blocked = dimensions.filter((dimension) => !returnedScopes.has(dimension.scope));
  if (blocked.length === 0) return { status: "allowed", enforced: true };

  const retryAt = Math.max(...blocked.map((dimension) => dimension.windowEndsAt.getTime()));
  return {
    status: "limited",
    retryAfterSeconds: Math.max(1, Math.ceil((retryAt - now.getTime()) / 1_000)),
  };
}

/**
 * Enforces the first durable boundary for public POST routes. Production and every
 * Vercel environment deny mutation when the secret, trusted client address, or
 * database is unavailable. Unconfigured local development fails open explicitly;
 * it never writes a weak or unhashed identity to the counter table.
 */
export async function enforcePublicMutationRateLimit(
  input:
    | { action: "subscribe"; request: Request; normalizedEmail: string }
    | { action: "submit"; request: Request },
  runtime: PublicMutationRateLimitRuntime = {},
): Promise<PublicMutationRateLimitDecision> {
  const required = runtime.required ?? mustEnforcePublicMutationRateLimit();
  const secret = runtime.secret ?? env.publicMutationRateLimitSecret;

  if (!isValidPublicMutationRateLimitSecret(secret)) {
    return required ? { status: "unavailable" } : { status: "allowed", enforced: false };
  }

  const suppliedClientIdentity = Object.prototype.hasOwnProperty.call(
    runtime,
    "clientIdentity",
  );
  const clientIdentity = suppliedClientIdentity
    ? runtime.clientIdentity
    : getPublicMutationClientIdentity(input.request);
  if (!clientIdentity && required) return { status: "unavailable" };

  const effectiveClientIdentity = clientIdentity ?? LOCAL_CLIENT_IDENTITY;
  const now = runtime.now ?? new Date();
  if (!Number.isFinite(now.getTime())) {
    return required ? { status: "unavailable" } : { status: "allowed", enforced: false };
  }

  const dimensions =
    input.action === "subscribe"
      ? [
          dimensionFor(
            PUBLIC_MUTATION_RATE_LIMIT_POLICIES.subscribeClient,
            effectiveClientIdentity,
            secret,
            now,
          ),
          dimensionFor(
            PUBLIC_MUTATION_RATE_LIMIT_POLICIES.subscribeEmail,
            normalizePublicMutationEmail(input.normalizedEmail),
            secret,
            now,
          ),
        ]
      : [
          dimensionFor(
            PUBLIC_MUTATION_RATE_LIMIT_POLICIES.submitClient,
            effectiveClientIdentity,
            secret,
            now,
          ),
        ];

  const execute =
    runtime.execute ??
    ((query: SQL) => getDb().execute(query) as unknown as Promise<unknown>);

  try {
    return await consumeDimensions(dimensions, now, execute);
  } catch {
    return required ? { status: "unavailable" } : { status: "allowed", enforced: false };
  }
}
