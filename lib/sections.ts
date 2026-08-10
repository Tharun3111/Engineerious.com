import type { ItemType } from "@/db/schema";

export const SECTIONS = [
  {
    type: "news",
    label: "News",
    path: "/news",
    eyebrow: "Signal / 01",
    blurb: "AI news, filtered for builders.",
    description:
      "Important releases, research, policy shifts, and incidents—reviewed for what changed and why an engineer should care.",
    emptyMessage:
      "No reviewed news is published yet. This page only shows updates after the source and engineering impact have been checked.",
  },
  {
    type: "model",
    label: "Models",
    path: "/models",
    eyebrow: "Model intelligence / 02",
    blurb: "Model releases, translated into engineering impact.",
    description:
      "New models and meaningful updates compared by capability, cost, constraints, and the tests worth running before adoption.",
    emptyMessage:
      "No reviewed model update is published yet. Releases appear here after their claims, access, and practical tradeoffs have been checked.",
  },
  {
    type: "oss",
    label: "Open Source",
    path: "/open-source",
    eyebrow: "Open systems / 03",
    blurb: "Repos, releases, launches.",
    description: "Open-source tools and releases with practical engineering context.",
    emptyMessage: "No reviewed open-source release is published yet.",
  },
] as const satisfies ReadonlyArray<{
  type: ItemType;
  label: string;
  path: string;
  eyebrow: string;
  blurb: string;
  description: string;
  emptyMessage: string;
}>;

export type Section = (typeof SECTIONS)[number];

export function sectionFor(type: ItemType): Section {
  return SECTIONS.find((s) => s.type === type)!;
}

export function sectionByPath(path: string): Section | undefined {
  return SECTIONS.find((s) => s.path === path);
}
