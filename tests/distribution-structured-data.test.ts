import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  dailyArticleJsonLd,
  dailyBreadcrumbJsonLd,
} from "@/app/daily/[date]/page";
import { topicBreadcrumbJsonLd } from "@/app/topics/[slug]/page";
import { parsePublishedDailyBrief } from "@/lib/daily-brief";
import type { PublicDailyBrief } from "@/lib/daily-queries";
import { getTopic } from "@/lib/topics";
import { makeDailyBrief } from "@/tests/daily-fixtures";

const entry: PublicDailyBrief = {
  digestId: 42,
  date: "2026-08-25",
  publishedAt: new Date("2026-08-25T16:00:00.000Z"),
  brief: parsePublishedDailyBrief(makeDailyBrief()),
};

describe("distribution structured data", () => {
  it("describes the immutable dated Daily article and its real publication time", () => {
    const article = dailyArticleJsonLd(entry);
    expect(article["@type"]).toBe("Article");
    expect(article.headline).toBe(entry.brief.title);
    expect(article.datePublished).toBe(entry.publishedAt.toISOString());
    expect(article.dateModified).toBe(entry.publishedAt.toISOString());
    expect(article.mainEntityOfPage["@id"]).toBe(
      "https://engineerious.com/daily/2026-08-25",
    );
    expect(JSON.stringify(article)).not.toContain("digestId");
  });

  it("publishes complete Daily and topic breadcrumb trails", () => {
    expect(dailyBreadcrumbJsonLd(entry).itemListElement.map((item) => item.position)).toEqual([
      1, 2, 3,
    ]);

    const topic = getTopic("rag");
    if (!topic) throw new Error("RAG topic fixture is missing");
    const breadcrumbs = topicBreadcrumbJsonLd(topic);
    expect(breadcrumbs.itemListElement.at(-1)).toMatchObject({
      name: "RAG",
      item: "https://engineerious.com/topics/rag",
    });
  });

  it("keeps social images on reviewed data paths and sitemap timestamps evidence-based", () => {
    const dailyOg = readFileSync(
      join(process.cwd(), "app/daily/[date]/opengraph-image.tsx"),
      "utf8",
    );
    expect(dailyOg).toContain("getDailyBriefByDate");
    expect(dailyOg).not.toContain("dailyDraft");

    const sitemap = readFileSync(join(process.cwd(), "app/sitemap.ts"), "utf8");
    expect(sitemap).not.toContain("const now = new Date()");
    expect(sitemap).not.toContain("lastModified: now");
  });
});
