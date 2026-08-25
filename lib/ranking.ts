/**
 * Hacker News ranking, from Paul Graham's news.arc:
 *
 *   score = (points - 1) / (age_hours + 2) ^ gravity     // gravity defaults to 1.8
 *
 * Engineerious launches without voting, so `sourceWeight` stands in for points: a
 * release straight from the Anthropic blog outranks an aggregator rewrite of it even
 * when both have zero votes. If/when upvotes ship, `points` starts moving and the
 * formula does not have to change.
 */

export const GRAVITY = 1.8;
export const POINTS_OFFSET = 1;
export const AGE_OFFSET_HOURS = 2;

export type RankInput = {
  points: number;
  sourceWeight: number;
  /** Prefer the source's own publish time; fall back to when we first saw it. */
  publishedAt: Date | null;
  firstSeen: Date;
};

export function ageHours(input: Pick<RankInput, "publishedAt" | "firstSeen">, now = new Date()) {
  const t = (input.publishedAt ?? input.firstSeen).getTime();
  // Feeds occasionally publish a future timestamp; clamp so it cannot outrank everything.
  return Math.max(0, (now.getTime() - t) / 3_600_000);
}

export function computeScore(input: RankInput, now = new Date()): number {
  const effectivePoints = input.points - POINTS_OFFSET + input.sourceWeight;
  const decay = Math.pow(ageHours(input, now) + AGE_OFFSET_HOURS, GRAVITY);
  return effectivePoints / decay;
}
