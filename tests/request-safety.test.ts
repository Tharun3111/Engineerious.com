import { describe, expect, it } from "vitest";

import { readBoundedJsonMutation } from "@/lib/request-safety";

function request(
  body: BodyInit,
  headers: Record<string, string> = {},
  url = "https://engineerious.com/api/mutation",
): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
    body,
  });
}

describe("bounded JSON mutation boundary", () => {
  it("accepts same-origin JSON and non-browser clients without Origin metadata", async () => {
    const browser = await readBoundedJsonMutation(
      request('{"ok":true}', { origin: "https://engineerious.com" }),
      64,
    );
    expect(browser).toMatchObject({ ok: true, value: { ok: true } });

    const cli = await readBoundedJsonMutation(request('{"ok":true}'), 64);
    expect(cli).toMatchObject({ ok: true, value: { ok: true } });
  });

  it("rejects non-JSON, encoded, cross-site, foreign-origin, and malformed-origin requests", async () => {
    const cases = [
      request("{}", { "content-type": "text/plain" }),
      request("{}", { "content-encoding": "gzip" }),
      request("{}", { "sec-fetch-site": "cross-site" }),
      request("{}", { origin: "https://attacker.example" }),
      request("{}", { origin: "not an origin" }),
    ];
    const statuses = [];
    for (const candidate of cases) {
      const result = await readBoundedJsonMutation(candidate, 64);
      expect(result.ok).toBe(false);
      if (!result.ok) statuses.push(result.response.status);
    }
    expect(statuses).toEqual([415, 415, 403, 403, 403]);
  });

  it("rejects declared and actual bodies over the byte limit before JSON parsing", async () => {
    const declared = request("{}", { "content-length": "65" });
    const declaredResult = await readBoundedJsonMutation(declared, 64);
    expect(declaredResult.ok).toBe(false);
    if (!declaredResult.ok) expect(declaredResult.response.status).toBe(413);
    expect(declared.bodyUsed).toBe(false);

    const actualResult = await readBoundedJsonMutation(request(JSON.stringify("x".repeat(100))), 64);
    expect(actualResult.ok).toBe(false);
    if (!actualResult.ok) expect(actualResult.response.status).toBe(413);
  });

  it("rejects invalid Content-Length, UTF-8, and malformed JSON with controlled errors", async () => {
    const invalidLength = await readBoundedJsonMutation(
      request("{}", { "content-length": "not-a-number" }),
      64,
    );
    expect(invalidLength.ok).toBe(false);
    if (!invalidLength.ok) expect(invalidLength.response.status).toBe(400);

    const invalidUtf8 = await readBoundedJsonMutation(
      request(new Uint8Array([0xff, 0xfe])),
      64,
    );
    expect(invalidUtf8.ok).toBe(false);
    if (!invalidUtf8.ok) expect(invalidUtf8.response.status).toBe(400);

    const malformed = await readBoundedJsonMutation(request("{"), 64);
    expect(malformed.ok).toBe(false);
    if (!malformed.ok) expect(malformed.response.status).toBe(400);
  });
});
