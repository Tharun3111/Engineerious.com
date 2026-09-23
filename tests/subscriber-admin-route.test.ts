import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorizeAdmin: vi.fn(),
  retrySubscriberSync: vi.fn(),
}));

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return { ...actual, authorizeAdmin: mocks.authorizeAdmin };
});
vi.mock("@/lib/subscriber-delivery", () => ({
  retrySubscriberSync: mocks.retrySubscriberSync,
}));

import { maxDuration, POST } from "@/app/api/admin/subscribers/route";

function request(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/admin/subscribers", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Basic test",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authorizeAdmin.mockReturnValue(true);
  mocks.retrySubscriberSync.mockResolvedValue({ outcome: "ready" });
});

describe("subscriber delivery repair", () => {
  it("allows enough time for bounded provider recovery", () => {
    expect(maxDuration).toBeGreaterThanOrEqual(90);
  });

  it("authenticates before parsing or attempting provider work", async () => {
    mocks.authorizeAdmin.mockReturnValue(false);

    const response = await POST(
      request(null, {
        "content-type": "text/plain",
        origin: "https://attacker.example",
        "sec-fetch-site": "cross-site",
      }),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain("Engineerious admin");
    expect(mocks.retrySubscriberSync).not.toHaveBeenCalled();
  });

  it("accepts only one bounded retry target", async () => {
    const invalid = await POST(
      request({ action: "retry_sync", id: 4, ids: [4, 5] }),
    );
    expect(invalid.status).toBe(400);
    expect(mocks.retrySubscriberSync).not.toHaveBeenCalled();

    const response = await POST(request({ action: "retry_sync", id: 4 }));
    expect(response.status).toBe(200);
    expect(mocks.retrySubscriberSync).toHaveBeenCalledWith(4);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      delivery: "ready",
    });
  });

  it("requires JSON and rejects browser cross-site mutations after authentication", async () => {
    const wrongType = await POST(
      request({ action: "retry_sync", id: 4 }, { "content-type": "text/plain" }),
    );
    expect(wrongType.status).toBe(415);

    const crossSite = await POST(
      request(
        { action: "retry_sync", id: 4 },
        { "sec-fetch-site": "cross-site" },
      ),
    );
    expect(crossSite.status).toBe(403);

    const foreignOrigin = await POST(
      request(
        { action: "retry_sync", id: 4 },
        { origin: "https://attacker.example", "sec-fetch-site": "same-site" },
      ),
    );
    expect(foreignOrigin.status).toBe(403);
    expect(mocks.retrySubscriberSync).not.toHaveBeenCalled();
  });

  it("allows same-origin browsers and non-browser clients with absent fetch metadata", async () => {
    const browser = await POST(
      request(
        { action: "retry_sync", id: 4 },
        {
          "content-type": "application/json; charset=utf-8",
          origin: "http://localhost",
          "sec-fetch-site": "same-origin",
        },
      ),
    );
    expect(browser.status).toBe(200);

    const nonBrowser = await POST(request({ action: "retry_sync", id: 4 }));
    expect(nonBrowser.status).toBe(200);
    expect(mocks.retrySubscriberSync).toHaveBeenCalledTimes(2);
  });

  it("keeps inactive, missing, and provider-failed records explicit", async () => {
    for (const [result, status] of [
      [{ outcome: "missing" }, 404],
      [{ outcome: "inactive" }, 409],
      [
        {
          outcome: "pending",
          error: "Resend contact sync returned 503.",
        },
        502,
      ],
    ] as const) {
      mocks.retrySubscriberSync.mockResolvedValueOnce(result);
      const response = await POST(request({ action: "retry_sync", id: 4 }));
      expect(response.status).toBe(status);
      await expect(response.json()).resolves.toHaveProperty("error");
    }
  });
});
