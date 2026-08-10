import { timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Cron routes are public URLs, so they must authenticate. Vercel Cron sends
 * `Authorization: Bearer $CRON_SECRET` automatically when CRON_SECRET is set in the
 * project. Manual runs (and the gstack QA scripts) can pass `?secret=` instead.
 *
 * Fails closed: if CRON_SECRET is unset the route is refused rather than left open.
 */
export function authorizeCron(request: Request): { ok: true } | { ok: false; reason: string } {
  const secret = env.cronSecret;
  if (!secret) return { ok: false, reason: "CRON_SECRET is not configured" };

  const header = request.headers.get("authorization") ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  const query = new URL(request.url).searchParams.get("secret") ?? "";

  if (safeEqual(bearer, secret) || safeEqual(query, secret)) return { ok: true };
  return { ok: false, reason: "invalid cron credentials" };
}

/** Same contract for the admin write endpoints. Read access is gated in middleware. */
export function authorizeAdmin(request: Request): boolean {
  const password = env.adminPassword;
  if (!password) return false;

  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Bearer ")) return safeEqual(header.slice(7), password);
  if (header.startsWith("Basic ")) {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    return safeEqual(decoded.split(":").slice(1).join(":"), password);
  }
  return false;
}

export const ADMIN_REALM = 'Basic realm="Engineerious admin", charset="UTF-8"';
