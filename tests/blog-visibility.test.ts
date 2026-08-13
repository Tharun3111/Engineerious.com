import { describe, expect, it } from "vitest";

import { isPublished, type BlogPost } from "@/lib/content/blog";

/**
 * isPublished() is the one real gate app/blog/[slug]/page.tsx and app/archive/
 * both build isVisible() on top of — this is the regression test for the
 * draft-leak bug class (an unreviewed post reachable at its public URL).
 * isVisible() itself (isPublished() OR includeDrafts) isn't tested here:
 * includeDrafts reads NODE_ENV at module load, which vitest sets to "test" —
 * so isVisible() is always true in this environment regardless of gate logic,
 * making a test of it here meaningless. isPublished() is the actual invariant.
 */
function post(overrides: Partial<Pick<BlogPost, "draft" | "authenticityStatus">>): BlogPost {
  return {
    draft: true,
    authenticityStatus: "pending",
    ...overrides,
  } as BlogPost;
}

describe("isPublished", () => {
  it("is false for a draft, even if marked verified", () => {
    expect(isPublished(post({ draft: true, authenticityStatus: "verified" }))).toBe(false);
  });

  it("is false for a non-draft that was never reviewed", () => {
    expect(isPublished(post({ draft: false, authenticityStatus: "pending" }))).toBe(false);
  });

  it("is false for a non-draft with no authenticityStatus set", () => {
    expect(isPublished(post({ draft: false, authenticityStatus: undefined }))).toBe(false);
  });

  it("is true only when both non-draft and verified", () => {
    expect(isPublished(post({ draft: false, authenticityStatus: "verified" }))).toBe(true);
  });
});
