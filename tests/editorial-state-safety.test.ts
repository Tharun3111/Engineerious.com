import { describe, expect, it } from "vitest";

import {
  assertUrlsAllowed,
  deriveSourceStatus,
  extractQueryRows,
  isDigestPublishable,
  isDigestWriteRetryable,
} from "@/lib/editorial-safety";
import { reviewBlockingIssues } from "@/lib/review";

describe("editorial state safety", () => {
  it("keeps a human rejection terminal", () => {
    expect(isDigestWriteRetryable("failed")).toBe(true);
    expect(isDigestWriteRetryable("generating")).toBe(true);
    expect(isDigestWriteRetryable("rejected")).toBe(false);
    expect(isDigestPublishable("rejected")).toBe(false);
  });

  it("allows pending review and legacy approved rows through the recoverable web publish path", () => {
    expect(isDigestPublishable("pending_review")).toBe(true);
    expect(isDigestPublishable("approved")).toBe(true);
    expect(isDigestPublishable("published")).toBe(false);
  });

  it("rejects generated URLs that were not gathered", () => {
    expect(() =>
      assertUrlsAllowed(
        ["https://openai.com/index/real", "https://example.com/invented"],
        ["https://openai.com/index/real"],
        "research findings",
      ),
    ).toThrow(/example\.com\/invented/);
  });

  it("accepts only exact gathered URL values", () => {
    expect(() =>
      assertUrlsAllowed(
        ["https://openai.com/index/real"],
        ["https://openai.com/index/real"],
        "research findings",
      ),
    ).not.toThrow();
    expect(() =>
      assertUrlsAllowed(
        ["https://openai.com/index/real?invented=1"],
        ["https://openai.com/index/real"],
        "research findings",
      ),
    ).toThrow();
  });

  it("rejects non-HTTP schemes even when they appear in the gathered allowlist", () => {
    for (const unsafe of [
      "javascript:alert(1)",
      "data:text/html,unsafe",
      "mailto:editor@example.com",
      "ftp://example.com/file",
    ]) {
      expect(() => assertUrlsAllowed([unsafe], [unsafe], "research findings")).toThrow(
        /non-HTTP URL/,
      );
    }
  });

  it("derives conservative source status from source URLs", () => {
    expect(
      deriveSourceStatus([
        "https://openai.com/index/new-model",
        "https://github.com/openai/openai-python/releases/tag/v2",
      ]),
    ).toBe("primary");
    expect(deriveSourceStatus(["https://www.theverge.com/ai/example"])).toBe("secondary");
    expect(
      deriveSourceStatus([
        "https://arxiv.org/abs/2608.12345",
        "https://www.theverge.com/ai/example",
      ]),
    ).toBe("mixed");
    expect(deriveSourceStatus([])).toBe("mixed");
  });

  it("blocks missing, malformed, or unresolved review reports", () => {
    expect(reviewBlockingIssues(null)).toContain("Review report is missing or invalid.");
    expect(
      reviewBlockingIssues({
        groundingViolations: [{ quote: "A claim", issue: "No source" }],
        voiceViolations: [],
        overallVerdict: "Needs changes",
        readsAsGenericAiContent: false,
      }),
    ).toEqual(["1 grounding violation remains unresolved."]);
    expect(
      reviewBlockingIssues({
        groundingViolations: [],
        voiceViolations: [{ quote: "A phrase", issue: "Generic cadence" }],
        overallVerdict: "Needs changes",
        readsAsGenericAiContent: true,
      }),
    ).toEqual([
      "1 voice violation remains unresolved.",
      "The draft is still flagged as generic AI content.",
    ]);
  });

  it("allows a clean review report", () => {
    expect(
      reviewBlockingIssues({
        groundingViolations: [],
        voiceViolations: [],
        overallVerdict: "Ready for human review",
        readsAsGenericAiContent: false,
      }),
    ).toEqual([]);
  });

  it("extracts rows from both supported database driver result shapes", () => {
    expect(extractQueryRows<{ id: number }>({ rows: [{ id: 1 }] })).toEqual([{ id: 1 }]);
    expect(extractQueryRows<{ id: number }>([{ id: 2 }])).toEqual([{ id: 2 }]);
    expect(extractQueryRows<{ id: number }>({})).toEqual([]);
  });
});
