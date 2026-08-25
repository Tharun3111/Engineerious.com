import { describe, expect, it } from "vitest";

import {
  AGE_OFFSET_HOURS,
  ageHours,
  computeScore,
  GRAVITY,
  POINTS_OFFSET,
} from "@/lib/ranking";

describe("HN-inspired ranking", () => {
  const now = new Date("2026-08-25T12:00:00Z");

  it("uses the documented source-weighted formula", () => {
    const input = {
      points: 8,
      sourceWeight: 5,
      publishedAt: new Date("2026-08-25T06:00:00Z"),
      firstSeen: now,
    };
    const expected =
      (input.points - POINTS_OFFSET + input.sourceWeight) /
      Math.pow(6 + AGE_OFFSET_HOURS, GRAVITY);

    expect(computeScore(input, now)).toBeCloseTo(expected, 12);
  });

  it("falls back to first-seen time and clamps future timestamps", () => {
    expect(
      ageHours(
        { publishedAt: null, firstSeen: new Date("2026-08-25T10:00:00Z") },
        now,
      ),
    ).toBe(2);
    expect(
      ageHours(
        {
          publishedAt: new Date("2026-08-26T00:00:00Z"),
          firstSeen: new Date("2026-08-25T10:00:00Z"),
        },
        now,
      ),
    ).toBe(0);
  });

  it("lets primary-source authority break a zero-vote tie", () => {
    const base = { points: 0, publishedAt: now, firstSeen: now };
    expect(computeScore({ ...base, sourceWeight: 5 }, now)).toBeGreaterThan(
      computeScore({ ...base, sourceWeight: 1 }, now),
    );
  });
});
