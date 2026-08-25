import { describe, expect, it } from "vitest";

import { shouldFailOnDatabaseError } from "@/lib/db";

describe("deployment database availability", () => {
  it("fails closed on configured Vercel and CI builds", () => {
    expect(
      shouldFailOnDatabaseError({ databaseUrl: "postgres://configured", vercelEnv: "preview" }),
    ).toBe(true);
    expect(
      shouldFailOnDatabaseError({ databaseUrl: "postgres://configured", ci: "true" }),
    ).toBe(true);
  });

  it("allows local MDX-only authoring and unconfigured CI builds", () => {
    expect(shouldFailOnDatabaseError({ databaseUrl: "postgres://configured" })).toBe(false);
    expect(shouldFailOnDatabaseError({ ci: "true" })).toBe(false);
  });
});
