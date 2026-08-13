import type { Platform } from "@/db/schema";

export const LAUNCH_PLATFORMS = ["linkedin", "instagram"] as const satisfies readonly Platform[];

/** Widened to Platform[] once, here, so every membership check below accepts any
 *  Platform value rather than repeating a cast at each call site. */
const LAUNCH_PLATFORM_SET: readonly Platform[] = LAUNCH_PLATFORMS;

export function resolveLaunchPlatforms(requested?: readonly Platform[]): readonly Platform[] {
  const platforms = requested ?? LAUNCH_PLATFORMS;
  const unsupported = platforms.filter((platform) => !LAUNCH_PLATFORM_SET.includes(platform));
  if (unsupported.length > 0) {
    throw new Error(`Only ${LAUNCH_PLATFORMS.join(" and ")} drafts are enabled for the launch.`);
  }
  return platforms;
}

export function isCopyReadyPlatform(platform: Platform): boolean {
  return LAUNCH_PLATFORM_SET.includes(platform);
}
