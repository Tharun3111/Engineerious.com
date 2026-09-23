import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorizeAdmin: vi.fn(),
  getDb: vi.fn(),
}));

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return { ...actual, authorizeAdmin: mocks.authorizeAdmin };
});
vi.mock("@/lib/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db")>();
  return { ...actual, getDb: mocks.getDb };
});

import { POST as generateRepurpose } from "@/app/api/repurpose/route";
import { POST as reviewRepurpose } from "@/app/api/admin/repurpose/route";
import { POST as reviewSubmission } from "@/app/api/admin/submissions/route";

function request(url: string, body: unknown, contentType = "application/json"): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": contentType, authorization: "Basic test" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authorizeAdmin.mockReturnValue(false);
});

describe("remaining admin mutation authentication", () => {
  it.each([
    [
      reviewRepurpose,
      "http://localhost/api/admin/repurpose",
      { id: 1, action: "reject" },
    ],
    [
      reviewSubmission,
      "http://localhost/api/admin/submissions",
      { id: 1, action: "reject" },
    ],
    [generateRepurpose, "http://localhost/api/repurpose", { slug: "published-post" }],
  ] as const)("rejects before database or body work", async (handler, url, body) => {
    const response = await handler(request(url, body));

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain("Engineerious admin");
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("requires JSON after successful authentication", async () => {
    mocks.authorizeAdmin.mockReturnValue(true);

    const response = await reviewSubmission(
      request(
        "http://localhost/api/admin/submissions",
        { id: 1, action: "reject" },
        "text/plain",
      ),
    );

    expect(response.status).toBe(415);
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("refuses to promote a legacy non-HTTP submission into a public item", async () => {
    mocks.authorizeAdmin.mockReturnValue(true);
    const insert = vi.fn();
    const update = vi.fn();
    mocks.getDb.mockReturnValue({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [{
              id: 1,
              type: "news",
              title: "Unsafe legacy submission",
              url: "javascript:alert(document.domain)",
              note: null,
              submitterEmail: null,
              createdAt: new Date("2026-08-25T12:00:00.000Z"),
            }]),
          })),
        })),
      })),
      insert,
      update,
    });

    const response = await reviewSubmission(
      request(
        "http://localhost/api/admin/submissions",
        { id: 1, action: "accept" },
      ),
    );

    expect(response.status).toBe(409);
    expect(insert).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});
