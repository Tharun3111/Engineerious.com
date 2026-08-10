import { describe, expect, it } from "vitest";

import {
  isCopyReadyPlatform,
  resolveLaunchPlatforms,
} from "@/lib/repurpose/launch-policy";

describe("launch distribution policy", () => {
  it("defaults to LinkedIn only", () => {
    expect(resolveLaunchPlatforms()).toEqual(["linkedin"]);
  });

  it("accepts an explicit LinkedIn request", () => {
    expect(resolveLaunchPlatforms(["linkedin"])).toEqual(["linkedin"]);
  });

  it("rejects deferred platforms", () => {
    expect(() => resolveLaunchPlatforms(["x"])).toThrow(
      "Only LinkedIn drafts are enabled for the launch.",
    );
  });

  it("marks only LinkedIn as copy-ready", () => {
    expect(isCopyReadyPlatform("linkedin")).toBe(true);
    expect(isCopyReadyPlatform("facebook")).toBe(false);
  });
});
