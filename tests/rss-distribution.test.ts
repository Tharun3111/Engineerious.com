import { describe, expect, it } from "vitest";

import { buildRssXml, escapeXml, type RssEntry } from "@/app/rss.xml/route";

describe("public RSS distribution", () => {
  it("escapes untrusted fields, sorts by real publication time, and uses permanent URLs", () => {
    const entries: RssEntry[] = [
      {
        title: "Writing <one>",
        description: "R&D says \"ship\"",
        link: "https://engineerious.com/blog/writing?ignored=false&part=1",
        date: new Date("2026-08-24T10:00:00.000Z"),
        category: "Writing",
      },
      {
        title: "Daily & reviewed",
        description: "Today's immutable snapshot",
        link: "https://engineerious.com/daily/2026-08-25",
        date: new Date("2026-08-25T16:00:00.000Z"),
        category: "Daily",
      },
    ];

    const xml = buildRssXml("https://engineerious.com", entries);

    expect(xml).toContain("Daily &amp; reviewed");
    expect(xml).toContain("Writing &lt;one&gt;");
    expect(xml).toContain("R&amp;D says &quot;ship&quot;");
    expect(xml).toContain("writing?ignored=false&amp;part=1");
    expect(xml.indexOf("Daily &amp; reviewed")).toBeLessThan(xml.indexOf("Writing &lt;one&gt;"));
    expect(xml).toContain("<lastBuildDate>Tue, 25 Aug 2026 16:00:00 GMT</lastBuildDate>");
    expect(xml).toContain('<guid isPermaLink="true">https://engineerious.com/daily/2026-08-25</guid>');
  });

  it("omits lastBuildDate instead of inventing a timestamp for an empty feed", () => {
    expect(buildRssXml("https://engineerious.com", [])).not.toContain("lastBuildDate");
  });

  it("escapes all five XML-sensitive characters", () => {
    expect(escapeXml(`<tag attr="one">Tom & Jerry's</tag>`)).toBe(
      "&lt;tag attr=&quot;one&quot;&gt;Tom &amp; Jerry&apos;s&lt;/tag&gt;",
    );
  });
});
