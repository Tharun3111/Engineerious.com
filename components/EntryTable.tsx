import Link from "next/link";

import type { BlogPost } from "@/lib/content/blog";
import { getPillar } from "@/lib/pillars";
import { isoDate } from "@/lib/time";

/**
 * The index. A table because comparison across rows is the job — which pillar,
 * how the entry was made, when. Replaces LogTable, which led with a
 * reproduction-status column tied to the agent-security framing this site no
 * longer has.
 */
export function EntryTable({
  posts,
  emptyMessage,
}: {
  posts: BlogPost[];
  emptyMessage: string;
}) {
  if (posts.length === 0) {
    return (
      <div data-feed-state="empty" className="border-y border-rule py-8">
        <p className="section-label">Status</p>
        <p className="mt-2 max-w-[56ch] text-[15px] leading-7 text-muted">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div data-feed-state="ok" data-feed-count={posts.length} className="entry-table-wrap overflow-x-auto">
      <table className="entry-table w-full">
        <thead>
          <tr>
            <th scope="col">Entry</th>
            <th scope="col">Pillar</th>
            <th scope="col">Origin</th>
            <th scope="col">Read</th>
            <th scope="col">Date</th>
          </tr>
        </thead>
        <tbody>
          {posts.map((post) => {
            const pillar = getPillar(post.pillar);
            return (
              <tr key={post.slug}>
                <td>
                  <Link href={`/blog/${post.slug}`} className="block max-w-[52ch]">
                    <span className="block text-[15px] font-semibold leading-snug tracking-[-0.005em] text-fg">
                      {post.title}
                    </span>
                    <span className="mt-1 block text-[13px] leading-6 text-muted">
                      {post.dek}
                      {post.draft ? " · draft" : ""}
                    </span>
                  </Link>
                </td>
                <td className="ver whitespace-nowrap text-muted">{pillar ? pillar.name : "Unfiled"}</td>
                <td className="ver whitespace-nowrap text-muted">
                  {post.origin === "human"
                    ? "human"
                    : post.origin === "ai_assisted"
                      ? "ai-assisted"
                      : "ai draft"}
                </td>
                <td className="ver whitespace-nowrap text-muted">{post.readingMinutes}m</td>
                <td className="ver whitespace-nowrap text-muted">{isoDate(post.date)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
