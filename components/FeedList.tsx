import type { Item } from "@/db/schema";
import { Row } from "@/components/Row";

type FeedListProps = {
  items: Item[];
  /** Non-null when the query itself failed — rendered differently from "no rows yet". */
  error?: string | null;
  /** Continues the rank numbering across pages. */
  startRank?: number;
  emptyMessage?: string;
};

/**
 * The empty and error states are deliberately distinct and both are visible in the
 * DOM: /qa asserts that a feed page never renders zero rows silently, and "the cron
 * has not run yet" is a very different bug from "the database is unreachable".
 */
export function FeedList({
  items,
  error = null,
  startRank = 1,
  emptyMessage = "No items yet. The ingestion cron has not run, or everything it found is awaiting approval.",
}: FeedListProps) {
  if (error) {
    return (
      <div data-feed-state="error" role="alert" className="card p-5 text-[13.5px]">
        <p className="font-medium">Feed unavailable.</p>
        <p className="mt-1 font-mono text-[12.5px] text-muted">{error}</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div data-feed-state="empty" className="card p-5 text-[13.5px] text-muted">
        {emptyMessage}
      </div>
    );
  }

  return (
    <ol data-feed-state="ok" data-feed-count={items.length} className="space-y-2.5">
      {items.map((item, index) => (
        <Row key={item.id} item={item} rank={startRank + index} />
      ))}
    </ol>
  );
}
