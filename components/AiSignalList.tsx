import type { CuratedAiSignal } from "@/lib/curated-ai";

const PRIMARY_SOURCE_SLUGS = new Set([
  "openai-news",
  "google-research",
  "deepmind",
  "meta-engineering",
  "hf-blog",
  "github-search",
  "github-releases",
  "huggingface",
  "arxiv-cs-ai",
  "arxiv-cs-cl",
]);

const SECONDARY_SOURCE_SLUGS = new Set([
  "marktechpost",
  "venturebeat-ai",
  "wired-ai",
  "the-verge-ai",
  "producthunt",
]);

export type SignalSourceRole = "primary" | "secondary" | null;
export type SignalRankIndex = Readonly<Record<string, number>>;

/** The corpus is already ordered by live score; retain that position across subsets. */
export function buildSignalRankIndex(
  signals: readonly Pick<CuratedAiSignal, "itemId">[],
): SignalRankIndex {
  const ranks: Record<string, number> = {};
  signals.forEach((signal, index) => {
    const key = String(signal.itemId);
    if (ranks[key] === undefined) ranks[key] = index + 1;
  });
  return Object.freeze(ranks);
}

/**
 * Provenance is labelled only when the stored source gives us enough evidence.
 * Discovery adapters such as HN and general news search intentionally stay
 * unclassified because their outbound URL may be either first- or third-party.
 */
export function signalSourceRole(
  signal: Pick<CuratedAiSignal, "sourceSlug" | "sourceWeight" | "url">,
): SignalSourceRole {
  if (PRIMARY_SOURCE_SLUGS.has(signal.sourceSlug)) {
    return "primary";
  }
  if (SECONDARY_SOURCE_SLUGS.has(signal.sourceSlug)) return "secondary";

  try {
    const host = new URL(signal.url).hostname.replace(/^www\./, "");
    if (host === "arxiv.org" || host === "export.arxiv.org") return "primary";
  } catch {
    // Curated snapshots are schema-validated, but an unclassifiable URL should
    // suppress the badge rather than turn a public list into an error page.
  }
  return null;
}

function formatCategory(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function signalTimestamp(signal: CuratedAiSignal): string {
  return signal.sourcePublishedAt ?? signal.firstSeen;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function isValidRank(value: number | undefined): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

export function AiSignalList({
  signals,
  error = null,
  emptyMessage = "No reviewed signals are public yet.",
  startRank = 1,
  rankByItemId,
}: {
  signals: readonly CuratedAiSignal[];
  error?: string | null;
  emptyMessage?: string;
  startRank?: number;
  rankByItemId?: SignalRankIndex;
}) {
  if (error && signals.length === 0) {
    return (
      <div data-feed-state="unavailable" role="status" className="border-y border-rule py-7">
        <p className="font-semibold">Reviewed signal is temporarily unavailable.</p>
        <p className="mt-1 max-w-[58ch] text-[14px] leading-6 text-muted">
          Private or raw feed rows are not being shown as a fallback. Try this desk again
          in a few minutes.
        </p>
      </div>
    );
  }

  if (signals.length === 0) {
    return (
      <div data-feed-state="empty" className="border-y border-rule py-7">
        <p className="section-label">Editorial status</p>
        <p className="mt-2 max-w-[58ch] text-[15px] leading-7 text-muted">
          {emptyMessage}
        </p>
      </div>
    );
  }

  return (
    <>
      {error ? (
        <p
          data-feed-state="partial"
          role="status"
          className="mb-4 border-y border-rule py-3 text-[13px] leading-6 text-muted"
        >
          Some curated snapshots failed validation and were withheld. The valid reviewed
          items below remain public.
        </p>
      ) : null}
      <ol data-feed-state="ok" data-feed-count={signals.length} className="border-t border-fg">
        {signals.map((signal, index) => {
          const suppliedRank = rankByItemId?.[String(signal.itemId)];
          const rank = isValidRank(suppliedRank) ? suppliedRank : startRank + index;
          const sourceRole = signalSourceRole(signal);
          const timestamp = signalTimestamp(signal);

          return (
            <li
              key={signal.itemId}
              id={`signal-${signal.itemId}`}
              className="scroll-mt-24 border-b border-rule py-6 sm:py-7"
            >
              <article className="grid gap-4 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:gap-7">
                <div className="border-l-2 border-accent pl-3 sm:border-l-0 sm:border-r sm:border-rule sm:pl-0 sm:pr-5">
                  <p className="font-mono text-[9.5px] uppercase tracking-[0.13em] text-muted">
                    Live rank
                  </p>
                  <p
                    aria-label={`Live rank ${rank}`}
                    className="mt-1 font-display text-[22px] font-semibold tabular-nums text-accent-strong"
                  >
                    {String(rank).padStart(2, "0")}
                  </p>
                  <p className="mt-1 font-mono text-[9.5px] tabular-nums text-muted">
                    score {signal.rankScore.toFixed(3)}
                  </p>
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
                    <span className="pill">{formatCategory(signal.category)}</span>
                    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-positive">
                      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-positive" />
                      Reported
                    </span>
                    {sourceRole ? (
                      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
                        {sourceRole === "primary" ? "Primary source" : "Secondary report"}
                      </span>
                    ) : null}
                  </div>

                  <h3 className="font-display mt-3 max-w-[45ch] break-words text-balance text-[18px] font-semibold leading-[1.4] tracking-[-0.015em] sm:text-[20px]">
                    <a
                      href={signal.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-accent hover:underline hover:decoration-1 hover:underline-offset-4"
                    >
                      {signal.title}
                    </a>
                  </h3>

                  <p className="mt-3 max-w-[70ch] text-[14.5px] leading-6 text-muted">
                    {signal.summary}
                  </p>

                  <div className="mt-4 grid gap-1 border-l border-rule pl-4 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-5">
                    <p className="section-label">Why it matters</p>
                    <p className="max-w-[62ch] text-[14px] leading-6 text-fg">
                      {signal.whyItMatters}
                    </p>
                  </div>

                  <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10.5px] text-muted">
                    <span className="break-all">{signal.source}</span>
                    <span aria-hidden="true">&middot;</span>
                    <span>{formatCategory(signal.category)}</span>
                    <span aria-hidden="true">&middot;</span>
                    <time dateTime={timestamp}>{formatDate(timestamp)}</time>
                    <span aria-hidden="true">&middot;</span>
                    <a
                      href={signal.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center font-medium text-accent hover:underline"
                    >
                      View source <span aria-hidden="true">&nbsp;&nearr;</span>
                    </a>
                  </p>
                </div>
              </article>
            </li>
          );
        })}
      </ol>
    </>
  );
}
