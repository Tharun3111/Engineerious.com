import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const queryMocks = vi.hoisted(() => ({
  getDb: vi.fn(),
}));

vi.mock("@/lib/db", () => queryMocks);
vi.mock("next/cache", () => ({
  unstable_cache:
    <T>(reader: () => Promise<T>) =>
    () =>
      reader(),
}));

import {
  getActiveDates,
  getFeed,
  getFeedCounts,
  getItem,
  getItemsForDate,
} from "@/lib/queries";

describe("public item queries", () => {
  const previousGate = process.env.PUBLIC_RESEARCH_ENABLED;

  beforeEach(() => {
    queryMocks.getDb.mockReset();
    delete process.env.PUBLIC_RESEARCH_ENABLED;
  });

  afterEach(() => {
    if (previousGate === undefined) delete process.env.PUBLIC_RESEARCH_ENABLED;
    else process.env.PUBLIC_RESEARCH_ENABLED = previousGate;
  });

  it("returns no item data without touching the database while the public gate is closed", async () => {
    await expect(getFeed()).resolves.toEqual({ items: [], error: null });
    await expect(getItem(1)).resolves.toBeNull();
    await expect(getFeedCounts()).resolves.toEqual({ news: 0, model: 0, oss: 0 });
    await expect(getActiveDates()).resolves.toEqual(new Set());
    await expect(getItemsForDate("2026-08-25")).resolves.toEqual({ items: [], error: null });
    expect(queryMocks.getDb).not.toHaveBeenCalled();
  });

  it("keeps hard-closed news and model rows unavailable even when research is enabled", async () => {
    process.env.PUBLIC_RESEARCH_ENABLED = "true";

    await expect(getFeed({ type: "news" })).resolves.toEqual({ items: [], error: null });
    await expect(getFeed({ type: "model" })).resolves.toEqual({ items: [], error: null });
    expect(queryMocks.getDb).not.toHaveBeenCalled();
  });
});
