import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorizeAdmin: vi.fn(),
  getDb: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ authorizeAdmin: mocks.authorizeAdmin }));
vi.mock("@/lib/db", () => ({ getDb: mocks.getDb }));

import { GET } from "@/app/api/admin/digests/[id]/evidence/route";

function context(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Daily evidence endpoint", () => {
  it("fails closed before touching the database", async () => {
    mocks.authorizeAdmin.mockReturnValue(false);

    const response = await GET(new Request("http://localhost/api/admin/digests/7/evidence"), context("7"));

    expect(response.status).toBe(401);
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("rejects malformed digest ids before touching the database", async () => {
    mocks.authorizeAdmin.mockReturnValue(true);

    const response = await GET(new Request("http://localhost/api/admin/digests/7x/evidence"), context("7x"));

    expect(response.status).toBe(400);
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("returns retained findings, coverage, and raw gathered evidence only to admin", async () => {
    mocks.authorizeAdmin.mockReturnValue(true);
    const queue: unknown[][] = [
      [{ id: 7, date: "2026-08-25" }],
      [
        {
          findings: [{ title: "Release", sourceUrls: ["https://openai.com/release"] }],
          coverageNotes: "Primary source confirmed; independent coverage is thin.",
          gatheredItems: { tavily: [{ query: "AI release", results: [] }] },
          tavilyCreditsUsed: 1,
        },
      ],
    ];
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => queue.shift() ?? []),
          })),
        })),
      })),
    };
    mocks.getDb.mockReturnValue(db);

    const response = await GET(
      new Request("http://localhost/api/admin/digests/7/evidence", {
        headers: { authorization: "Basic test" },
      }),
      context("7"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      digestId: 7,
      date: "2026-08-25",
      coverageNotes: expect.stringMatching(/Primary source/),
      tavilyCreditsUsed: 1,
    });
    expect(db.select).toHaveBeenCalledTimes(2);
  });
});
