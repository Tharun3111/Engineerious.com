import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  enforcePublicMutationRateLimit: vi.fn(),
}));

vi.mock("@/lib/db", () => dbMocks);
vi.mock("@/lib/public-rate-limit", () => ({
  enforcePublicMutationRateLimit: dbMocks.enforcePublicMutationRateLimit,
}));

import { POST } from "@/app/api/submit/route";

const validBody = {
  type: "oss",
  title: "A useful open-source release",
  url: "https://example.com/release",
};

describe("public submission launch gate", () => {
  const previousGate = process.env.PUBLIC_RESEARCH_ENABLED;

  beforeEach(() => {
    dbMocks.getDb.mockReset();
    dbMocks.enforcePublicMutationRateLimit.mockReset();
    dbMocks.enforcePublicMutationRateLimit.mockResolvedValue({
      status: "allowed",
      enforced: true,
    });
    delete process.env.PUBLIC_RESEARCH_ENABLED;
  });

  afterEach(() => {
    if (previousGate === undefined) delete process.env.PUBLIC_RESEARCH_ENABLED;
    else process.env.PUBLIC_RESEARCH_ENABLED = previousGate;
  });

  it("returns a non-indexable 404 without parsing or writing while the gate is closed", async () => {
    const response = await POST(
      new Request("http://localhost/api/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(validBody),
      }),
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    await expect(response.json()).resolves.toEqual({ ok: false, error: "Not found." });
    expect(dbMocks.enforcePublicMutationRateLimit).not.toHaveBeenCalled();
    expect(dbMocks.getDb).not.toHaveBeenCalled();
  });

  it("accepts a valid submission only when the public research gate is explicitly open", async () => {
    process.env.PUBLIC_RESEARCH_ENABLED = "true";
    const values = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn(() => ({ values }));
    dbMocks.getDb.mockReturnValue({ insert });

    const response = await POST(
      new Request("http://localhost/api/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(validBody),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(dbMocks.enforcePublicMutationRateLimit).toHaveBeenCalledWith({
      action: "submit",
      request: expect.any(Request),
    });
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "oss",
        title: validBody.title,
        url: validBody.url,
      }),
    );
  });

  it("acknowledges a filled honeypot without touching the database", async () => {
    process.env.PUBLIC_RESEARCH_ENABLED = "true";

    const response = await POST(
      new Request("http://localhost/api/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...validBody, company: "bot-filled-company" }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(dbMocks.enforcePublicMutationRateLimit).not.toHaveBeenCalled();
    expect(dbMocks.getDb).not.toHaveBeenCalled();
  });

  it("returns 429 with retry guidance and performs no submission mutation when limited", async () => {
    process.env.PUBLIC_RESEARCH_ENABLED = "true";
    dbMocks.enforcePublicMutationRateLimit.mockResolvedValue({
      status: "limited",
      retryAfterSeconds: 731,
    });

    const response = await POST(
      new Request("http://localhost/api/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(validBody),
      }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("731");
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Too many submissions. Try again later.",
    });
    expect(dbMocks.getDb).not.toHaveBeenCalled();
  });

  it("fails closed before submission mutation when production limiting is unavailable", async () => {
    process.env.PUBLIC_RESEARCH_ENABLED = "true";
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    dbMocks.enforcePublicMutationRateLimit.mockResolvedValue({ status: "unavailable" });

    const response = await POST(
      new Request("http://localhost/api/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(validBody),
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Submissions are temporarily unavailable.",
    });
    expect(dbMocks.getDb).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(
      "[submit] public mutation rate limit unavailable",
    );
    error.mockRestore();
  });

  it("rejects non-HTTP links and oversized JSON before database work", async () => {
    process.env.PUBLIC_RESEARCH_ENABLED = "true";

    for (const url of ["javascript:alert(document.domain)", "data:text/html,unsafe"] ) {
      const response = await POST(
        new Request("http://localhost/api/submit", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...validBody, url }),
        }),
      );
      expect(response.status).toBe(400);
    }

    const oversized = await POST(
      new Request("http://localhost/api/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...validBody, note: "x".repeat(20_000) }),
      }),
    );
    expect(oversized.status).toBe(413);
    expect(dbMocks.enforcePublicMutationRateLimit).not.toHaveBeenCalled();
    expect(dbMocks.getDb).not.toHaveBeenCalled();
  });
});
