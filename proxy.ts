import { NextResponse, type NextRequest } from "next/server";

import { shouldCloseResearchPath } from "@/lib/public-launch";

/**
 * HTTP Basic auth over /admin and /api/admin.
 *
 * Basic (not a session cookie) on purpose: it is one env var to operate, the browser
 * replays credentials on the queue's fetch calls with no token plumbing, and gstack's
 * /browse can drive the authenticated screens by importing real browser cookies or
 * passing the header directly.
 *
 * Runs at the request boundary before route rendering. The comparison stays
 * dependency-free so this file remains small and portable.
 */

const REALM = 'Basic realm="Engineerious admin", charset="UTF-8"';

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function unauthorized() {
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": REALM },
  });
}

export function proxy(request: NextRequest) {
  if (shouldCloseResearchPath(request.nextUrl.pathname, process.env.PUBLIC_RESEARCH_ENABLED)) {
    return new NextResponse("Not found.", {
      status: 404,
      headers: { "X-Robots-Tag": "noindex, nofollow" },
    });
  }

  const isAdminPath =
    request.nextUrl.pathname === "/admin" ||
    request.nextUrl.pathname.startsWith("/admin/") ||
    request.nextUrl.pathname.startsWith("/api/admin/");
  if (!isAdminPath) return NextResponse.next();

  const password = process.env.ADMIN_PASSWORD;

  // Fail closed. An unset password must not mean an open admin console.
  if (!password) {
    return new NextResponse(
      "ADMIN_PASSWORD is not configured. Set it in the environment to use /admin.",
      { status: 503 },
    );
  }

  const header = request.headers.get("authorization") ?? "";

  if (header.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      const supplied = decoded.slice(decoded.indexOf(":") + 1);
      if (constantTimeEqual(supplied, password)) return NextResponse.next();
    } catch {
      return unauthorized();
    }
  }

  if (header.startsWith("Bearer ") && constantTimeEqual(header.slice(7), password)) {
    return NextResponse.next();
  }

  return unauthorized();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/admin",
    "/api/admin/:path*",
    "/news/:path*",
    "/models/:path*",
    "/open-source/:path*",
    "/resources/:path*",
    "/submit/:path*",
    "/pillars/:path*",
  ],
};
