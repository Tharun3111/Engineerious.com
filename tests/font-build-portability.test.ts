import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("production font loading", () => {
  it("bundles fonts locally instead of downloading Google Fonts during the build", () => {
    const layout = readFileSync(join(process.cwd(), "app", "layout.tsx"), "utf8");

    expect(layout).not.toContain('from "next/font/google"');
    // Assert the roles are covered rather than one hardcoded family, so swapping a
    // face doesn't fail a test whose real subject is "no network fetch at build
    // time". The serif changed from Newsreader to Source Serif 4 in the
    // Reproduction Log redesign; the portability guarantee did not.
    expect(layout).toContain("@fontsource-variable/ibm-plex-sans/wght.css");
    expect(layout).toMatch(/@fontsource(-variable)?\/[a-z0-9-]+\/wght\.css/);
  });

  it("self-hosts a serif for display and prose", () => {
    const layout = readFileSync(join(process.cwd(), "app", "layout.tsx"), "utf8");
    const css = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");

    const declared = css.match(/--font-display:\s*"([^"]+)"/);
    expect(declared, "--font-display must name a specific family first").not.toBeNull();

    // The declared family has to be one actually imported, or the page silently
    // falls back to Georgia and the type you designed never ships.
    const slug = declared![1].replace(/ Variable$/, "").toLowerCase().replaceAll(" ", "-");
    expect(layout).toContain(`@fontsource-variable/${slug}/`);
  });
});
