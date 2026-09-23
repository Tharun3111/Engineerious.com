import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const adminMutationRoutes = [
  "app/api/admin/curated-ai/route.ts",
  "app/api/admin/digests/route.ts",
  "app/api/admin/items/route.ts",
  "app/api/admin/newsletters/route.ts",
  "app/api/admin/repurpose/route.ts",
  "app/api/admin/submissions/route.ts",
  "app/api/admin/subscribers/route.ts",
];

describe("mutation route safety policy", () => {
  it("directly authenticates every admin mutation before bounded body parsing", () => {
    for (const file of adminMutationRoutes) {
      const source = readFileSync(file, "utf8");
      const post = source.indexOf("export async function POST");
      const auth = source.indexOf("authorizeAdmin(request)", post);
      const body = source.indexOf("readBoundedJsonMutation(request", post);

      expect(post, file).toBeGreaterThan(-1);
      expect(auth, file).toBeGreaterThan(post);
      expect(body, file).toBeGreaterThan(auth);
      expect(source, file).not.toContain("request.json(");
    }
  });

  it("uses the same bounded browser-mutation boundary on every other owned POST route", () => {
    for (const file of [
      "app/api/repurpose/route.ts",
      "app/api/submit/route.ts",
      "app/api/subscribe/route.ts",
    ]) {
      const source = readFileSync(file, "utf8");
      expect(source, file).toContain("readBoundedJsonMutation(request");
      expect(source, file).not.toContain("request.json(");
    }
  });

  it("keeps deterministic dependency and generated-schema checks in CI", () => {
    const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
    expect(workflow).toContain("npm audit --audit-level=high");
    expect(workflow.indexOf("npm run db:check")).toBeLessThan(
      workflow.indexOf("npm run db:generate"),
    );
    expect(workflow).toContain("npm run db:generate");
    expect(workflow).toContain("git diff --exit-code -- db/schema.ts db/migrations");
  });
});
