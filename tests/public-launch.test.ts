import { describe, expect, it } from "vitest";

import {
  isClosedPublicPath,
  isDeferredPublicPath,
  isPublicItemType,
  shouldCloseResearchPath,
} from "@/lib/public-launch";

describe("public launch gate", () => {
  it("recognizes exact and nested deferred paths", () => {
    expect(isDeferredPublicPath("/open-source")).toBe(true);
    expect(isDeferredPublicPath("/open-source/123")).toBe(true);
    expect(isDeferredPublicPath("/about")).toBe(false);
    // Closed and deferred are separate lists — neither leaks into the other.
    expect(isDeferredPublicPath("/news")).toBe(false);
    expect(isDeferredPublicPath("/models/123")).toBe(false);
  });

  it("recognizes exact and nested closed paths", () => {
    expect(isClosedPublicPath("/news")).toBe(true);
    expect(isClosedPublicPath("/news/42")).toBe(true);
    expect(isClosedPublicPath("/models")).toBe(true);
    expect(isClosedPublicPath("/models/qwen")).toBe(true);
    expect(isClosedPublicPath("/resources")).toBe(true);
    expect(isClosedPublicPath("/resources/eval-checklist")).toBe(true);
    expect(isClosedPublicPath("/about")).toBe(false);
    expect(isClosedPublicPath("/open-source")).toBe(false);
  });

  it("does not match a path that merely starts with a closed prefix's characters", () => {
    expect(isClosedPublicPath("/newsletter")).toBe(false);
    expect(isDeferredPublicPath("/submitted")).toBe(false);
  });

  it("closes deferred routes by default", () => {
    expect(shouldCloseResearchPath("/open-source/42")).toBe(true);
    expect(shouldCloseResearchPath("/about")).toBe(false);
  });

  it("opens deferred routes only with an explicit true value", () => {
    expect(shouldCloseResearchPath("/open-source", "true")).toBe(false);
    expect(shouldCloseResearchPath("/open-source", "false")).toBe(true);
  });

  it("keeps placeholder resources shut even when the research flag is on", () => {
    expect(shouldCloseResearchPath("/resources", "true")).toBe(true);
    expect(shouldCloseResearchPath("/resources", "false")).toBe(true);
  });

  it("keeps closed routes shut even when the research flag is on", () => {
    // The whole point of the second tier: PUBLIC_RESEARCH_ENABLED is "true" in
    // production today, so a flag-gated /news would still be serving 200.
    expect(shouldCloseResearchPath("/news", "true")).toBe(true);
    expect(shouldCloseResearchPath("/models/qwen", "true")).toBe(true);
  });

  it("leaves the routes the site actually publishes alone", () => {
    for (const open of ["/", "/blog", "/blog/some-post", "/about", "/archive", "/subscribe"]) {
      expect(shouldCloseResearchPath(open, "true")).toBe(false);
      expect(shouldCloseResearchPath(open)).toBe(false);
    }
  });

  it("exposes only open-source rows, and only behind the explicit gate", () => {
    expect(isPublicItemType("oss", "true")).toBe(true);
    expect(isPublicItemType("oss", "false")).toBe(false);
    expect(isPublicItemType("oss")).toBe(false);
    expect(isPublicItemType("news", "true")).toBe(false);
    expect(isPublicItemType("model", "true")).toBe(false);
  });
});
