import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  captureAndSyncSubscriber: vi.fn(),
  enforcePublicMutationRateLimit: vi.fn(),
}));

vi.mock("@/lib/subscriber-delivery", () => ({
  captureAndSyncSubscriber: mocks.captureAndSyncSubscriber,
}));

vi.mock("@/lib/public-rate-limit", () => ({
  enforcePublicMutationRateLimit: mocks.enforcePublicMutationRateLimit,
}));

import { maxDuration, POST } from "@/app/api/subscribe/route";

function request(body: unknown): Request {
  return new Request("http://localhost/api/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.captureAndSyncSubscriber.mockResolvedValue({
    outcome: "ready",
  });
  mocks.enforcePublicMutationRateLimit.mockResolvedValue({
    status: "allowed",
    enforced: true,
  });
});

describe("public subscriber capture", () => {
  it("allows enough time for bounded provider recovery", () => {
    expect(maxDuration).toBeGreaterThanOrEqual(90);
  });

  it("normalizes email before durable capture and returns a generic receipt", async () => {
    const response = await POST(request({ email: "  Reader@Example.COM  ", company: "" }));

    expect(response.status).toBe(200);
    expect(mocks.enforcePublicMutationRateLimit).toHaveBeenCalledWith({
      action: "subscribe",
      request: expect.any(Request),
      normalizedEmail: "reader@example.com",
    });
    expect(mocks.captureAndSyncSubscriber).toHaveBeenCalledWith("reader@example.com");
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("keeps the honeypot inert while returning an enumeration-safe success shape", async () => {
    const response = await POST(
      request({ email: "reader@example.com", company: "automated form filler" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.enforcePublicMutationRateLimit).not.toHaveBeenCalled();
    expect(mocks.captureAndSyncSubscriber).not.toHaveBeenCalled();
  });

  it("keeps a limited signup enumeration-safe and performs no capture or provider work", async () => {
    mocks.enforcePublicMutationRateLimit.mockResolvedValue({
      status: "limited",
      retryAfterSeconds: 900,
    });

    const response = await POST(request({ email: "reader@example.com" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(response.headers.get("retry-after")).toBeNull();
    expect(mocks.captureAndSyncSubscriber).not.toHaveBeenCalled();
  });

  it("fails closed with the same receipt when production rate limiting is unavailable", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.enforcePublicMutationRateLimit.mockResolvedValue({ status: "unavailable" });

    const response = await POST(request({ email: "reader@example.com" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.captureAndSyncSubscriber).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(
      "[subscribe] public mutation rate limit unavailable",
    );
    error.mockRestore();
  });

  it("does not expose provider degradation after durable capture", async () => {
    mocks.captureAndSyncSubscriber.mockResolvedValue({
      outcome: "pending",
      error: "provider unavailable",
    });

    const response = await POST(request({ email: "reader@example.com" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("uses the same success shape for an existing provider opt-out", async () => {
    mocks.captureAndSyncSubscriber.mockResolvedValue({ outcome: "inactive" });

    const response = await POST(request({ email: "reader@example.com" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("rejects invalid or over-broad public bodies before capture", async () => {
    for (const body of [
      { email: "not-an-email" },
      { email: "reader@example.com", role: "admin" },
    ]) {
      const response = await POST(request(body));
      expect(response.status).toBe(400);
    }
    expect(mocks.enforcePublicMutationRateLimit).not.toHaveBeenCalled();
    expect(mocks.captureAndSyncSubscriber).not.toHaveBeenCalled();
  });

  it("rejects oversized signup JSON before durable capture", async () => {
    const response = await POST(
      request({ email: "reader@example.com", company: "x".repeat(5_000) }),
    );

    expect(response.status).toBe(413);
    expect(mocks.enforcePublicMutationRateLimit).not.toHaveBeenCalled();
    expect(mocks.captureAndSyncSubscriber).not.toHaveBeenCalled();
  });
});
