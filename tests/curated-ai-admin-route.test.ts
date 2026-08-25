import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTHOR_NAME } from "@/lib/site";
import {
  curatedAiCurationVersion,
  curatedAiSourceVersion,
  type CuratedAiSourceVersionInput,
} from "@/lib/curated-ai-source-version";

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
vi.mock("@/lib/db", () => ({ getDb: mocks.getDb }));
vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
  revalidateTag: mocks.revalidateTag,
  unstable_cache: (fn: () => unknown) => fn,
}));

import { POST } from "@/app/api/admin/curated-ai/route";

type ApprovedItem = CuratedAiSourceVersionInput & {
  status: "approved";
  curatedSnapshot: unknown;
  curatedAt: Date | null;
  curatedBy: string | null;
};

function approvedItem(overrides: Partial<ApprovedItem> = {}): ApprovedItem {
  return {
    id: 17,
    type: "model",
    status: "approved",
    title: "Raw model-card title",
    url: "https://example.com/model-card",
    summary: "Raw model-card summary",
    aiNote: "Raw ingestion note",
    source: "Example Models",
    sourceSlug: "example-models",
    sourceWeight: 1.4,
    author: "Model Team",
    publishedAt: new Date("2026-08-25T11:00:00.000Z"),
    firstSeen: new Date("2026-08-25T11:05:00.000Z"),
    curatedSnapshot: null,
    curatedAt: null,
    curatedBy: null,
    ...overrides,
  };
}

function publishBody(overrides: Record<string, unknown> = {}) {
  return {
    id: 17,
    action: "publish",
    expectedSourceVersion: curatedAiSourceVersion(approvedItem()),
    title: "Reviewed model release",
    summary: "The model card documents a changed deployment boundary.",
    category: "models",
    topicSlugs: ["agents"],
    whyItMatters: "Engineers need to rerun their deployment evaluations.",
    ...overrides,
  };
}

function request(body: unknown): Request {
  return new Request("http://localhost/api/admin/curated-ai", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Basic test" },
    body: JSON.stringify(body),
  });
}

function unpublishBody(item: ApprovedItem) {
  return {
    id: item.id,
    action: "unpublish",
    expectedCurationVersion: curatedAiCurationVersion(item),
  };
}

function fakeDb(input: { selectRows: unknown[][]; updateRows?: unknown[][] }) {
  const selects = [...input.selectRows];
  const updates = [...(input.updateRows ?? [])];
  const updateSets: Array<Record<string, unknown>> = [];
  const updateConditions: unknown[] = [];
  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => selects.shift() ?? []),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((value: Record<string, unknown>) => {
        updateSets.push(value);
        return {
          where: vi.fn((condition: unknown) => {
            updateConditions.push(condition);
            return { returning: vi.fn(async () => updates.shift() ?? []) };
          }),
        };
      }),
    })),
  };
  return { db, updateSets, updateConditions };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authorizeAdmin.mockReturnValue(true);
});

describe("curated AI admin publication", () => {
  it("authenticates before parsing or touching the database", async () => {
    mocks.authorizeAdmin.mockReturnValue(false);
    const response = await POST(request(publishBody()));
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain("Engineerious admin");
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("accepts only the narrow reviewed body and copies source facts server-side", async () => {
    const narrowResponse = await POST(
      request({ ...publishBody(), url: "https://attacker.example/replacement" }),
    );
    expect(narrowResponse.status).toBe(400);
    expect(mocks.getDb).not.toHaveBeenCalled();

    const { db, updateSets, updateConditions } = fakeDb({
      selectRows: [[approvedItem()]],
      updateRows: [[{ id: 17 }]],
    });
    mocks.getDb.mockReturnValue(db);

    const response = await POST(request(publishBody()));

    expect(response.status).toBe(200);
    expect(updateConditions).toHaveLength(1);
    expect(updateSets[0]).toMatchObject({
      curatedBy: AUTHOR_NAME,
      curatedSnapshot: {
        schemaVersion: 1,
        itemId: 17,
        type: "model",
        title: "Reviewed model release",
        url: "https://example.com/model-card",
        source: "Example Models",
        sourceSlug: "example-models",
        sourceWeight: 1.4,
        author: "Model Team",
        sourcePublishedAt: "2026-08-25T11:00:00.000Z",
        firstSeen: "2026-08-25T11:05:00.000Z",
      },
    });
    expect(updateSets[0].curatedAt).toBeInstanceOf(Date);
    expect(mocks.revalidateTag).toHaveBeenCalledWith("curated-ai", { expire: 0 });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/ai");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/topics/agents");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/api/search");
    expect(mocks.revalidatePath).not.toHaveBeenCalledWith("/search");
  });

  it("refuses overwrite until the immutable snapshot is explicitly unpublished", async () => {
    const { db } = fakeDb({
      selectRows: [[approvedItem({ curatedSnapshot: { schemaVersion: 1 } })]],
    });
    mocks.getDb.mockReturnValue(db);

    const response = await POST(request(publishBody()));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringMatching(/Unpublish/) });
    expect(db.update).not.toHaveBeenCalled();
  });

  it("atomically clears every curation field and treats repeated unpublish as success", async () => {
    const published = approvedItem({ curatedSnapshot: { broken: true }, curatedBy: AUTHOR_NAME });
    const { db, updateSets } = fakeDb({
      selectRows: [[published]],
      updateRows: [[{ id: 17 }]],
    });
    mocks.getDb.mockReturnValue(db);

    const response = await POST(request(unpublishBody(published)));
    expect(response.status).toBe(200);
    expect(updateSets[0]).toEqual({ curatedSnapshot: null, curatedAt: null, curatedBy: null });

    const clear = fakeDb({ selectRows: [[approvedItem()]] });
    mocks.getDb.mockReturnValue(clear.db);
    const repeated = await POST(request(unpublishBody(published)));
    expect(repeated.status).toBe(200);
    await expect(repeated.json()).resolves.toMatchObject({ idempotent: true });
    expect(clear.db.update).not.toHaveBeenCalled();
  });

  it("does not let a stale removal delete a newer curated revision", async () => {
    const reviewed = approvedItem({
      curatedSnapshot: { schemaVersion: 1, title: "Reviewed revision one" },
      curatedAt: new Date("2026-08-25T12:00:00.000Z"),
      curatedBy: AUTHOR_NAME,
    });
    const newer = approvedItem({
      curatedSnapshot: { schemaVersion: 1, title: "Reviewed revision two" },
      curatedAt: new Date("2026-08-25T13:00:00.000Z"),
      curatedBy: AUTHOR_NAME,
    });
    const { db } = fakeDb({ selectRows: [[newer]] });
    mocks.getDb.mockReturnValue(db);

    const response = await POST(request(unpublishBody(reviewed)));

    expect(response.status).toBe(409);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("fails validation when copied database facts cannot form a safe snapshot", async () => {
    const invalidItem = approvedItem({ sourceWeight: -1 });
    const { db } = fakeDb({ selectRows: [[invalidItem]] });
    mocks.getDb.mockReturnValue(db);

    const response = await POST(
      request(
        publishBody({ expectedSourceVersion: curatedAiSourceVersion(invalidItem) }),
      ),
    );

    expect(response.status).toBe(400);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("rejects a stale review when any source or review input changed", async () => {
    const loaded = approvedItem();
    const changed = approvedItem({
      title: "Raw title changed after the human opened the form",
    });
    const { db } = fakeDb({ selectRows: [[changed]] });
    mocks.getDb.mockReturnValue(db);

    const response = await POST(
      request(
        publishBody({ expectedSourceVersion: curatedAiSourceVersion(loaded) }),
      ),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringMatching(/changed after this review form loaded/i),
    });
    expect(db.update).not.toHaveBeenCalled();
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
  });

  it("returns a conflict if the atomic publish claim loses a race", async () => {
    const { db } = fakeDb({ selectRows: [[approvedItem()]], updateRows: [[]] });
    mocks.getDb.mockReturnValue(db);

    const response = await POST(request(publishBody()));

    expect(response.status).toBe(409);
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
  });

  it("keeps every reviewed source field inside the atomic publication predicate", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile("app/api/admin/curated-ai/route.ts", "utf8"),
    );
    const start = source.indexOf("const curatedAt");
    const atomicWhere = source.slice(start, source.indexOf("if (!updated)", start));

    for (const field of [
      "items.type",
      "items.title",
      "items.url",
      "items.summary",
      "items.aiNote",
      "items.source",
      "items.sourceSlug",
      "items.sourceWeight",
      "items.author",
      "items.publishedAt",
      "items.firstSeen",
    ]) {
      expect(atomicWhere, field).toContain(field);
    }
  });
});
