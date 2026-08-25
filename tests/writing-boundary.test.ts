import { describe, expect, it } from "vitest";

import { isWritingPost } from "@/lib/content/blog";

describe("Writing and Daily boundary", () => {
  it("keeps human and AI-assisted authorship in Writing", () => {
    expect(isWritingPost({ origin: "human" })).toBe(true);
    expect(isWritingPost({ origin: "ai_assisted" })).toBe(true);
  });

  it("keeps machine-produced briefs out of personal Writing", () => {
    expect(isWritingPost({ origin: "ai_generated" })).toBe(false);
  });
});
