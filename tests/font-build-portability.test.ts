import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function readLayout(): string {
  return readFileSync(join(process.cwd(), "app", "layout.tsx"), "utf8");
}

function readGlobals(): string {
  return readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");
}

describe("production font loading", () => {
  it("never downloads from Google Fonts during the build", () => {
    expect(readLayout()).not.toContain('from "next/font/google"');
  });

  it("self-hosts a font for every role globals.css declares", () => {
    // Assert the ROLES are covered rather than one hardcoded family, so
    // swapping a typeface doesn't fail a test whose real subject is "no
    // network fetch at build time." The stack has changed twice already —
    // IBM Plex Sans + Source Serif 4 (Reproduction Log), then Instrument Sans
    // + Martian Mono (this redesign) — the portability guarantee did not.
    const layout = readLayout();
    const css = readGlobals();

    for (const token of ["--font-sans", "--font-display", "--font-mono"]) {
      const declared = css.match(new RegExp(`${token}:\\s*"([^"]+)"`));
      expect(declared, `${token} must name a specific family first`).not.toBeNull();

      // The declared family has to be one actually imported, or the page
      // silently falls back to a system font and the type that was designed
      // never ships. Fontsource package slugs are the family name
      // lowercased/hyphenated with " Variable" dropped.
      const slug = declared![1].replace(/ Variable$/, "").toLowerCase().replaceAll(" ", "-");
      expect(layout).toMatch(new RegExp(`@fontsource(-variable)?/${slug}/`));
    }
  });
});
