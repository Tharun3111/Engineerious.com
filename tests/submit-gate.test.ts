import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  getDb: vi.fn(),
}));

vi.mock("@/lib/db", () => dbMocks);

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
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "oss",
        title: validBody.title,
        url: validBody.url,
      }),
    );
  });
});
