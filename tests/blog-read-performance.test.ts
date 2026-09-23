import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("blog server read performance", () => {
  it("memoizes list and slug reads per React request", () => {
    const source = readFileSync("lib/content/blog.ts", "utf8");
    for (const name of [
      "listMdxFiles",
      "getAllMdxPosts",
      "getAllDbPosts",
      "getAllPosts",
      "getPublishedPosts",
      "getPost",
      "getAdjacentPosts",
    ]) {
      expect(source, name).toMatch(new RegExp(`(?:const|export const) ${name} = cache\\(`));
    }
  });

  it("resolves MDX first and uses a one-row DB slug query instead of scanning all posts", () => {
    const source = readFileSync("lib/content/blog.ts", "utf8");
    const start = source.indexOf("export const getPost = cache");
    const getPost = source.slice(start, source.indexOf("export async function getPostsByPillar", start));
    expect(getPost.indexOf("listMdxFiles()")).toBeLessThan(getPost.indexOf("getDbPostBySlug(slug)"));
    expect(source).toContain("eq(postsTable.slug, slug)");
    expect(source).toContain("isNotNull(postsTable.body)");
    expect(source).toMatch(/getDbPostBySlug[\s\S]*?\.limit\(1\)/);
    expect(getPost).not.toContain("getAllDbPosts()");
  });

  it("keeps detail-page adjacency on a body-free DB projection", () => {
    const source = readFileSync("lib/content/blog.ts", "utf8");
    const start = source.indexOf("async function loadAllDbPostNavigation");
    const navigation = source.slice(
      start,
      source.indexOf("const getDbPostBySlug", start),
    );
    const adjacentStart = source.indexOf("export const getAdjacentPosts = cache");
    const adjacent = source.slice(adjacentStart);
    const page = readFileSync("app/blog/[slug]/page.tsx", "utf8");

    expect(navigation).toContain("select(dbPostMetadataSelection)");
    expect(navigation).not.toContain("dbPostContentSelection");
    expect(adjacent).toContain("getAllDbPostNavigation()");
    expect(adjacent).not.toContain("getAllPosts()");
    expect(page).toContain("getAdjacentPosts(slug)");
    expect(page).toContain("getPostDistribution(slug)");
    expect(page).not.toContain("getPostRow(slug)");
  });

  it("keeps blog HTML and social images on a five-minute revalidation window", () => {
    for (const file of [
      "app/blog/page.tsx",
      "app/blog/[slug]/page.tsx",
      "app/blog/[slug]/opengraph-image.tsx",
    ]) {
      expect(readFileSync(file, "utf8"), file).toContain("export const revalidate = 300");
    }
  });
});
