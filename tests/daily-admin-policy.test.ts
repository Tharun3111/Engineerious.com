import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  factualContentHash,
  myTakeContentHash,
  type DailyBriefDraft,
} from "@/lib/daily-brief";

const mocks = vi.hoisted(() => ({
  authorizeAdmin: vi.fn(),
  getDb: vi.fn(),
  reviewDailyBrief: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  submitUrls: vi.fn(),
}));

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return { ...actual, authorizeAdmin: mocks.authorizeAdmin };
});
vi.mock("@/lib/db", () => ({ getDb: mocks.getDb }));
vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
  revalidateTag: mocks.revalidateTag,
}));
vi.mock("@/lib/indexnow", () => ({ submitUrls: mocks.submitUrls }));
vi.mock("@/lib/review", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/review")>();
  return { ...actual, reviewDailyBrief: mocks.reviewDailyBrief };
});

import { POST } from "@/app/api/admin/digests/route";

const cleanReview = {
  groundingViolations: [],
  voiceViolations: [],
  overallVerdict: "Ready for human review",
  readsAsGenericAiContent: false,
};

const finding = {
  title: "A primary release",
  summary: "The source describes a release.",
  sourceUrls: ["https://openai.com/index/release"],
  category: "model_release" as const,
  novelty: "high" as const,
  relevantPillar: null,
};

function dailyDraft(overrides: Partial<DailyBriefDraft> = {}): DailyBriefDraft {
  return {
    schemaVersion: 1,
    date: "2026-08-25",
    title: "AI Daily Brief — August 25",
    summary: "The engineering details worth knowing today.",
    stories: [
      {
        id: "story-1",
        category: "models",
        sourceLabel: "OpenAI",
        headline: "A primary release",
        whatHappened: "OpenAI published a release.",
        whyItMatters: "The release changes an API capability.",
        forEngineers: "Read the migration notes before updating.",
        sourceUrls: [finding.sourceUrls[0]],
      },
    ],
    oneThingToLearn: null,
    modelToKnow: null,
    toolOfTheDay: null,
    paperWorthKnowing: null,
    myTake: "The migration details matter more than the announcement.",
    ...overrides,
  };
}

function digestRow(draft = dailyDraft()) {
  return {
    id: 7,
    date: draft.date,
    status: "pending_review" as const,
    blogPostSlug: null,
    emailHtml: null,
    stockSummary: null,
    reviewReport: cleanReview,
    dailyDraft: draft,
    dailyPublished: null,
    draftVersion: 2,
    reviewedContentHash: factualContentHash(draft),
    myTakeConfirmedHash: myTakeContentHash(draft.myTake),
    myTakeConfirmedAt: new Date("2026-08-25T13:00:00Z"),
    myTakeConfirmedBy: "Tharun Chowdary Malepati",
    reviewedBy: "Tharun Chowdary Malepati",
    reviewedAt: new Date("2026-08-25T12:00:00Z"),
    publishedAt: null,
    emailSentAt: null,
    error: null,
    createdAt: new Date("2026-08-25T10:00:00Z"),
    updatedAt: new Date("2026-08-25T13:00:00Z"),
  };
}

function fakeDb(input: {
  selects: unknown[][];
  updates?: unknown[][];
  execute?: unknown;
}) {
  const selectQueue = [...input.selects];
  const updateQueue = [...(input.updates ?? [])];
  const updateSets: Array<Record<string, unknown>> = [];
  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => selectQueue.shift() ?? []),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((value: Record<string, unknown>) => {
        updateSets.push(value);
        return {
          where: vi.fn(() => ({
            returning: vi.fn(async () => updateQueue.shift() ?? []),
          })),
        };
      }),
    })),
    execute: vi.fn(async () => input.execute ?? []),
  };
  return { db, updateSets };
}

function request(body: unknown): Request {
  return new Request("http://localhost/api/admin/digests", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Basic test" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authorizeAdmin.mockReturnValue(true);
  mocks.submitUrls.mockResolvedValue(undefined);
});

describe("Daily admin lifecycle", () => {
  it("authenticates at the route before parsing or database work", async () => {
    mocks.authorizeAdmin.mockReturnValue(false);

    const response = await POST(request({ id: 7, action: "reject" }));

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain("Engineerious admin");
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("invalidates factual review and My Take confirmation after a factual edit", async () => {
    const current = dailyDraft();
    const next = dailyDraft({ title: "AI Daily Brief — the reviewed edit" });
    const { db, updateSets } = fakeDb({
      selects: [[digestRow(current)], [{ findings: [finding] }]],
      updates: [[{ draftVersion: 3 }]],
    });
    mocks.getDb.mockReturnValue(db);

    const response = await POST(
      request({ id: 7, action: "save", expectedVersion: 2, draft: next }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      draftVersion: 3,
      reviewCurrent: false,
      myTakeConfirmed: false,
      factualReviewInvalidated: true,
    });
    expect(updateSets[0]).toMatchObject({
      reviewReport: null,
      reviewedContentHash: null,
      myTakeConfirmedHash: null,
      myTakeConfirmedAt: null,
      myTakeConfirmedBy: null,
    });
  });

  it("preserves factual review but invalidates confirmation after a My Take-only edit", async () => {
    const current = dailyDraft();
    const next = dailyDraft({ myTake: "I care most about the API migration path." });
    const { db, updateSets } = fakeDb({
      selects: [[digestRow(current)], [{ findings: [finding] }]],
      updates: [[{ draftVersion: 3 }]],
    });
    mocks.getDb.mockReturnValue(db);

    const response = await POST(
      request({ id: 7, action: "save", expectedVersion: 2, draft: next }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      reviewCurrent: true,
      myTakeConfirmed: false,
      factualReviewInvalidated: false,
    });
    expect(updateSets[0]).not.toHaveProperty("reviewReport");
    expect(updateSets[0]).not.toHaveProperty("reviewedContentHash");
    expect(updateSets[0]).toMatchObject({
      myTakeConfirmedHash: null,
      myTakeConfirmedAt: null,
      myTakeConfirmedBy: null,
    });
  });

  it("returns a stale-version conflict before editing", async () => {
    const row = { ...digestRow(), draftVersion: 4 };
    const { db } = fakeDb({ selects: [[row]] });
    mocks.getDb.mockReturnValue(db);

    const response = await POST(
      request({ id: 7, action: "save", expectedVersion: 2, draft: dailyDraft() }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ currentVersion: 4 });
    expect(db.update).not.toHaveBeenCalled();
  });

  it("rejects an editor-supplied URL outside the exact finding allowlist", async () => {
    const next = dailyDraft({
      stories: [
        {
          ...dailyDraft().stories[0],
          sourceUrls: ["https://example.com/invented"],
        },
      ],
    });
    const { db } = fakeDb({
      selects: [[digestRow()], [{ findings: [finding] }]],
    });
    mocks.getDb.mockReturnValue(db);

    const response = await POST(
      request({ id: 7, action: "save", expectedVersion: 2, draft: next }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringMatching(/not gathered/),
    });
    expect(db.update).not.toHaveBeenCalled();
  });

  it("requires nonempty human text before confirming My Take", async () => {
    const draft = dailyDraft({ myTake: "   " });
    const { db } = fakeDb({ selects: [[digestRow(draft)]] });
    mocks.getDb.mockReturnValue(db);

    const response = await POST(
      request({ id: 7, action: "confirm_take", expectedVersion: 2 }),
    );

    expect(response.status).toBe(400);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("reruns the fabricated-experience guard at publication time", async () => {
    const unsafe = dailyDraft({
      stories: [
        {
          ...dailyDraft().stories[0],
          whatHappened: "I tested the release in production.",
        },
      ],
    });
    const row = {
      ...digestRow(unsafe),
      reviewedContentHash: factualContentHash(unsafe),
      myTakeConfirmedHash: myTakeContentHash(unsafe.myTake),
    };
    const { db } = fakeDb({ selects: [[row], [{ findings: [finding] }]] });
    mocks.getDb.mockReturnValue(db);

    const response = await POST(
      request({ id: 7, action: "publish", expectedVersion: 2 }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringMatching(/first-hand work/),
    });
    expect(db.execute).not.toHaveBeenCalled();
  });

  it("publishes only the reviewed snapshot and never sends email", async () => {
    const draft = dailyDraft();
    const { db } = fakeDb({
      selects: [[digestRow(draft)], [{ findings: [finding] }]],
      execute: [{ id: 7, date: draft.date, draft_version: 2, daily_published: draft }],
    });
    mocks.getDb.mockReturnValue(db);

    const response = await POST(
      request({ id: 7, action: "publish", expectedVersion: 2 }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "published",
      emailSent: false,
    });
    expect(db.execute).toHaveBeenCalledOnce();
    expect(mocks.submitUrls).toHaveBeenCalledOnce();
  });

  it("recovers a lost publish response without replacing or resending the snapshot", async () => {
    const draft = dailyDraft();
    const published = {
      ...digestRow(draft),
      status: "published" as const,
      dailyPublished: draft,
      publishedAt: new Date("2026-08-25T14:00:00Z"),
    };
    const { db } = fakeDb({
      selects: [
        [published],
        [{ findings: [finding] }],
        [
          {
            status: published.status,
            draftVersion: published.draftVersion,
            dailyPublished: published.dailyPublished,
            reviewedContentHash: published.reviewedContentHash,
            myTakeConfirmedHash: published.myTakeConfirmedHash,
          },
        ],
      ],
      execute: [],
    });
    mocks.getDb.mockReturnValue(db);

    const response = await POST(
      request({ id: 7, action: "publish", expectedVersion: 2 }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "published",
      idempotent: true,
      emailSent: false,
    });
    expect(db.execute).toHaveBeenCalledOnce();
    expect(mocks.submitUrls).toHaveBeenCalledOnce();
  });

  it("treats a repeated rejection as an idempotent success", async () => {
    const { db } = fakeDb({
      selects: [[{ ...digestRow(), status: "rejected" }]],
    });
    mocks.getDb.mockReturnValue(db);

    const response = await POST(request({ id: 7, action: "reject", expectedVersion: 2 }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "rejected",
      idempotent: true,
    });
    expect(db.update).not.toHaveBeenCalled();
  });
});
