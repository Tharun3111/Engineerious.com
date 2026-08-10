export const DEFERRED_PUBLIC_PREFIXES = [
  "/open-source",
  "/resources",
  "/submit",
  "/pillars",
] as const;

export function isDeferredPublicPath(pathname: string): boolean {
  return DEFERRED_PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function shouldCloseResearchPath(pathname: string, enabledValue?: string): boolean {
  return enabledValue !== "true" && isDeferredPublicPath(pathname);
}
