import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  shouldFailOnDatabaseError: vi.fn(),
  unstableCache: vi.fn((fn: () => unknown) => fn),
}));

vi.mock("@/lib/db", () => ({
  getDb: mocks.getDb,
  shouldFailOnDatabaseError: mocks.shouldFailOnDatabaseError,
}));
vi.mock("next/cache", () => ({ unstable_cache: mocks.unstableCache }));

import {
  getCuratedAiAdminQueue,
  getCuratedAiCorpus,
  getCuratedAiSignals,
} from "@/lib/curated-ai-queries";

function snapshot() {
  return {
    schemaVersion: 1,
    itemId: 42,
    type: "news",
    title: "Immutable reviewed title",
    url: "https://example.com/release",
    summary: "Immutable reviewed summary.",
    category: "infrastructure",
    topicSlugs: ["rag"],
    whyItMatters: "The reviewed engineering consequence.",
    source: "Example Engineering",
    sourceSlug: "example-engineering",
    sourceWeight: 1,
    author: null,
    sourcePublishedAt: null,
    firstSeen: "2026-08-25T12:05:00.000Z",
  };
}

function publicRow(overrides: Record<string, unknown> = {}) {
  return {
    itemId: 42,
    type: "news",
    status: "approved",
    score: 9.75,
    curatedSnapshot: snapshot(),
    curatedAt: new Date("2026-08-25T14:00:00.000Z"),
    curatedBy: "Tharun Chowdary Malepati",
    ...overrides,
  };
}

function fakePublicDb(rows: unknown[]) {
  const select = vi.fn((selection: unknown) => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        orderBy: vi.fn(async () => rows),
      })),
    })),
    selection,
  }));
  return { select };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.shouldFailOnDatabaseError.mockReturnValue(false);
});

describe("curated AI public query", () => {
  it("selects no mutable display fields and returns immutable copy with live rank", async () => {
    const db = fakePublicDb([
      { ...publicRow(), title: "Mutable raw title", summary: "Mutable raw summary" },
    ]);
    mocks.getDb.mockReturnValue(db);

    const result = await getCuratedAiCorpus({ publicResearchEnabled: false });

    expect(result.error).toBeNull();
    expect(result.signals[0]).toMatchObject({
      title: "Immutable reviewed title",
      summary: "Immutable reviewed summary.",
      rankScore: 9.75,
    });
    const selection = db.select.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(selection).sort()).toEqual(
      ["curatedAt", "curatedBy", "curatedSnapshot", "itemId", "score", "status", "type"].sort(),
    );
    expect(selection).not.toHaveProperty("title");
    expect(selection).not.toHaveProperty("url");
    expect(selection).not.toHaveProperty("summary");
  });

  it("keeps valid snapshots visible while explicitly reporting invalid stored rows", async () => {
    mocks.getDb.mockReturnValue(
      fakePublicDb([publicRow(), publicRow({ itemId: 99, curatedSnapshot: { broken: true } })]),
    );
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await getCuratedAiCorpus({ publicResearchEnabled: true });

    expect(result.signals).toHaveLength(1);
    expect(result.error).toBe("1 curated AI snapshot failed validation");
  });

  it("rejects unsupported topic filters without touching the database", async () => {
    const result = await getCuratedAiSignals({ topicSlug: "prompting" });
    expect(result).toEqual({ signals: [], error: null });
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("derives capped and topic-filtered projections from the same uncapped corpus", async () => {
    const unrelated = publicRow({
      itemId: 41,
      curatedSnapshot: { ...snapshot(), itemId: 41, topicSlugs: [] },
      score: 10,
    });
    const matching = publicRow({ score: 1 });
    const db = fakePublicDb([unrelated, matching]);
    mocks.getDb.mockReturnValue(db);

    const result = await getCuratedAiSignals({ limit: 1, topicSlug: "rag" });

    expect(result.signals.map((entry) => entry.itemId)).toEqual([42]);
    expect(db.select).toHaveBeenCalledOnce();
  });

  it("returns an explicit local error but fails configured CI/deploy reads", async () => {
    const unavailable = new Error("database unavailable");
    mocks.getDb.mockImplementation(() => {
      throw unavailable;
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(getCuratedAiSignals()).resolves.toEqual({
      signals: [],
      error: "database unavailable",
    });

    mocks.shouldFailOnDatabaseError.mockReturnValue(true);
    await expect(getCuratedAiSignals()).rejects.toThrow("database unavailable");
  });
});

describe("curated AI admin query", () => {
  it("returns every curated row in addition to the capped recent candidate list", async () => {
    const base = {
      id: 42,
      type: "news",
      status: "approved",
      title: "Current raw title",
      url: "https://example.com/release",
      summary: "Current raw summary",
      aiNote: null,
      source: "Example Engineering",
      sourceSlug: "example-engineering",
      sourceWeight: 1,
      author: null,
      score: 9.75,
      firstSeen: new Date("2025-01-01T00:00:00.000Z"),
      publishedAt: null,
    };
    const curatedRow = {
      ...base,
      curatedSnapshot: snapshot(),
      curatedAt: new Date("2025-01-01T02:00:00.000Z"),
      curatedBy: "Tharun Chowdary Malepati",
    };
    const candidateRow = {
      ...base,
      id: 99,
      firstSeen: new Date("2026-08-25T12:00:00.000Z"),
      curatedSnapshot: null,
      curatedAt: null,
      curatedBy: null,
    };

    let call = 0;
    const db = {
      select: vi.fn(() => {
        const current = call++;
        return {
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              orderBy: vi.fn(() =>
                current === 0
                  ? Promise.resolve([curatedRow])
                  : { limit: vi.fn(async () => [candidateRow]) },
              ),
            })),
          })),
        };
      }),
    };
    mocks.getDb.mockReturnValue(db);

    const result = await getCuratedAiAdminQueue(1);

    expect(result.error).toBeNull();
    expect(result.items.map((item) => item.id)).toEqual([42, 99]);
    expect(result.items[0].signal?.title).toBe("Immutable reviewed title");
    expect(result.items[0].expectedSourceVersion).toMatch(/^[a-f0-9]{64}$/);
    expect(result.items[0].expectedCurationVersion).toMatch(/^[a-f0-9]{64}$/);
    expect(result.items[1].hasCuratedState).toBe(false);
    expect(result.items[1].expectedCurationVersion).toBeNull();
    expect(db.select).toHaveBeenCalledTimes(2);
  });
});
