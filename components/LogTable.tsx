import Link from "next/link";

import { Plate, plateStateFor } from "@/components/Plate";
import type { BlogPost } from "@/lib/content/blog";
import { getPillar } from "@/lib/pillars";
import { isoDate } from "@/lib/time";

/**
 * The index is a table because comparison across rows is its entire job — which
 * row is unpatched, which was actually reproduced, what got published when. The
 * record page uses a label/value strip instead, since there is only one row there
 * and nothing to compare against.
 *
 * Applying one treatment to both is the mistake NVD (all table, unreadable) and
 * GitHub Advisories (all strip, impossible to scan) each make from opposite ends.
 */
export function LogTable({
  posts,
  emptyMessage,
}: {
  posts: BlogPost[];
  emptyMessage: string;
}) {
  if (posts.length === 0) {
    return (
      <div data-feed-state="empty" className="border-y border-rule py-8">
        <p className="section-label">Log status</p>
        <p className="mt-2 max-w-[56ch] text-[16px] leading-7 text-muted">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div data-feed-state="ok" data-feed-count={posts.length} className="overflow-x-auto">
      <table className="w-full border-collapse text-[14px]">
        <thead>
          <tr>
            {["Reproduction", "Entry", "Origin", "Sources", "Published"].map((heading) => (
              <th
                key={heading}
                scope="col"
                className="whitespace-nowrap border-b border-fg pb-2.5 pr-4 text-left font-sans text-[10.5px] font-semibold uppercase tracking-[0.11em] text-muted"
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {posts.map((post) => {
            const pillar = getPillar(post.pillar);
            return (
              <tr key={post.slug} className="align-top transition-colors duration-150 hover:bg-surface">
                <td className="border-b border-rule py-4 pr-4">
                  <Plate state={plateStateFor(post)} />
                </td>
                <td className="border-b border-rule py-4 pr-4">
                  <Link href={`/blog/${post.slug}`} className="block max-w-[52ch]">
                    <span className="block text-[16px] font-semibold leading-snug tracking-[-0.005em]">
                      {post.title}
                    </span>
                    <span className="mt-1 block text-[13.5px] leading-6 text-muted">
                      {pillar ? pillar.name : "Unfiled"}
                      {post.draft ? " · draft" : ""}
                    </span>
                  </Link>
                </td>
                <td className="ver border-b border-rule py-4 pr-4 text-muted">
                  {post.origin === "human"
                    ? "human"
                    : post.origin === "ai_assisted"
                      ? "ai-assisted"
                      : "ai draft"}
                </td>
                <td className="ver border-b border-rule py-4 pr-4 text-muted">{post.sourceStatus}</td>
                <td className="ver border-b border-rule py-4 pr-4 text-muted">{isoDate(post.date)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
