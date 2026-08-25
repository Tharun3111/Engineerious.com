import Link from "next/link";

import { DailyQuickSheet } from "@/components/DailyQuickSheet";
import { ShareActions } from "@/components/ShareActions";
import type { PublishedDailyBrief } from "@/lib/daily-brief";

const categoryLabels = {
  models: "Models",
  agents: "Agents",
  research: "Research",
  open_source: "Open source",
  frameworks: "Frameworks",
  infrastructure: "Infrastructure",
  business: "Business",
  developer_tools: "Developer tools",
} as const;

function formatEditorialDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

function sourceName(url: string): string {
  return new URL(url).hostname.replace(/^www\./, "");
}

function SourceLinks({ urls }: { urls: string[] }) {
  return (
    <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1" aria-label="Sources">
      {urls.map((url) => (
        <li key={url}>
          <Link
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center font-mono text-[10.5px] font-medium text-accent hover:underline"
          >
            {sourceName(url)} <span aria-hidden="true">&nearr;</span>
            <span className="sr-only"> (opens in a new tab)</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

type BriefModule = {
  label: string;
  title: string;
  body: string;
  meta?: string[];
  sourceUrls: string[];
};

function DailyModule({ module }: { module: BriefModule }) {
  return (
    <section className="border-t border-rule py-6">
      <p className="section-label">{module.label}</p>
      <h3 className="font-display mt-2 text-[18px] font-semibold leading-snug">{module.title}</h3>
      {module.meta?.length ? (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label={`${module.label} details`}>
          {module.meta.map((entry) => (
            <li key={entry} className="pill">
              {entry}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-3 max-w-[68ch] text-[14.5px] leading-7 text-muted">{module.body}</p>
      <SourceLinks urls={module.sourceUrls} />
    </section>
  );
}

export function DailyBrief({ brief, shareUrl }: { brief: PublishedDailyBrief; shareUrl: string }) {
  const modules: BriefModule[] = [];
  if (brief.oneThingToLearn) {
    modules.push({
      label: "One thing to learn",
      title: brief.oneThingToLearn.title,
      body: brief.oneThingToLearn.explanation,
      sourceUrls: brief.oneThingToLearn.sourceUrls,
    });
  }
  if (brief.modelToKnow) {
    const meta = [
      brief.modelToKnow.modelSize,
      brief.modelToKnow.contextWindow,
      brief.modelToKnow.license,
    ].filter((entry): entry is string => entry !== null);
    modules.push({
      label: "Model to know",
      title: brief.modelToKnow.name,
      body: `${brief.modelToKnow.whatItDoes} ${brief.modelToKnow.whyInteresting}`,
      meta,
      sourceUrls: brief.modelToKnow.sourceUrls,
    });
  }
  if (brief.toolOfTheDay) {
    modules.push({
      label: "Tool of the day",
      title: brief.toolOfTheDay.name,
      body: `${brief.toolOfTheDay.whatItIs} ${brief.toolOfTheDay.whenToUse}`,
      sourceUrls: brief.toolOfTheDay.sourceUrls,
    });
  }
  if (brief.paperWorthKnowing) {
    modules.push({
      label: "Paper worth knowing",
      title: brief.paperWorthKnowing.title,
      body: brief.paperWorthKnowing.takeaway,
      sourceUrls: brief.paperWorthKnowing.sourceUrls,
    });
  }

  return (
    <article>
      <header className="border-b border-fg pb-8">
        <div className="flex flex-wrap items-center gap-3">
          <p className="eyebrow">Reviewed Daily Brief</p>
          <span className="pill pill-accent">Human approved</span>
        </div>
        <h1 className="font-display mt-4 max-w-[27ch] text-balance text-[28px] font-semibold leading-[1.25] tracking-[-0.03em] sm:text-[38px]">
          {brief.title}
        </h1>
        <p className="mt-4 max-w-[65ch] text-[16px] leading-7 text-muted">{brief.summary}</p>
        <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
          <time dateTime={brief.date}>{formatEditorialDate(brief.date)}</time>
          <span aria-hidden="true">/</span>
          <Link href={`/daily/${brief.date}`} className="inline-flex min-h-11 items-center text-accent hover:underline">
            Permanent issue
          </Link>
        </p>
      </header>

      <div className="my-8">
        <DailyQuickSheet brief={brief} />
      </div>

      <section aria-labelledby="daily-stories-title">
        <div className="border-b border-fg pb-2.5">
          <p className="section-label">What changed</p>
          <h2 id="daily-stories-title" className="sr-only">
            Today&rsquo;s reviewed stories
          </h2>
        </div>
        <ol className="divide-y divide-rule">
          {brief.stories.map((story, index) => (
            <li key={story.id} id={story.id} className="scroll-mt-24 py-7 sm:py-8">
              <article className="grid gap-5 lg:grid-cols-[7rem_minmax(0,1fr)] lg:gap-8">
                <div>
                  <p className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-accent-strong">
                    {String(index + 1).padStart(2, "0")} &middot; {categoryLabels[story.category]}
                  </p>
                  <p className="mt-2 text-[12px] leading-5 text-muted">{story.sourceLabel}</p>
                </div>
                <div>
                  <h3 className="font-display max-w-[34ch] text-[20px] font-semibold leading-[1.35] tracking-[-0.02em] sm:text-[22px]">
                    {story.headline}
                  </h3>
                  <dl className="mt-5 grid gap-5 sm:grid-cols-3 sm:gap-6">
                    <div>
                      <dt className="section-label">What happened</dt>
                      <dd className="mt-2 text-[14px] leading-6 text-muted">{story.whatHappened}</dd>
                    </div>
                    <div>
                      <dt className="section-label">Why it matters</dt>
                      <dd className="mt-2 text-[14px] leading-6 text-muted">{story.whyItMatters}</dd>
                    </div>
                    <div>
                      <dt className="section-label">For engineers</dt>
                      <dd className="mt-2 text-[14px] leading-6 text-fg">{story.forEngineers}</dd>
                    </div>
                  </dl>
                  <SourceLinks urls={story.sourceUrls} />
                </div>
              </article>
            </li>
          ))}
        </ol>
      </section>

      {modules.length ? (
        <section aria-labelledby="daily-learning-title" className="mt-4 border-b border-rule">
          <h2 id="daily-learning-title" className="sr-only">
            Learning notes and spotlights
          </h2>
          {modules.map((module) => (
            <DailyModule key={module.label} module={module} />
          ))}
        </section>
      ) : null}

      <section aria-labelledby="my-take-title" className="my-10 border-l-2 border-accent pl-5 sm:pl-7">
        <p className="eyebrow">Human perspective</p>
        <h2 id="my-take-title" className="font-display mt-2 text-[21px] font-semibold">
          Tharun&rsquo;s Take
        </h2>
        <p className="mt-3 max-w-[68ch] text-[16px] leading-8 text-fg">{brief.myTake}</p>
      </section>

      <section aria-labelledby="share-daily-title" className="border-y border-rule py-6">
        <h2 id="share-daily-title" className="section-label">Share this issue</h2>
        <p className="mt-2 max-w-[62ch] text-[14.5px] leading-6 text-muted">
          Share the dated edition, so the link always resolves to this reviewed snapshot.
        </p>
        <ShareActions title={brief.title} text={brief.summary} url={shareUrl} />
      </section>
    </article>
  );
}
