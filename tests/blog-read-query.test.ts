import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  shouldFailOnDatabaseError: vi.fn(),
}));

vi.mock("@/lib/db", () => mocks);

import { getAdjacentPosts, getPost } from "@/lib/content/blog";
import { getPostDistribution } from "@/lib/content/sync";

function dbRow(slug: string, overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    slug,
    title: "Targeted DB post",
    dek: "Loaded with a one-row query.",
    pillar: "eval-first",
    canonical: null,
    publishedAt: new Date("2026-08-25T12:00:00.000Z"),
    distribution: {},
    body: "A compact post body.",
    draft: false,
    format: "article",
    origin: "human",
    sourceStatus: "primary",
    testedStatus: "tested_once",
    authenticityStatus: "verified",
    tags: ["testing"],
    reviewedBy: "Tharun",
    reviewedAt: new Date("2026-08-25T12:00:00.000Z"),
    tldr: null,
    keyFacts: null,
    relevantTickers: null,
    diagram: null,
    createdAt: new Date("2026-08-25T11:00:00.000Z"),
    updatedAt: new Date("2026-08-25T12:00:00.000Z"),
    ...overrides,
  };
}

function targetedDb(row: ReturnType<typeof dbRow>) {
  const limit = vi.fn(async () => [row]);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  return { db: { select }, limit, select, where };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.shouldFailOnDatabaseError.mockReturnValue(false);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("targeted blog slug reads", () => {
  it("loads at most one body-bearing DB row for a missing MDX slug", async () => {
    const { db, limit, select, where } = targetedDb(dbRow("targeted-db-post"));
    mocks.getDb.mockReturnValue(db);

    const post = await getPost("targeted-db-post");

    expect(post).toMatchObject({ slug: "targeted-db-post", source: "db" });
    expect(select).toHaveBeenCalledTimes(1);
    expect(where).toHaveBeenCalledTimes(1);
    expect(limit).toHaveBeenCalledWith(1);
  });

  it("uses exactly one body-bearing select across the combined detail-page reads", async () => {
    const target = dbRow("detail-query-contract");
    const navigationRows = [
      dbRow("newer-writing", { publishedAt: new Date("2026-08-27T12:00:00.000Z") }),
      dbRow("legacy-daily", {
        origin: "ai_generated",
        publishedAt: new Date("2026-08-26T12:00:00.000Z"),
      }),
      target,
      dbRow("older-writing", { publishedAt: new Date("2026-08-24T12:00:00.000Z") }),
    ];
    const contentLimit = vi.fn(async () => [target]);
    const distributionLimit = vi.fn(async () => [
      { distribution: { x: "https://x.com/engineerious/status/1" } },
    ]);
    const navigationOrder = vi.fn(async () => navigationRows);
    const selections: Array<Record<string, unknown>> = [];
    const select = vi.fn((selection: Record<string, unknown>) => {
      selections.push(selection);
      const includesBody = Object.hasOwn(selection, "body");
      const isDistribution = Object.keys(selection).length === 1 &&
        Object.hasOwn(selection, "distribution");
      return {
        from: vi.fn(() => ({
          where: vi.fn(() =>
            includesBody
              ? { limit: contentLimit }
              : isDistribution
                ? { limit: distributionLimit }
                : { orderBy: navigationOrder },
          ),
        })),
      };
    });
    mocks.getDb.mockReturnValue({ select });

    const [post, distribution, adjacent] = await Promise.all([
      getPost("detail-query-contract"),
      getPostDistribution("detail-query-contract"),
      getAdjacentPosts("detail-query-contract"),
    ]);

    expect(post).toMatchObject({ slug: "detail-query-contract", body: "A compact post body." });
    expect(distribution).toEqual({ x: "https://x.com/engineerious/status/1" });
    expect(adjacent.newer).toMatchObject({ slug: "newer-writing" });
    expect(adjacent.older).toMatchObject({ slug: "older-writing" });
    expect(contentLimit).toHaveBeenCalledWith(1);
    expect(distributionLimit).toHaveBeenCalledWith(1);
    expect(navigationOrder).toHaveBeenCalledTimes(1);
    expect(selections).toHaveLength(3);
    expect(selections.filter((selection) => Object.hasOwn(selection, "body"))).toHaveLength(1);
    expect(
      selections.filter(
        (selection) => Object.keys(selection).length === 1 &&
          Object.hasOwn(selection, "distribution"),
      ),
    ).toHaveLength(1);
  });

  it("logs and drops malformed legacy DB-native rows instead of projecting them", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const malformed = [
      dbRow("invalid-origin", { origin: "legacy_unknown" }),
      dbRow("unsigned-verified", { reviewedBy: null, reviewedAt: null }),
      dbRow("invalid-tags", { tags: { unsafe: "not-an-array" } }),
      dbRow("invalid/slug"),
    ];

    for (const row of malformed) {
      mocks.getDb.mockReturnValue(targetedDb(row).db);
      await expect(getPost(row.slug)).resolves.toBeNull();
    }

    expect(error).toHaveBeenCalledTimes(4);
    expect(error.mock.calls.map((call) => String(call[0])).join("\n")).toContain(
      "ignored malformed DB-native post",
    );
  });

  it("falls back locally but fails closed when a configured deployment cannot query", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.getDb.mockReturnValue({
      select: vi.fn(() => {
        throw new Error("database unavailable");
      }),
    });

    await expect(getPost("local-db-fallback")).resolves.toBeNull();

    mocks.shouldFailOnDatabaseError.mockReturnValue(true);
    await expect(getPost("production-db-failure")).rejects.toThrow("database unavailable");
  });
});
