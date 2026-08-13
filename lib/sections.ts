import type { ItemType } from "@/db/schema";

export const SECTIONS = [
  {
    type: "news",
    label: "News",
    path: "/news",
    eyebrow: "Signal / 01",
    blurb: "AI news for engineering decisions.",
    description:
      "Track important releases, research, policy changes, and incidents. Each update links to the source and explains the engineering impact.",
    emptyMessage:
      "No reviewed news yet. Updates appear here after the source and engineering impact have been checked. Subscribe below to get new analysis.",
  },
  {
    type: "model",
    label: "Models",
    path: "/models",
    eyebrow: "Model intelligence / 02",
    blurb: "Model updates compared for real-world use.",
    description:
      "Compare new models by capability, access, cost, and constraints. Each update includes the tests worth running before you switch.",
    emptyMessage:
      "No reviewed model updates yet. Releases appear here after their claims, access, and practical tradeoffs have been checked. Subscribe below to get new analysis.",
  },
  {
    type: "oss",
    label: "Open source",
    path: "/open-source",
    eyebrow: "Open systems / 03",
    blurb: "Open-source releases worth evaluating.",
    description: "Find new AI tools and meaningful releases with source links, adoption context, and practical tradeoffs.",
    emptyMessage: "No reviewed open-source releases yet. Check back after the next editorial review.",
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
