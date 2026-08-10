import { describe, expect, it } from "vitest";

import { isDeferredPublicPath, shouldCloseResearchPath } from "@/lib/public-launch";

describe("public launch gate", () => {
  it("recognizes exact and nested deferred paths", () => {
    expect(isDeferredPublicPath("/news")).toBe(true);
    expect(isDeferredPublicPath("/models/123")).toBe(true);
    expect(isDeferredPublicPath("/about")).toBe(false);
  });

  it("closes deferred routes by default", () => {
    expect(shouldCloseResearchPath("/open-source/42")).toBe(true);
    expect(shouldCloseResearchPath("/about")).toBe(false);
  });

  it("opens research routes only with an explicit true value", () => {
    expect(shouldCloseResearchPath("/resources", "true")).toBe(false);
    expect(shouldCloseResearchPath("/resources", "false")).toBe(true);
  });
});
