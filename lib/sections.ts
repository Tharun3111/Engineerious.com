import type { ItemType } from "@/db/schema";

export const SECTIONS = [
  { type: "news", label: "News", path: "/news", blurb: "What shipped, what broke, what it means." },
  { type: "model", label: "Models", path: "/models", blurb: "New and moving model releases." },
  { type: "oss", label: "Open Source", path: "/open-source", blurb: "Repos, releases, launches." },
] as const satisfies ReadonlyArray<{
  type: ItemType;
  label: string;
  path: string;
  blurb: string;
}>;

export type Section = (typeof SECTIONS)[number];

export function sectionFor(type: ItemType): Section {
  return SECTIONS.find((s) => s.type === type)!;
}

export function sectionByPath(path: string): Section | undefined {
  return SECTIONS.find((s) => s.path === path);
}
