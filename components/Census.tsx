import Link from "next/link";

import { plateStateFor, type PlateState } from "@/components/Plate";
import type { BlogPost } from "@/lib/content/blog";
import { getPillar } from "@/lib/pillars";

/**
 * Every noun carries how much is behind it.
 *
 * This is the mechanic that makes Y Combinator's site and GitHub's advisory index
 * pull you sideways, and it is not a visual effect — GitHub's is a 12px muted line
 * reading `npm 7,203 · pip 5,995`. A link labelled with its own size tells you the
 * corpus is enumerable and that there is something behind the click.
 *
 * Counts here are computed from real posts. The prototype showed `MCP 41 ·
 * LangChain 27`, which was sample data — shipping an invented number on a site
 * whose entire thesis is verifiable provenance would be the worst possible place
 * to fake something. When a bucket is empty it is dropped rather than shown as
 * zero, EXCEPT the reproduction states: "reproduced 0" is the single most honest
 * fact this site can publish about itself, and hiding it would be the same
 * cowardice the design exists to prevent.
 */
const STATE_LABEL: Record<PlateState, string> = {
  reproduced: "reproduced",
  vendor: "vendor-confirmed",
  "not-reproduced": "not reproduced",
  "not-attempted": "not attempted",
};

export function Census({ posts }: { posts: BlogPost[] }) {
  if (posts.length === 0) return null;

  const byPillar = new Map<string, number>();
  for (const post of posts) {
    const pillar = getPillar(post.pillar);
    if (!pillar) continue;
    byPillar.set(pillar.slug, (byPillar.get(pillar.slug) ?? 0) + 1);
  }

  const byState = new Map<PlateState, number>();
  for (const post of posts) {
    const state = plateStateFor(post);
    byState.set(state, (byState.get(state) ?? 0) + 1);
  }

  const states: PlateState[] = ["reproduced", "vendor", "not-reproduced", "not-attempted"];

  return (
    <nav
      aria-label="Browse the log"
      className="flex flex-wrap items-baseline gap-x-6 gap-y-2 border-b border-rule py-3.5 text-[12.5px] text-muted"
    >
      <Link href="/blog" className="hover:text-fg">
        <span className="font-semibold text-fg">Entries</span>{" "}
        <span className="ver text-muted">{posts.length}</span>
      </Link>

      {[...byPillar.entries()].map(([slug, count]) => {
        const pillar = getPillar(slug);
        if (!pillar) return null;
        return (
          <span key={slug} className="whitespace-nowrap">
            <span className="font-semibold text-fg">{pillar.name}</span>{" "}
            <span className="ver text-muted">{count}</span>
          </span>
        );
      })}

      {states.map((state) => {
        const count = byState.get(state) ?? 0;
        // Reproduction states always render, including zero — that is the number.
        return (
          <span key={state} className="whitespace-nowrap">
            <span className="font-semibold text-fg">{STATE_LABEL[state]}</span>{" "}
            <span className="ver text-muted">{count}</span>
          </span>
        );
      })}
    </nav>
  );
}
