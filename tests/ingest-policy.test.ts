import { describe, expect, it } from "vitest";

import type { NewItem } from "@/db/schema";
import type { AdapterResult } from "@/lib/adapters/types";
import {
  dedupeWithinBatch,
  ingestHttpStatus,
  prepareIngestRows,
  summarise,
} from "@/lib/ingest";

function row(urlHash: string, sourceWeight: number, source: string): NewItem {
  return {
    type: "news",
    status: "pending",
    title: `${source} title`,
    url: `https://example.com/${urlHash}`,
    urlHash,
    source,
    sourceSlug: source.toLowerCase(),
    sourceWeight,
    points: 0,
    score: 0,
    firstSeen: new Date("2026-08-25T00:00:00Z"),
  };
}

describe("ingestion policy", () => {
  it("retains the highest-authority source for a duplicate URL within a batch", () => {
    const result = dedupeWithinBatch([
      row("same", 1, "Aggregator"),
      row("same", 5, "Primary lab"),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.source).toBe("Primary lab");
    expect(result[0]?.sourceWeight).toBe(5);
  });

  it("returns a failing cron status when even one adapter fails", () => {
    const results: AdapterResult[] = [
      { slug: "primary", ok: true, fetched: 2, inserted: 2 },
      { slug: "secondary", ok: false, fetched: 0, error: "timeout" },
    ];

    expect(ingestHttpStatus(results)).toBe(502);
    expect(summarise(results)).toMatchObject({ adapters: 2, ok: 1, failed: 1 });
  });

  it("returns success only when every configured adapter succeeds", () => {
    expect(ingestHttpStatus([{ slug: "primary", ok: true, fetched: 1 }])).toBe(200);
  });

  it("drops non-HTTP adapter destinations before persistence", () => {
    const rows = prepareIngestRows(
      [
        {
          type: "news",
          title: "Unsafe external payload",
          url: "data:text/html,payload",
          source: "External",
          sourceSlug: "external",
          sourceWeight: 1,
        },
      ],
      new Date("2026-08-25T00:00:00Z"),
    );

    expect(rows).toEqual([]);
  });

  it("keeps a safe item but strips an unsafe discussion destination", () => {
    const [result] = prepareIngestRows(
      [
        {
          type: "news",
          title: "Safe source",
          url: " https://example.com/release ",
          source: "External",
          sourceSlug: "external",
          sourceWeight: 1,
          raw: { discussion: "javascript:alert(1)", externalId: "abc" },
        },
      ],
      new Date("2026-08-25T00:00:00Z"),
    );

    expect(result?.url).toBe("https://example.com/release");
    expect(result?.rawJson).toEqual({ externalId: "abc" });
  });
});
