import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    resendApiKey: "re_test_key",
    resendSegmentId: "seg_test",
    resendFromAddress: "Engineerious <digest@engineerious.com>",
    newsletterPostalAddress: "PO Box 1, Austin, TX",
    siteUrl: "https://engineerious.com",
  },
}));

import {
  createBroadcastDraft,
  getBroadcast,
  ResendRequestError,
  sendBroadcast,
  upsertContact,
} from "@/lib/resend";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("Resend delivery boundary", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates a broadcast draft without sending and identifies every raw request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: "br_123" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createBroadcastDraft({ subject: "Reviewed brief", html: "<p>Reviewed</p>" }),
    ).resolves.toEqual({ id: "br_123" });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/broadcasts");
    expect(new Headers(init.headers).get("user-agent")).toContain("Engineerious/");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer re_test_key");
    expect(JSON.parse(String(init.body))).toMatchObject({
      segment_id: "seg_test",
      send: false,
      subject: "Reviewed brief",
    });
  });

  it("creates a verified-missing contact with explicit active segment state", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ message: "not found" }, 404))
      .mockResolvedValueOnce(jsonResponse({ id: "ct_123", object: "contact" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(upsertContact("reader@example.com")).resolves.toBe("ct_123");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.resend.com/contacts/reader%40example.com",
    );
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe("GET");
    const create = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(create.method).toBe("POST");
    expect(JSON.parse(String(create.body))).toEqual({
      email: "reader@example.com",
      segments: [{ id: "seg_test" }],
    });
  });

  it("records an existing provider opt-out without changing consent or segment membership", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ id: "ct_123", email: "reader@example.com", unsubscribed: true }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(upsertContact("reader@example.com")).resolves.toBe("ct_123");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe("GET");
  });

  it("repairs segment membership for an existing active contact without changing consent", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ id: "ct_123", email: "reader@example.com", unsubscribed: false }),
      )
      .mockResolvedValueOnce(jsonResponse({ object: "list", data: [], has_more: false }))
      .mockResolvedValueOnce(jsonResponse({ id: "seg_test" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(upsertContact("reader@example.com")).resolves.toBe("ct_123");

    const calls = fetchMock.mock.calls as Array<[string, RequestInit]>;
    expect(calls.map(([url, init]) => `${init.method} ${url}`)).toEqual([
      "GET https://api.resend.com/contacts/reader%40example.com",
      "GET https://api.resend.com/contacts/ct_123/segments",
      "POST https://api.resend.com/contacts/ct_123/segments/seg_test",
    ]);
  });

  it("recovers a concurrent contact create through the documented update path", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ message: "not found" }, 404))
      .mockResolvedValueOnce(jsonResponse({ message: "already exists" }, 409))
      .mockResolvedValueOnce(
        jsonResponse({ id: "ct_123", email: "reader@example.com", unsubscribed: false }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ object: "list", data: [{ id: "seg_test" }], has_more: false }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(upsertContact("reader@example.com")).resolves.toBe("ct_123");
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect((fetchMock.mock.calls[3]?.[1] as RequestInit).method).toBe("GET");
  });

  it("classifies a lost mutation response as ambiguous and a validation response as definitive", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("socket closed")));
    await expect(sendBroadcast("br_123")).rejects.toMatchObject({
      name: "ResendRequestError",
      ambiguous: true,
      status: null,
    });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse({ message: "invalid" }, 422)));
    try {
      await createBroadcastDraft({ subject: "Reviewed", html: "<p>Reviewed</p>" });
      throw new Error("Expected createBroadcastDraft to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(ResendRequestError);
      expect(error).toMatchObject({ ambiguous: false, status: 422 });
    }
  });

  it("strictly validates provider status responses without making GET failures ambiguous", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ id: "br_123", status: "draft", extra: true }))
      .mockResolvedValueOnce(jsonResponse({ id: "br_123", status: "mystery" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getBroadcast("br_123")).resolves.toMatchObject({ id: "br_123", status: "draft" });
    await expect(getBroadcast("br_123")).rejects.toMatchObject({
      name: "ResendRequestError",
      ambiguous: false,
    });
  });
});
