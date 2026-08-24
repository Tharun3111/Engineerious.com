import type { BlogPost } from "@/lib/content/blog";
import { getPillar } from "@/lib/pillars";

/**
 * Every number here is a real count over real posts — never sample data. The
 * prototype that this design was assembled from showed invented numbers like
 * "MCP 41"; shipping an invented count on a site whose whole pitch is "I
 * actually did this" would be the worst possible place to fake something.
 *
 * Replaces the old Census bar's reproduction-state counts (reproduced /
 * not-reproduced / ...), which belonged to the agent-security framing this
 * site no longer has.
 */
export function StatTiles({ posts }: { posts: BlogPost[] }) {
  const byPillar = new Map<string, number>();
  for (const post of posts) {
    const pillar = getPillar(post.pillar);
    if (!pillar) continue;
    byPillar.set(pillar.slug, (byPillar.get(pillar.slug) ?? 0) + 1);
  }

  const tiles: { k: string; v: number }[] = [{ k: "Entries", v: posts.length }];
  for (const [slug, count] of byPillar) {
    const pillar = getPillar(slug);
    if (pillar) tiles.push({ k: pillar.name, v: count });
  }

  if (posts.length === 0) return null;

  return (
    <div className="tiles">
      {tiles.map((tile) => (
        <div key={tile.k}>
          <div className="tile-k">{tile.k}</div>
          <div className="tile-v">{tile.v}</div>
        </div>
      ))}
    </div>
  );
}
