import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  upsertContact: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ getDb: mocks.getDb }));
vi.mock("@/lib/resend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/resend")>();
  return { ...actual, upsertContact: mocks.upsertContact };
});

import {
  captureAndSyncSubscriber,
  retrySubscriberSync,
} from "@/lib/subscriber-delivery";
import { subscribers } from "@/db/schema";

type SubscriberRow = {
  id: number;
  email: string;
  resendContactId: string | null;
  unsubscribedAt: Date | null;
};

function subscriber(overrides: Partial<SubscriberRow> = {}): SubscriberRow {
  return {
    id: 41,
    email: "reader@example.com",
    resendContactId: null,
    unsubscribedAt: null,
    ...overrides,
  };
}

function thenableRows(rows: unknown[]) {
  const promise = Promise.resolve(rows);
  return {
    returning: vi.fn(async () => rows),
    then: promise.then.bind(promise),
  };
}

function fakeDb(input: {
  captured?: SubscriberRow;
  selected?: SubscriberRow[];
  updateRows?: unknown[][];
  events?: string[];
}) {
  const events = input.events ?? [];
  const updates = [...(input.updateRows ?? [])];
  const updateSets: Array<Record<string, unknown>> = [];
  const conflictTargets: unknown[] = [];
  const conflictSets: Array<Record<string, unknown>> = [];
  const db = {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoUpdate: vi.fn((config: { target: unknown; set: Record<string, unknown> }) => {
          conflictTargets.push(config.target);
          conflictSets.push(config.set);
          return {
            returning: vi.fn(async () => {
              events.push("captured");
              return input.captured ? [input.captured] : [];
            }),
          };
        }),
      })),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => input.selected ?? []),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((value: Record<string, unknown>) => {
        updateSets.push(value);
        return {
          where: vi.fn(() => thenableRows(updates.shift() ?? [])),
        };
      }),
    })),
  };
  return { db, events, updateSets, conflictTargets, conflictSets };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.upsertContact.mockResolvedValue("contact_41");
});

describe("subscriber delivery ledger", () => {
  it("captures before provider work and records contact readiness", async () => {
    const events: string[] = [];
    const { db, updateSets, conflictTargets, conflictSets } = fakeDb({
      captured: subscriber(),
      updateRows: [[{ id: 41 }]],
      events,
    });
    mocks.getDb.mockReturnValue(db);
    mocks.upsertContact.mockImplementation(async () => {
      events.push("contact");
      return "contact_41";
    });

    const result = await captureAndSyncSubscriber("reader@example.com");

    expect(events).toEqual(["captured", "contact"]);
    expect(result).toEqual({ outcome: "ready" });
    expect(conflictTargets).toEqual([subscribers.email]);
    expect(conflictSets).toEqual([{ email: "reader@example.com" }]);
    expect(conflictSets[0]).not.toHaveProperty("unsubscribedAt");
    expect(updateSets[0]).toMatchObject({
      resendContactId: "contact_41",
      resendSyncAttemptedAt: expect.any(Date),
      resendSyncError: null,
    });
  });

  it("keeps a captured address pending when contact sync fails", async () => {
    const { db, updateSets } = fakeDb({ captured: subscriber() });
    mocks.getDb.mockReturnValue(db);
    mocks.upsertContact.mockRejectedValue(new Error("provider unavailable"));

    const result = await captureAndSyncSubscriber("reader@example.com");

    expect(result).toMatchObject({ outcome: "pending", error: "provider unavailable" });
    expect(updateSets[0]).toMatchObject({
      resendSyncAttemptedAt: expect.any(Date),
      resendSyncError: "provider unavailable",
    });
  });

  it("does not call the provider for an unauthenticated duplicate with a historical contact ID", async () => {
    const { db, updateSets } = fakeDb({
      captured: subscriber({ resendContactId: "historical_contact_41" }),
    });
    mocks.getDb.mockReturnValue(db);

    const result = await captureAndSyncSubscriber("reader@example.com");

    expect(result).toEqual({ outcome: "ready" });
    expect(mocks.upsertContact).not.toHaveBeenCalled();
    expect(updateSets).toHaveLength(0);
  });

  it("preserves a locally inactive record without provider work", async () => {
    const { db } = fakeDb({
      captured: subscriber({ unsubscribedAt: new Date("2026-08-25T12:00:00.000Z") }),
    });
    mocks.getDb.mockReturnValue(db);

    const result = await captureAndSyncSubscriber("reader@example.com");

    expect(result).toEqual({ outcome: "inactive" });
    expect(mocks.upsertContact).not.toHaveBeenCalled();
  });

  it("never reactivates an already-synced contact from the admin repair path", async () => {
    const { db } = fakeDb({
      selected: [subscriber({ resendContactId: "contact_41" })],
    });
    mocks.getDb.mockReturnValue(db);

    const result = await retrySubscriberSync(41);

    expect(result).toEqual({ outcome: "ready" });
    expect(mocks.upsertContact).not.toHaveBeenCalled();
  });
});
