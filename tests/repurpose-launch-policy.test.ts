import { describe, expect, it } from "vitest";

import {
  isCopyReadyPlatform,
  resolveLaunchPlatforms,
} from "@/lib/repurpose/launch-policy";

describe("launch distribution policy", () => {
  it("defaults to LinkedIn and Instagram", () => {
    expect(resolveLaunchPlatforms()).toEqual(["linkedin", "instagram"]);
  });

  it("accepts an explicit subset of launch platforms", () => {
    expect(resolveLaunchPlatforms(["linkedin"])).toEqual(["linkedin"]);
    expect(resolveLaunchPlatforms(["instagram"])).toEqual(["instagram"]);
  });

  it("rejects deferred platforms", () => {
    expect(() => resolveLaunchPlatforms(["x"])).toThrow(
      "Only linkedin and instagram drafts are enabled for the launch.",
    );
  });

  it("rejects a mixed request containing any deferred platform", () => {
    expect(() => resolveLaunchPlatforms(["linkedin", "facebook"])).toThrow(
      "Only linkedin and instagram drafts are enabled for the launch.",
    );
  });

  it("marks launch platforms as copy-ready, everything else not", () => {
    expect(isCopyReadyPlatform("linkedin")).toBe(true);
    expect(isCopyReadyPlatform("instagram")).toBe(true);
    expect(isCopyReadyPlatform("facebook")).toBe(false);
    expect(isCopyReadyPlatform("x")).toBe(false);
    expect(isCopyReadyPlatform("youtube")).toBe(false);
  });
});
