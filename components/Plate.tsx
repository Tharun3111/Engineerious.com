import { isoDate } from "@/lib/time";

import type { Frontmatter } from "@/lib/content/frontmatter";

/**
 * The reproduction plate — the signature object of the site.
 *
 * It renders LARGER and EARLIER than severity on every record, which inverts the
 * convention of this genre deliberately. CVE.org, NVD, GitHub Advisories and Snyk
 * all lead with a severity chip; none of them tell you whether anyone actually
 * reproduced the thing. A working engineer parses "reproduced / not reproduced /
 * not attempted" faster and more usefully than "8.7 HIGH", and it is the one field
 * a one-person site can fill that a database cannot.
 *
 * It is derived, not authored. `testedStatus`, `origin` and `reviewedBy` already
 * exist in the frontmatter schema and were previously rendered as one line of
 * 13.5px grey text under the byline. The information was always there; it was just
 * never given a shape.
 */
export type PlateState = "reproduced" | "vendor" | "not-reproduced" | "not-attempted";

const COPY: Record<PlateState, string> = {
  reproduced: "Reproduced",
  vendor: "Vendor-confirmed",
  "not-reproduced": "Not reproduced",
  "not-attempted": "Not attempted",
};

const CLASS: Record<PlateState, string> = {
  reproduced: "plate-reproduced",
  vendor: "plate-vendor",
  "not-reproduced": "plate-not-reproduced",
  "not-attempted": "plate-not-attempted",
};

/**
 * `testedStatus` is the whole signal; `origin` only breaks the tie on an untested
 * post. A machine draft nobody checked is "not attempted" — it never gets to claim
 * someone tried and failed, which is a stronger statement than it has earned.
 */
export function plateStateFor(post: Pick<Frontmatter, "testedStatus" | "origin" | "sourceStatus">): PlateState {
  if (post.testedStatus === "replicated") return "reproduced";
  if (post.testedStatus === "tested_once") return "reproduced";
  if (post.sourceStatus === "primary" && post.origin !== "ai_generated") return "vendor";
  if (post.origin === "ai_generated") return "not-attempted";
  return "not-reproduced";
}

export function Plate({
  state,
  on,
  by,
  size = "sm",
}: {
  state: PlateState;
  /** Date the reproduction was attempted — omitted when there was no attempt. */
  on?: Date | string | null;
  by?: string | null;
  size?: "sm" | "lg";
}) {
  const showMeta = state !== "not-attempted" && (on || by);

  return (
    <span
      className={`plate ${CLASS[state]}${size === "lg" ? " plate-lg" : ""}`}
      title={
        state === "not-attempted"
          ? "Nobody has tried to reproduce this."
          : `${COPY[state]}${by ? ` by ${by}` : ""}${on ? ` on ${isoDate(on)}` : ""}`
      }
    >
      <span aria-hidden className="plate-dot" />
      <span className="font-semibold">{COPY[state]}</span>
      {showMeta && (
        <span className="plate-meta">
          {on ? isoDate(on) : null}
          {on && by ? " · " : null}
          {by}
        </span>
      )}
    </span>
  );
}
