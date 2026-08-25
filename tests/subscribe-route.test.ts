import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  captureAndSyncSubscriber: vi.fn(),
}));

vi.mock("@/lib/subscriber-delivery", () => ({
  captureAndSyncSubscriber: mocks.captureAndSyncSubscriber,
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
});

describe("public subscriber capture", () => {
  it("allows enough time for bounded provider recovery", () => {
    expect(maxDuration).toBeGreaterThanOrEqual(90);
  });

  it("normalizes email before durable capture and returns a generic receipt", async () => {
    const response = await POST(request({ email: "  Reader@Example.COM  ", company: "" }));

    expect(response.status).toBe(200);
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
    expect(mocks.captureAndSyncSubscriber).not.toHaveBeenCalled();
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
    expect(mocks.captureAndSyncSubscriber).not.toHaveBeenCalled();
  });
});
