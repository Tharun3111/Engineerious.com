export const CURRENT_DESK_KINDS = ["building", "learning", "testing", "reading"] as const;

export type CurrentDeskKind = (typeof CURRENT_DESK_KINDS)[number];

export type CurrentDeskEntry = {
  readonly kind: CurrentDeskKind;
  readonly label: string;
  readonly title: string;
  readonly detail: string;
  readonly availability: "confirmed" | "not_published";
  readonly href?: string;
};

/**
 * A deliberately small, manually maintained snapshot. The brief's example
 * projects, books, tests, and learning topics are ideas, not biographical facts,
 * so those slots stay explicit until Tharun publishes a real update.
 */
export const currentDesk: readonly CurrentDeskEntry[] = [
  {
    kind: "building",
    label: "Currently building",
    title: "Engineerious",
    detail:
      "A personal AI engineering desk for reviewed intelligence, practical writing, and project notes.",
    availability: "confirmed",
    href: "/projects/engineerious",
  },
  {
    kind: "learning",
    label: "Currently learning",
    title: "Not published yet",
    detail: "No current learning note has been published for this slot.",
    availability: "not_published",
  },
  {
    kind: "testing",
    label: "Currently testing",
    title: "Not published yet",
    detail: "No current test has been published for this slot.",
    availability: "not_published",
  },
  {
    kind: "reading",
    label: "Currently reading",
    title: "Not published yet",
    detail: "No current reading note has been published for this slot.",
    availability: "not_published",
  },
] as const;
