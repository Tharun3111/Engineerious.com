import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("production font loading", () => {
  it("bundles fonts locally instead of downloading Google Fonts during the build", () => {
    const layout = readFileSync(join(process.cwd(), "app", "layout.tsx"), "utf8");

    expect(layout).not.toContain('from "next/font/google"');
    expect(layout).toContain('@fontsource-variable/ibm-plex-sans/wght.css');
    expect(layout).toContain('@fontsource-variable/newsreader/wght.css');
  });
});
