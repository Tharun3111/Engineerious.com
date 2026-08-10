import type { Platform } from "@/db/schema";

export const LAUNCH_PLATFORMS = ["linkedin"] as const satisfies readonly Platform[];

export function resolveLaunchPlatforms(requested?: readonly Platform[]): readonly Platform[] {
  const platforms = requested ?? LAUNCH_PLATFORMS;
  if (platforms.some((platform) => platform !== "linkedin")) {
    throw new Error("Only LinkedIn drafts are enabled for the launch.");
  }
  return platforms;
}

export function isCopyReadyPlatform(platform: Platform): boolean {
  return platform === "linkedin";
}
