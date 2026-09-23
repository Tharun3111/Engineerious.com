import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorizeAdmin: vi.fn(),
  getDb: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return { ...actual, authorizeAdmin: mocks.authorizeAdmin };
});
vi.mock("@/lib/db", () => ({
  getDb: mocks.getDb,
  shouldFailOnDatabaseError: vi.fn(() => false),
}));
vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
  revalidateTag: mocks.revalidateTag,
  unstable_cache: (fn: () => unknown) => fn,
}));

import { POST } from "@/app/api/admin/items/route";

function request(body: unknown): Request {
  return new Request("http://localhost/api/admin/items", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Basic test" },
    body: JSON.stringify(body),
  });
}

function fakeDb(
  returning: unknown[] = [{ id: 9, status: "rejected" }],
  selectRows: unknown[] = [{ url: "https://example.com/source" }],
) {
  const sets: Array<Record<string, unknown>> = [];
  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ limit: vi.fn(async () => selectRows) })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((value: Record<string, unknown>) => {
        sets.push(value);
        return {
          where: vi.fn(() => ({ returning: vi.fn(async () => returning) })),
        };
      }),
    })),
  };
  return { db, sets };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authorizeAdmin.mockReturnValue(true);
});

describe("item moderation curation safety", () => {
  it("authenticates at the route before parsing or database work", async () => {
    mocks.authorizeAdmin.mockReturnValue(false);

    const response = await POST(request({ id: 9, action: "approve" }));

    expect(response.status).toBe(401);
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("rejects and unpublishes a curated item in the same database update", async () => {
    const { db, sets } = fakeDb();
    mocks.getDb.mockReturnValue(db);

    const response = await POST(request({ id: 9, action: "reject" }));

    expect(response.status).toBe(200);
    expect(db.update).toHaveBeenCalledTimes(1);
    expect(sets).toEqual([
      {
        status: "rejected",
        curatedSnapshot: null,
        curatedAt: null,
        curatedBy: null,
      },
    ]);
    expect(mocks.revalidateTag).toHaveBeenCalledWith("curated-ai", { expire: 0 });
    expect(mocks.revalidateTag).toHaveBeenCalledWith("feed", { expire: 0 });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/ai");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/api/search");
    expect(mocks.revalidatePath).not.toHaveBeenCalledWith("/search");
  });

  it("ordinary approval never creates curation metadata", async () => {
    const { db, sets } = fakeDb([{ id: 9, status: "approved" }]);
    mocks.getDb.mockReturnValue(db);

    const response = await POST(request({ id: 9, action: "approve" }));

    expect(response.status).toBe(200);
    expect(sets).toEqual([{ status: "approved" }]);
    expect(sets[0]).not.toHaveProperty("curatedSnapshot");
    expect(sets[0]).not.toHaveProperty("curatedAt");
    expect(sets[0]).not.toHaveProperty("curatedBy");
  });

  it("fails closed before approving an unsafe legacy item URL", async () => {
    const { db, sets } = fakeDb([{ id: 9, status: "approved" }], [{ url: "data:text/html,payload" }]);
    mocks.getDb.mockReturnValue(db);

    const response = await POST(request({ id: 9, action: "approve" }));

    expect(response.status).toBe(400);
    expect(sets).toEqual([]);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("rejects expanded moderation payloads before touching the database", async () => {
    const response = await POST(request({ id: 9, action: "approve", curatedSnapshot: {} }));
    expect(response.status).toBe(400);
    expect(mocks.getDb).not.toHaveBeenCalled();
  });
});
