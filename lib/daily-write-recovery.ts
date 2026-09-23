export type DailyWriteRecoveryMode =
  | "generate_structured"
  | "resume_structured"
  | "resume_legacy";

/**
 * Chooses one and only one recovery path for the WRITE checkpoint.
 *
 * `blogPostSlug` is the pre-structured-payload checkpoint retained for deployments
 * that failed during legacy REVIEW. `dailyDraft` is the current checkpoint. Seeing
 * both means two different artifacts claim to be the source of truth, so silently
 * preferring either one would risk reviewing and publishing the wrong content.
 */
export function selectDailyWriteRecovery(input: {
  blogPostSlug: string | null;
  dailyDraft: unknown | null;
}): DailyWriteRecoveryMode {
  const hasLegacyPost = Boolean(input.blogPostSlug);
  const hasStructuredDraft = input.dailyDraft !== null && input.dailyDraft !== undefined;

  if (hasLegacyPost && hasStructuredDraft) {
    throw new Error(
      "Digest has both a legacy blog post and a structured Daily draft; refusing to choose a recovery checkpoint",
    );
  }
  if (hasStructuredDraft) return "resume_structured";
  if (hasLegacyPost) return "resume_legacy";
  return "generate_structured";
}
