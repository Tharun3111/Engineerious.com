import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));

vi.mock("@/lib/db", () => ({ getDb: mocks.getDb }));

import {
  sanitizeDistributionLinks,
  setDistribution,
} from "@/lib/content/sync";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("post distribution URL safety", () => {
  it("normalizes valid HTTP(S) entries and drops malformed or unsafe legacy values", () => {
    expect(
      sanitizeDistributionLinks({
        linkedin: " https://www.linkedin.com/posts/valid ",
        x: "http://x.com/example",
        unsafe: "javascript:alert(document.domain)",
        payload: "data:text/html,legacy",
        malformed: 42,
      }),
    ).toEqual({
      linkedin: "https://www.linkedin.com/posts/valid",
      x: "http://x.com/example",
    });
    expect(sanitizeDistributionLinks(["https://example.com"])).toEqual({});
  });

  it("rejects unsafe writes before database access", async () => {
    await expect(
      setDistribution("safe-post", "linkedin", "javascript:alert(document.domain)"),
    ).rejects.toThrow("absolute HTTP(S) URL");
    await expect(
      setDistribution("safe-post", "linkedin", "data:text/html,legacy"),
    ).rejects.toThrow("absolute HTTP(S) URL");
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("stores the new valid URL without retaining unsafe legacy entries", async () => {
    const stored: Array<Record<string, unknown>> = [];
    const selectLimit = vi.fn(async () => [
      {
        distribution: {
          linkedin: "javascript:alert(document.domain)",
          x: "https://x.com/existing",
        },
      },
    ]);
    const updateWhere = vi.fn(async () => undefined);
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({ limit: selectLimit })),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn((value: Record<string, unknown>) => {
          stored.push(value);
          return { where: updateWhere };
        }),
      })),
    };
    mocks.getDb.mockReturnValue(db);

    await expect(
      setDistribution("safe-post", "instagram", " https://instagram.com/p/new "),
    ).resolves.toEqual({
      x: "https://x.com/existing",
      instagram: "https://instagram.com/p/new",
    });

    expect(stored).toHaveLength(1);
    expect(stored[0]?.distribution).toEqual({
      x: "https://x.com/existing",
      instagram: "https://instagram.com/p/new",
    });
    expect(JSON.stringify(stored[0]?.distribution)).not.toContain("javascript:");
  });
});
