import { beforeEach, describe, expect, it, vi } from "vitest";

import { factualContentHash, myTakeContentHash } from "@/lib/daily-brief";
import { prepareNewsletterArtifact } from "@/lib/newsletter";
import { makeDailyBrief } from "@/tests/daily-fixtures";

const mocks = vi.hoisted(() => ({
  authorizeAdmin: vi.fn(),
  getDb: vi.fn(),
  countUnsynced: vi.fn(),
  createBroadcastDraft: vi.fn(),
  getBroadcast: vi.fn(),
  sendBroadcast: vi.fn(),
  newsletterDeliveryConfigured: vi.fn(),
  chronology: [] as string[],
}));

vi.mock("@/lib/env", () => ({
  env: {
    databaseUrl: "postgres://test",
    adminPassword: "test",
    siteUrl: "https://engineerious.com",
    newsletterPostalAddress: "PO Box 1, Austin, TX",
    resendApiKey: "re_test",
    resendSegmentId: "seg_test",
    resendFromAddress: "Engineerious <digest@engineerious.com>",
  },
}));
vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return { ...actual, authorizeAdmin: mocks.authorizeAdmin };
});
vi.mock("@/lib/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db")>();
  return { ...actual, getDb: mocks.getDb };
});
vi.mock("@/lib/subscriber-queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/subscriber-queries")>();
  return { ...actual, countActiveUnsyncedSubscribers: mocks.countUnsynced };
});
vi.mock("@/lib/resend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/resend")>();
  return {
    ...actual,
    createBroadcastDraft: mocks.createBroadcastDraft,
    getBroadcast: mocks.getBroadcast,
    sendBroadcast: mocks.sendBroadcast,
    newsletterDeliveryConfigured: mocks.newsletterDeliveryConfigured,
  };
});

import { POST } from "@/app/api/admin/newsletters/route";
import { ResendRequestError } from "@/lib/resend";

function digestRow(overrides: Record<string, unknown> = {}) {
  const brief = makeDailyBrief();
  const artifact = prepareNewsletterArtifact({
    brief,
    siteUrl: "https://engineerious.com",
    postalAddress: "PO Box 1, Austin, TX",
    subject: "Engineerious Daily · reviewed",
  });
  return {
    id: 7,
    date: brief.date,
    status: "published",
    dailyPublished: brief,
    publishedAt: new Date("2026-08-25T16:00:00.000Z"),
    reviewedContentHash: factualContentHash(brief),
    reviewedAt: new Date("2026-08-25T15:00:00.000Z"),
    reviewedBy: "Tharun Chowdary Malepati",
    myTakeConfirmedHash: myTakeContentHash(brief.myTake),
    myTakeConfirmedAt: new Date("2026-08-25T15:30:00.000Z"),
    myTakeConfirmedBy: "Tharun Chowdary Malepati",
    newsletterStatus: "approved",
    newsletterSubject: artifact.subject,
    newsletterVersion: 4,
    newsletterApprovedHash: artifact.approvalHash,
    newsletterApprovedAt: new Date("2026-08-25T17:00:00.000Z"),
    newsletterApprovedBy: "Tharun Chowdary Malepati",
    newsletterBroadcastId: null,
    newsletterClaimedAt: null,
    newsletterError: null,
    emailHtml: artifact.html,
    emailSentAt: null,
    ...overrides,
  };
}

function fakeDb(input: {
  selectRows: unknown[][];
  updateRows?: unknown[][];
  executeRows?: unknown[];
}) {
  const selects = [...input.selectRows];
  const updates = [...(input.updateRows ?? [])];
  const updateSets: Array<Record<string, unknown>> = [];
  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => selects.shift() ?? []),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((set: Record<string, unknown>) => {
        updateSets.push(set);
        return {
          where: vi.fn(() => ({
            returning: vi.fn(async () => {
              if (set.newsletterBroadcastId) mocks.chronology.push("persist-provider-id");
              if (set.newsletterStatus === "queued") mocks.chronology.push("settle-queued");
              return updates.shift() ?? [];
            }),
          })),
        };
      }),
    })),
    execute: vi.fn(async () => input.executeRows ?? []),
  };
  return { db, updateSets };
}

function request(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/admin/newsletters", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Basic test", ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.chronology.length = 0;
  mocks.authorizeAdmin.mockReturnValue(true);
  mocks.countUnsynced.mockResolvedValue(0);
  mocks.newsletterDeliveryConfigured.mockReturnValue(true);
});

describe("newsletter admin policy", () => {
  it("authenticates before parsing or reading the database", async () => {
    mocks.authorizeAdmin.mockReturnValue(false);
    const response = await POST(request({ malformed: true }));
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain("Engineerious admin");
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("rejects simple cross-site and non-JSON requests before parsing or database work", async () => {
    const wrongType = await POST(
      request({ id: 7, action: "send", expectedVersion: 4 }, { "content-type": "text/plain" }),
    );
    expect(wrongType.status).toBe(415);

    const crossSite = await POST(
      request(
        { id: 7, action: "send", expectedVersion: 4 },
        { "sec-fetch-site": "cross-site" },
      ),
    );
    expect(crossSite.status).toBe(403);

    const foreignOrigin = await POST(
      request(
        { id: 7, action: "send", expectedVersion: 4 },
        { origin: "https://attacker.example" },
      ),
    );
    expect(foreignOrigin.status).toBe(403);
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("accepts only a subject edit and never client-supplied HTML", async () => {
    const response = await POST(
      request({ id: 7, action: "save", expectedVersion: 4, subject: "Safe", html: "<script>" }),
    );
    expect(response.status).toBe(400);
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("refuses preparation when the public snapshot no longer matches review checkpoints", async () => {
    const row = digestRow({
      newsletterStatus: null,
      newsletterSubject: null,
      newsletterApprovedHash: null,
      emailHtml: null,
      newsletterVersion: 0,
      reviewedContentHash: "tampered",
    });
    const { db } = fakeDb({ selectRows: [[row]] });
    mocks.getDb.mockReturnValue(db);

    const response = await POST(request({ id: 7, action: "prepare", expectedVersion: 0 }));

    expect(response.status).toBe(409);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("refuses to prepare an unpublished Daily draft", async () => {
    const row = digestRow({
      status: "pending_review",
      publishedAt: null,
      newsletterStatus: null,
      newsletterSubject: null,
      newsletterApprovedHash: null,
      emailHtml: null,
      newsletterVersion: 0,
    });
    const { db } = fakeDb({ selectRows: [[row]] });
    mocks.getDb.mockReturnValue(db);

    const response = await POST(request({ id: 7, action: "prepare", expectedVersion: 0 }));

    expect(response.status).toBe(409);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("regenerates server-owned HTML and invalidates every approval field on save", async () => {
    const row = digestRow({ newsletterStatus: "draft" });
    const { db, updateSets } = fakeDb({
      selectRows: [[row]],
      updateRows: [[{ newsletterVersion: 5 }]],
    });
    mocks.getDb.mockReturnValue(db);

    const response = await POST(
      request({ id: 7, action: "save", expectedVersion: 4, subject: "A revised subject" }),
    );

    expect(response.status).toBe(200);
    expect(updateSets[0]).toMatchObject({
      newsletterSubject: "A revised subject",
      emailHtml: expect.stringContaining("Engineerious Daily"),
      newsletterApprovedHash: null,
      newsletterApprovedAt: null,
      newsletterApprovedBy: null,
      newsletterError: null,
    });
  });

  it("blocks send before the claim while any active subscriber is unsynced", async () => {
    const { db } = fakeDb({ selectRows: [[digestRow()]] });
    mocks.getDb.mockReturnValue(db);
    mocks.countUnsynced.mockResolvedValue(2);

    const response = await POST(request({ id: 7, action: "send", expectedVersion: 4 }));

    expect(response.status).toBe(409);
    expect(db.execute).not.toHaveBeenCalled();
    expect(mocks.createBroadcastDraft).not.toHaveBeenCalled();
  });

  it("fails configuration preflight before claiming an approved send", async () => {
    const { db } = fakeDb({ selectRows: [[digestRow()]] });
    mocks.getDb.mockReturnValue(db);
    mocks.newsletterDeliveryConfigured.mockReturnValue(false);

    const response = await POST(request({ id: 7, action: "send", expectedVersion: 4 }));

    expect(response.status).toBe(503);
    expect(db.execute).not.toHaveBeenCalled();
    expect(mocks.countUnsynced).not.toHaveBeenCalled();
    expect(mocks.createBroadcastDraft).not.toHaveBeenCalled();
  });

  it("never repeats a send for an outbox already in sending state", async () => {
    const { db } = fakeDb({ selectRows: [[digestRow({ newsletterStatus: "sending", newsletterVersion: 5 })]] });
    mocks.getDb.mockReturnValue(db);

    const response = await POST(request({ id: 7, action: "send", expectedVersion: 5 }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringMatching(/Reconcile/) });
    expect(mocks.createBroadcastDraft).not.toHaveBeenCalled();
    expect(mocks.sendBroadcast).not.toHaveBeenCalled();
  });

  it("persists a provider draft ID before reading and sending that exact draft", async () => {
    const artifact = digestRow();
    const claim = {
      id: 7,
      newsletterSubject: artifact.newsletterSubject,
      emailHtml: artifact.emailHtml,
      newsletterApprovedHash: artifact.newsletterApprovedHash,
      newsletterBroadcastId: null,
      newsletterVersion: 5,
    };
    const { db } = fakeDb({
      selectRows: [[artifact]],
      executeRows: [claim],
      updateRows: [[{ id: 7 }], [{ newsletterVersion: 6 }]],
    });
    mocks.getDb.mockReturnValue(db);
    mocks.createBroadcastDraft.mockImplementation(async () => {
      mocks.chronology.push("create-draft");
      return { id: "br_123" };
    });
    mocks.getBroadcast.mockImplementation(async () => {
      mocks.chronology.push("read-provider-draft");
      return { id: "br_123", status: "draft" };
    });
    mocks.sendBroadcast.mockImplementation(async () => {
      mocks.chronology.push("send-provider-draft");
      return { id: "br_123" };
    });

    const response = await POST(request({ id: 7, action: "send", expectedVersion: 4 }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "queued",
      newsletterVersion: 6,
      broadcastId: "br_123",
    });
    expect(mocks.chronology).toEqual([
      "create-draft",
      "persist-provider-id",
      "read-provider-draft",
      "send-provider-draft",
      "settle-queued",
    ]);
  });

  it("validates the raw send claim and restores approval before any provider request", async () => {
    const row = digestRow();
    const { db, updateSets } = fakeDb({
      selectRows: [[row]],
      executeRows: [{
        id: 7,
        newsletter_subject: row.newsletterSubject,
        email_html: row.emailHtml,
        newsletter_approved_hash: row.newsletterApprovedHash,
        newsletter_broadcast_id: null,
        newsletter_version: 5,
      }],
    });
    mocks.getDb.mockReturnValue(db);

    const response = await POST(request({ id: 7, action: "send", expectedVersion: 4 }));

    expect(response.status).toBe(500);
    expect(updateSets.at(-1)).toMatchObject({
      newsletterStatus: "approved",
      newsletterClaimedAt: null,
      newsletterError: expect.stringContaining("invalid newsletter send claim"),
    });
    expect(mocks.createBroadcastDraft).not.toHaveBeenCalled();
    expect(mocks.sendBroadcast).not.toHaveBeenCalled();
  });

  it("leaves an ambiguous create response in sending and never attempts a send", async () => {
    const row = digestRow();
    const claim = {
      id: 7,
      newsletterSubject: row.newsletterSubject,
      emailHtml: row.emailHtml,
      newsletterApprovedHash: row.newsletterApprovedHash,
      newsletterBroadcastId: null,
      newsletterVersion: 5,
    };
    const { db, updateSets } = fakeDb({ selectRows: [[row]], executeRows: [claim] });
    mocks.getDb.mockReturnValue(db);
    mocks.createBroadcastDraft.mockRejectedValue(
      new ResendRequestError("connection ended", { ambiguous: true }),
    );

    const response = await POST(request({ id: 7, action: "send", expectedVersion: 4 }));

    expect(response.status).toBe(502);
    expect(updateSets.at(-1)).toMatchObject({ newsletterError: expect.stringContaining("connection ended") });
    expect(mocks.getBroadcast).not.toHaveBeenCalled();
    expect(mocks.sendBroadcast).not.toHaveBeenCalled();
  });

  it("keeps an ambiguous send in sending and a second click cannot claim or send again", async () => {
    const row = digestRow();
    const claim = {
      id: 7,
      newsletterSubject: row.newsletterSubject,
      emailHtml: row.emailHtml,
      newsletterApprovedHash: row.newsletterApprovedHash,
      newsletterBroadcastId: null,
      newsletterVersion: 5,
    };
    const firstDb = fakeDb({
      selectRows: [[row]],
      executeRows: [claim],
      updateRows: [[{ id: 7 }]],
    });
    mocks.getDb.mockReturnValue(firstDb.db);
    mocks.createBroadcastDraft.mockResolvedValue({ id: "br_123" });
    mocks.getBroadcast.mockResolvedValue({ id: "br_123", status: "draft" });
    mocks.sendBroadcast.mockRejectedValue(
      new ResendRequestError("gateway timed out", { status: 504, ambiguous: true }),
    );

    const first = await POST(request({ id: 7, action: "send", expectedVersion: 4 }));
    expect(first.status).toBe(502);
    expect(mocks.sendBroadcast).toHaveBeenCalledTimes(1);
    expect(firstDb.updateSets.at(-1)).toMatchObject({
      newsletterError: expect.stringContaining("gateway timed out"),
    });

    const secondDb = fakeDb({
      selectRows: [[
        digestRow({
          newsletterStatus: "sending",
          newsletterVersion: 5,
          newsletterBroadcastId: "br_123",
        }),
      ]],
    });
    mocks.getDb.mockReturnValue(secondDb.db);
    const second = await POST(request({ id: 7, action: "send", expectedVersion: 5 }));

    expect(second.status).toBe(409);
    expect(secondDb.db.execute).not.toHaveBeenCalled();
    expect(mocks.sendBroadcast).toHaveBeenCalledTimes(1);
  });

  it("reconciles a provider draft back to approved without calling send", async () => {
    const row = digestRow({
      newsletterStatus: "sending",
      newsletterVersion: 5,
      newsletterBroadcastId: "br_123",
    });
    const { db } = fakeDb({ selectRows: [[row]], updateRows: [[{ newsletterVersion: 6 }]] });
    mocks.getDb.mockReturnValue(db);
    mocks.getBroadcast.mockResolvedValue({ id: "br_123", status: "draft" });

    const response = await POST(request({ id: 7, action: "reconcile", expectedVersion: 5 }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: "approved", newsletterVersion: 6 });
    expect(mocks.sendBroadcast).not.toHaveBeenCalled();
  });

  it.each([
    ["queued", "queued"],
    ["sent", "sent"],
  ] as const)("reconciles provider %s into the terminal outbox state", async (providerStatus, expectedStatus) => {
    const row = digestRow({
      newsletterStatus: "sending",
      newsletterVersion: 5,
      newsletterBroadcastId: "br_123",
    });
    const { db, updateSets } = fakeDb({
      selectRows: [[row]],
      updateRows: [[{ newsletterVersion: 6 }]],
    });
    mocks.getDb.mockReturnValue(db);
    mocks.getBroadcast.mockResolvedValue({ id: "br_123", status: providerStatus });

    const response = await POST(request({ id: 7, action: "reconcile", expectedVersion: 5 }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: expectedStatus });
    expect(updateSets[0]).toMatchObject({ newsletterStatus: expectedStatus });
    if (expectedStatus === "sent") expect(updateSets[0].emailSentAt).toBeInstanceOf(Date);
    expect(mocks.sendBroadcast).not.toHaveBeenCalled();
  });
});
