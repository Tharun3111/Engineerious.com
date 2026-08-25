import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorizeCron: vi.fn(),
  execute: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ authorizeCron: mocks.authorizeCron }));
vi.mock("@/lib/db", () => ({
  getDb: () => ({ execute: mocks.execute }),
}));
vi.mock("next/cache", () => ({ revalidateTag: mocks.revalidateTag }));

import { GET } from "@/app/api/cron/rank/route";
import { CURATED_AI_CACHE_TAG } from "@/lib/curated-ai-queries";
import { FEED_CACHE_TAG } from "@/lib/queries";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authorizeCron.mockReturnValue({ ok: true });
  mocks.execute.mockResolvedValue({ rowCount: 7 });
});

describe("rank cron cache invalidation", () => {
  it("expires both feed slices and the curated corpus after a successful rescore", async () => {
    const response = await GET(new Request("https://engineerious.com/api/cron/rank"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, rescored: 7 });
    expect(mocks.revalidateTag).toHaveBeenCalledWith(FEED_CACHE_TAG, "max");
    expect(mocks.revalidateTag).toHaveBeenCalledWith(CURATED_AI_CACHE_TAG, { expire: 0 });
  });

  it("does not invalidate either cache when the database update fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.execute.mockRejectedValue(new Error("database unavailable"));

    const response = await GET(new Request("https://engineerious.com/api/cron/rank"));

    expect(response.status).toBe(500);
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
  });
});
