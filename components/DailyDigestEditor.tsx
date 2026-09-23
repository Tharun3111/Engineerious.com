"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import type {
  DailyBriefDraft,
  DailyStory,
  DailyStoryCategory,
} from "@/lib/daily-brief";
import type { ReviewReport } from "@/lib/review";

const CATEGORY_OPTIONS: Array<{ value: DailyStoryCategory; label: string }> = [
  { value: "models", label: "Models" },
  { value: "agents", label: "Agents" },
  { value: "research", label: "Research" },
  { value: "open_source", label: "Open source" },
  { value: "frameworks", label: "Frameworks" },
  { value: "infrastructure", label: "Infrastructure" },
  { value: "business", label: "Business" },
  { value: "developer_tools", label: "Developer tools" },
];

type EditorRecord = {
  id: number;
  date: string;
  status: string;
  draftVersion: number;
  draft: DailyBriefDraft;
  reviewReport: ReviewReport | null;
  reviewCurrent: boolean;
  myTakeConfirmed: boolean;
  reviewedAt: string | null;
  myTakeConfirmedAt: string | null;
};

type MutationResult = {
  ok?: boolean;
  error?: string;
  blockers?: string[];
  status?: string;
  draftVersion?: number;
  draft?: DailyBriefDraft;
  reviewReport?: ReviewReport | null;
  reviewCurrent?: boolean;
  myTakeConfirmed?: boolean;
  idempotent?: boolean;
};

type EvidencePayload = {
  findings: Array<{ title?: string; summary?: string; sourceUrls?: string[] }>;
  coverageNotes: string;
  gatheredItems: unknown;
  tavilyCreditsUsed: number;
};

class AdminRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function mutateDigest(body: unknown): Promise<MutationResult> {
  const response = await fetch("/api/admin/digests", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = (await response.json().catch(() => ({}))) as MutationResult;
  if (!response.ok) {
    const blockerText = result.blockers?.length ? ` ${result.blockers.join(" ")}` : "";
    throw new AdminRequestError(
      `${result.error ?? `${response.status} ${response.statusText}`}${blockerText}`,
      response.status,
    );
  }
  return result;
}

function urlsToText(urls: string[]): string {
  return urls.join("\n");
}

function textToUrls(value: string): string[] {
  return value
    .split("\n")
    .map((url) => url.trim())
    .filter(Boolean);
}

function withoutMyTake(draft: DailyBriefDraft): Omit<DailyBriefDraft, "myTake"> {
  const factual = { ...draft } as Partial<DailyBriefDraft>;
  delete factual.myTake;
  return factual as Omit<DailyBriefDraft, "myTake">;
}

function reviewIssueCount(report: ReviewReport | null): number {
  if (!report) return 0;
  return report.groundingViolations.length + report.voiceViolations.length;
}

function LabeledInput({
  id,
  label,
  value,
  onChange,
  helper,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  helper?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-semibold">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="field mt-1"
      />
      {helper && <p className="mt-1 text-[12px] text-muted">{helper}</p>}
    </div>
  );
}

function LabeledTextarea({
  id,
  label,
  value,
  onChange,
  rows = 3,
  helper,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  helper?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-semibold">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className="field mt-1 resize-y leading-relaxed"
      />
      {helper && <p className="mt-1 text-[12px] text-muted">{helper}</p>}
    </div>
  );
}

function SourceUrlsField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <LabeledTextarea
      id={id}
      label="Source URLs"
      value={urlsToText(value)}
      onChange={(next) => onChange(textToUrls(next))}
      rows={Math.max(2, value.length)}
      helper="One exact gathered URL per line. New or altered URLs will be rejected on save."
    />
  );
}

function StoryEditor({
  story,
  index,
  storyCount,
  onChange,
  onMove,
  onRemove,
}: {
  story: DailyStory;
  index: number;
  storyCount: number;
  onChange: (story: DailyStory) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  const prefix = `story-${story.id}-${index}`;
  return (
    <fieldset className="rounded-md border border-rule p-4">
      <legend className="px-1 font-mono text-[11px] text-muted">
        Story {String(index + 1).padStart(2, "0")}
      </legend>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule pb-3">
        <span className="min-w-0 truncate font-mono text-[11px] text-muted">{story.id}</span>
        <div className="flex flex-wrap gap-2" aria-label={`Reorder story ${index + 1}`}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={index === 0}
            onClick={() => onMove(-1)}
          >
            Up
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={index === storyCount - 1}
            onClick={() => onMove(1)}
          >
            Down
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm text-negative"
            disabled={storyCount === 1}
            onClick={onRemove}
          >
            Remove
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor={`${prefix}-category`} className="block text-[13px] font-semibold">
            Category
          </label>
          <select
            id={`${prefix}-category`}
            value={story.category}
            onChange={(event) =>
              onChange({ ...story, category: event.target.value as DailyStoryCategory })
            }
            className="field mt-1"
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <LabeledInput
          id={`${prefix}-source-label`}
          label="Source label"
          value={story.sourceLabel}
          onChange={(sourceLabel) => onChange({ ...story, sourceLabel })}
        />
      </div>

      <div className="mt-4 space-y-4">
        <LabeledInput
          id={`${prefix}-headline`}
          label="Headline"
          value={story.headline}
          onChange={(headline) => onChange({ ...story, headline })}
        />
        <LabeledTextarea
          id={`${prefix}-what-happened`}
          label="What happened"
          value={story.whatHappened}
          onChange={(whatHappened) => onChange({ ...story, whatHappened })}
        />
        <LabeledTextarea
          id={`${prefix}-why-it-matters`}
          label="Why it matters"
          value={story.whyItMatters}
          onChange={(whyItMatters) => onChange({ ...story, whyItMatters })}
        />
        <LabeledTextarea
          id={`${prefix}-for-engineers`}
          label="For engineers"
          value={story.forEngineers}
          onChange={(forEngineers) => onChange({ ...story, forEngineers })}
        />
        <SourceUrlsField
          id={`${prefix}-sources`}
          value={story.sourceUrls}
          onChange={(sourceUrls) => onChange({ ...story, sourceUrls })}
        />
      </div>
    </fieldset>
  );
}

function ReviewReportPanel({ report }: { report: ReviewReport | null }) {
  if (!report) {
    return <p className="text-[13px] text-muted">No review has been stored for this revision.</p>;
  }
  return (
    <div className="space-y-2 text-[13px]">
      <p className="font-semibold">{report.overallVerdict}</p>
      {report.readsAsGenericAiContent && (
        <p className="text-negative">The review flags this as generic AI content.</p>
      )}
      {[...report.groundingViolations, ...report.voiceViolations].map((issue, index) => (
        <blockquote key={`${issue.quote}-${index}`} className="border-l-2 border-negative pl-3">
          <p>&quot;{issue.quote}&quot;</p>
          <p className="text-muted">{issue.issue}</p>
        </blockquote>
      ))}
      {reviewIssueCount(report) === 0 && !report.readsAsGenericAiContent && (
        <p className="text-positive">No automated review blockers.</p>
      )}
    </div>
  );
}

export function DailyDigestEditor({ record }: { record: EditorRecord }) {
  const router = useRouter();
  const [draft, setDraft] = useState(record.draft);
  const [savedDraft, setSavedDraft] = useState(record.draft);
  const [version, setVersion] = useState(record.draftVersion);
  const [reviewReport, setReviewReport] = useState(record.reviewReport);
  const [reviewCurrent, setReviewCurrent] = useState(record.reviewCurrent);
  const [myTakeConfirmed, setMyTakeConfirmed] = useState(record.myTakeConfirmed);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [evidence, setEvidence] = useState<EvidencePayload | null>(null);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [evidenceBusy, setEvidenceBusy] = useState(false);

  const factualDirty = useMemo(
    () => JSON.stringify(withoutMyTake(draft)) !== JSON.stringify(withoutMyTake(savedDraft)),
    [draft, savedDraft],
  );
  const takeDirty = draft.myTake !== savedDraft.myTake;
  const dirty = factualDirty || takeDirty;
  const effectiveReviewCurrent = reviewCurrent && !factualDirty;
  const effectiveTakeConfirmed = myTakeConfirmed && !takeDirty;
  const blockers = reviewIssueCount(reviewReport);
  const reviewClean =
    Boolean(reviewReport) && blockers === 0 && !reviewReport?.readsAsGenericAiContent;
  const publishReady =
    !dirty &&
    effectiveReviewCurrent &&
    effectiveTakeConfirmed &&
    reviewClean &&
    draft.myTake.trim().length > 0;

  async function runAction(
    action: string,
    body: Record<string, unknown>,
    successMessage: string,
  ): Promise<MutationResult | null> {
    if (busyAction) return null;
    setBusyAction(action);
    setError(null);
    setMessage(null);
    try {
      const result = await mutateDigest({
        id: record.id,
        action,
        expectedVersion: version,
        ...body,
      });
      setMessage(successMessage);
      if (typeof result.draftVersion === "number") setVersion(result.draftVersion);
      if (result.reviewReport !== undefined) setReviewReport(result.reviewReport);
      if (typeof result.reviewCurrent === "boolean") setReviewCurrent(result.reviewCurrent);
      if (typeof result.myTakeConfirmed === "boolean") {
        setMyTakeConfirmed(result.myTakeConfirmed);
      }
      router.refresh();
      return result;
    } catch (caught) {
      const requestError = caught as AdminRequestError;
      if (requestError.status === 409 && /version|another session|changed/i.test(requestError.message)) {
        setStale(true);
      }
      setError(requestError.message);
      return null;
    } finally {
      setBusyAction(null);
    }
  }

  async function save() {
    const result = await runAction("save", { draft }, "Changes saved.");
    if (!result) return;
    const saved = result.draft ?? draft;
    setDraft(saved);
    setSavedDraft(saved);
    setReviewCurrent(result.reviewCurrent ?? !factualDirty);
    setMyTakeConfirmed(result.myTakeConfirmed ?? false);
  }

  async function loadEvidence() {
    const nextOpen = !evidenceOpen;
    setEvidenceOpen(nextOpen);
    if (!nextOpen || evidence || evidenceBusy) return;
    setEvidenceBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/digests/${record.id}/evidence`);
      const result = (await response.json().catch(() => ({}))) as EvidencePayload & {
        error?: string;
      };
      if (!response.ok) throw new Error(result.error ?? "Could not load research evidence.");
      setEvidence(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setEvidenceBusy(false);
    }
  }

  function updateStory(index: number, story: DailyStory) {
    setDraft((current) => ({
      ...current,
      stories: current.stories.map((item, itemIndex) => (itemIndex === index ? story : item)),
    }));
  }

  function moveStory(index: number, direction: -1 | 1) {
    setDraft((current) => {
      const stories = [...current.stories];
      const target = index + direction;
      [stories[index], stories[target]] = [stories[target], stories[index]];
      return { ...current, stories };
    });
  }

  function removeStory(index: number) {
    setDraft((current) => ({
      ...current,
      stories: current.stories.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  return (
    <article className="card overflow-hidden">
      <header className="border-b border-rule bg-surface-2 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] text-muted">
              {record.date} · digest #{record.id} · revision {version}
            </p>
            <h3 className="mt-1 text-[18px] font-semibold">{draft.title}</h3>
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Editorial state">
            <span className={effectiveReviewCurrent && reviewClean ? "pill pill-accent" : "pill"}>
              {effectiveReviewCurrent && reviewClean ? "facts reviewed" : "review required"}
            </span>
            <span className={effectiveTakeConfirmed ? "pill pill-accent" : "pill"}>
              {effectiveTakeConfirmed ? "take confirmed" : "take unconfirmed"}
            </span>
            {dirty && <span className="pill">unsaved changes</span>}
          </div>
        </div>
      </header>

      <div className="space-y-6 p-4 sm:p-5">
        {(error || stale) && (
          <div role="alert" className="rounded-md border border-negative p-3 text-[13px] text-negative">
            <p>{error}</p>
            {stale && (
              <button type="button" className="btn btn-secondary btn-sm mt-2" onClick={() => router.refresh()}>
                Reload current revision
              </button>
            )}
          </div>
        )}
        <p aria-live="polite" className="text-[13px] text-positive">
          {message}
        </p>

        <section aria-labelledby={`brief-${record.id}-basics`} className="space-y-4">
          <h4 id={`brief-${record.id}-basics`} className="section-label">
            Brief
          </h4>
          <LabeledInput
            id={`digest-${record.id}-title`}
            label="Title"
            value={draft.title}
            onChange={(title) => setDraft((current) => ({ ...current, title }))}
          />
          <LabeledTextarea
            id={`digest-${record.id}-summary`}
            label="Summary"
            value={draft.summary}
            onChange={(summary) => setDraft((current) => ({ ...current, summary }))}
          />
        </section>

        <section aria-labelledby={`brief-${record.id}-stories`} className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h4 id={`brief-${record.id}-stories`} className="section-label">
                What happened today
              </h4>
              <p className="mt-1 text-[13px] text-muted">
                Ordered for the public brief and its 60-second view.
              </p>
            </div>
            <span className="font-mono text-[11px] text-muted">{draft.stories.length}/10 stories</span>
          </div>
          {draft.stories.map((story, index) => (
            <StoryEditor
              key={story.id}
              story={story}
              index={index}
              storyCount={draft.stories.length}
              onChange={(next) => updateStory(index, next)}
              onMove={(direction) => moveStory(index, direction)}
              onRemove={() => removeStory(index)}
            />
          ))}
        </section>

        <section aria-labelledby={`brief-${record.id}-modules`} className="space-y-4">
          <div>
            <h4 id={`brief-${record.id}-modules`} className="section-label">
              Learning modules
            </h4>
            <p className="mt-1 text-[13px] text-muted">
              Optional modules stay out of the public brief when removed.
            </p>
          </div>

          {draft.oneThingToLearn ? (
            <fieldset className="space-y-4 rounded-md border border-rule p-4">
              <legend className="px-1 text-[13px] font-semibold">One thing to learn</legend>
              <LabeledInput
                id={`digest-${record.id}-learn-title`}
                label="Title"
                value={draft.oneThingToLearn.title}
                onChange={(title) =>
                  setDraft((current) => ({
                    ...current,
                    oneThingToLearn: current.oneThingToLearn
                      ? { ...current.oneThingToLearn, title }
                      : null,
                  }))
                }
              />
              <LabeledTextarea
                id={`digest-${record.id}-learn-explanation`}
                label="Explanation"
                value={draft.oneThingToLearn.explanation}
                onChange={(explanation) =>
                  setDraft((current) => ({
                    ...current,
                    oneThingToLearn: current.oneThingToLearn
                      ? { ...current.oneThingToLearn, explanation }
                      : null,
                  }))
                }
              />
              <SourceUrlsField
                id={`digest-${record.id}-learn-sources`}
                value={draft.oneThingToLearn.sourceUrls}
                onChange={(sourceUrls) =>
                  setDraft((current) => ({
                    ...current,
                    oneThingToLearn: current.oneThingToLearn
                      ? { ...current.oneThingToLearn, sourceUrls }
                      : null,
                  }))
                }
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm text-negative"
                onClick={() => setDraft((current) => ({ ...current, oneThingToLearn: null }))}
              >
                Remove learning module
              </button>
            </fieldset>
          ) : (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  oneThingToLearn: { title: "", explanation: "", sourceUrls: [] },
                }))
              }
            >
              Add one thing to learn
            </button>
          )}

          {draft.modelToKnow ? (
            <fieldset className="space-y-4 rounded-md border border-rule p-4">
              <legend className="px-1 text-[13px] font-semibold">Model to know</legend>
              <div className="grid gap-4 md:grid-cols-2">
                <LabeledInput
                  id={`digest-${record.id}-model-name`}
                  label="Model name"
                  value={draft.modelToKnow.name}
                  onChange={(name) =>
                    setDraft((current) => ({
                      ...current,
                      modelToKnow: current.modelToKnow ? { ...current.modelToKnow, name } : null,
                    }))
                  }
                />
                {(["modelSize", "contextWindow", "license"] as const).map((field) => (
                  <LabeledInput
                    key={field}
                    id={`digest-${record.id}-model-${field}`}
                    label={
                      field === "modelSize"
                        ? "Model size"
                        : field === "contextWindow"
                          ? "Context window"
                          : "License"
                    }
                    value={draft.modelToKnow?.[field] ?? ""}
                    onChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        modelToKnow: current.modelToKnow
                          ? { ...current.modelToKnow, [field]: value.trim().length ? value : null }
                          : null,
                      }))
                    }
                    helper="Leave blank when the source does not specify it."
                  />
                ))}
              </div>
              <LabeledTextarea
                id={`digest-${record.id}-model-does`}
                label="What it does"
                value={draft.modelToKnow.whatItDoes}
                onChange={(whatItDoes) =>
                  setDraft((current) => ({
                    ...current,
                    modelToKnow: current.modelToKnow
                      ? { ...current.modelToKnow, whatItDoes }
                      : null,
                  }))
                }
              />
              <LabeledTextarea
                id={`digest-${record.id}-model-interesting`}
                label="Why it is interesting"
                value={draft.modelToKnow.whyInteresting}
                onChange={(whyInteresting) =>
                  setDraft((current) => ({
                    ...current,
                    modelToKnow: current.modelToKnow
                      ? { ...current.modelToKnow, whyInteresting }
                      : null,
                  }))
                }
              />
              <SourceUrlsField
                id={`digest-${record.id}-model-sources`}
                value={draft.modelToKnow.sourceUrls}
                onChange={(sourceUrls) =>
                  setDraft((current) => ({
                    ...current,
                    modelToKnow: current.modelToKnow
                      ? { ...current.modelToKnow, sourceUrls }
                      : null,
                  }))
                }
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm text-negative"
                onClick={() => setDraft((current) => ({ ...current, modelToKnow: null }))}
              >
                Remove model module
              </button>
            </fieldset>
          ) : (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  modelToKnow: {
                    name: "",
                    whatItDoes: "",
                    modelSize: null,
                    contextWindow: null,
                    license: null,
                    whyInteresting: "",
                    sourceUrls: [],
                  },
                }))
              }
            >
              Add model to know
            </button>
          )}

          {draft.toolOfTheDay ? (
            <fieldset className="space-y-4 rounded-md border border-rule p-4">
              <legend className="px-1 text-[13px] font-semibold">Tool or framework of the day</legend>
              <LabeledInput
                id={`digest-${record.id}-tool-name`}
                label="Name"
                value={draft.toolOfTheDay.name}
                onChange={(name) =>
                  setDraft((current) => ({
                    ...current,
                    toolOfTheDay: current.toolOfTheDay ? { ...current.toolOfTheDay, name } : null,
                  }))
                }
              />
              <LabeledTextarea
                id={`digest-${record.id}-tool-what`}
                label="What it is"
                value={draft.toolOfTheDay.whatItIs}
                onChange={(whatItIs) =>
                  setDraft((current) => ({
                    ...current,
                    toolOfTheDay: current.toolOfTheDay
                      ? { ...current.toolOfTheDay, whatItIs }
                      : null,
                  }))
                }
              />
              <LabeledTextarea
                id={`digest-${record.id}-tool-when`}
                label="When to use it"
                value={draft.toolOfTheDay.whenToUse}
                onChange={(whenToUse) =>
                  setDraft((current) => ({
                    ...current,
                    toolOfTheDay: current.toolOfTheDay
                      ? { ...current.toolOfTheDay, whenToUse }
                      : null,
                  }))
                }
              />
              <SourceUrlsField
                id={`digest-${record.id}-tool-sources`}
                value={draft.toolOfTheDay.sourceUrls}
                onChange={(sourceUrls) =>
                  setDraft((current) => ({
                    ...current,
                    toolOfTheDay: current.toolOfTheDay
                      ? { ...current.toolOfTheDay, sourceUrls }
                      : null,
                  }))
                }
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm text-negative"
                onClick={() => setDraft((current) => ({ ...current, toolOfTheDay: null }))}
              >
                Remove tool module
              </button>
            </fieldset>
          ) : (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  toolOfTheDay: { name: "", whatItIs: "", whenToUse: "", sourceUrls: [] },
                }))
              }
            >
              Add tool or framework
            </button>
          )}

          {draft.paperWorthKnowing ? (
            <fieldset className="space-y-4 rounded-md border border-rule p-4">
              <legend className="px-1 text-[13px] font-semibold">Paper worth knowing</legend>
              <LabeledInput
                id={`digest-${record.id}-paper-title`}
                label="Title"
                value={draft.paperWorthKnowing.title}
                onChange={(title) =>
                  setDraft((current) => ({
                    ...current,
                    paperWorthKnowing: current.paperWorthKnowing
                      ? { ...current.paperWorthKnowing, title }
                      : null,
                  }))
                }
              />
              <LabeledTextarea
                id={`digest-${record.id}-paper-takeaway`}
                label="Takeaway"
                value={draft.paperWorthKnowing.takeaway}
                onChange={(takeaway) =>
                  setDraft((current) => ({
                    ...current,
                    paperWorthKnowing: current.paperWorthKnowing
                      ? { ...current.paperWorthKnowing, takeaway }
                      : null,
                  }))
                }
              />
              <SourceUrlsField
                id={`digest-${record.id}-paper-sources`}
                value={draft.paperWorthKnowing.sourceUrls}
                onChange={(sourceUrls) =>
                  setDraft((current) => ({
                    ...current,
                    paperWorthKnowing: current.paperWorthKnowing
                      ? { ...current.paperWorthKnowing, sourceUrls }
                      : null,
                  }))
                }
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm text-negative"
                onClick={() => setDraft((current) => ({ ...current, paperWorthKnowing: null }))}
              >
                Remove paper module
              </button>
            </fieldset>
          ) : (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  paperWorthKnowing: { title: "", takeaway: "", sourceUrls: [] },
                }))
              }
            >
              Add paper worth knowing
            </button>
          )}
        </section>

        <section aria-labelledby={`brief-${record.id}-take`} className="rounded-md border-2 border-accent p-4">
          <h4 id={`brief-${record.id}-take`} className="section-label text-accent-strong">
            Tharun&apos;s take · human-only
          </h4>
          <LabeledTextarea
            id={`digest-${record.id}-take-text`}
            label="Your observation"
            value={draft.myTake}
            onChange={(myTake) => setDraft((current) => ({ ...current, myTake }))}
            rows={4}
            helper="Write this yourself, save it, then explicitly confirm the saved text. Generation always leaves this field empty."
          />
        </section>

        <section aria-labelledby={`brief-${record.id}-evidence`} className="rounded-md border border-rule p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 id={`brief-${record.id}-evidence`} className="section-label">
                Source evidence
              </h4>
              <p className="mt-1 text-[13px] text-muted">Loaded only when you open it.</p>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={loadEvidence}>
              {evidenceBusy ? "Loading evidence…" : evidenceOpen ? "Hide evidence" : "Inspect evidence"}
            </button>
          </div>
          {evidenceOpen && evidence && (
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-[13px] font-semibold">Coverage notes</p>
                <p className="mt-1 whitespace-pre-wrap text-[13px] text-muted">
                  {evidence.coverageNotes || "No coverage notes were stored."}
                </p>
              </div>
              <div>
                <p className="text-[13px] font-semibold">Findings</p>
                <ol className="mt-2 space-y-3">
                  {evidence.findings.map((finding, index) => (
                    <li key={`${finding.title ?? "finding"}-${index}`} className="rounded-md bg-surface-2 p-3 text-[13px]">
                      <p className="font-semibold">{finding.title ?? `Finding ${index + 1}`}</p>
                      {finding.summary && <p className="mt-1 text-muted">{finding.summary}</p>}
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                        {(finding.sourceUrls ?? []).map((url) => (
                          <a
                            key={url}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="break-all text-accent-strong underline underline-offset-2"
                          >
                            {url}
                          </a>
                        ))}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
              <details>
                <summary className="min-h-11 cursor-pointer py-2 text-[13px] font-semibold">
                  Raw gathered evidence · {evidence.tavilyCreditsUsed} Tavily credits
                </summary>
                <pre className="field max-h-96 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed">
                  {JSON.stringify(evidence.gatheredItems, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </section>

        <section aria-labelledby={`brief-${record.id}-review`} className="rounded-md border border-rule p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 id={`brief-${record.id}-review`} className="section-label">
              Review report
            </h4>
            <span className="font-mono text-[11px] text-muted">
              {record.reviewedAt ? `last reviewed ${record.reviewedAt}` : "not reviewed"}
            </span>
          </div>
          <div className="mt-3">
            <ReviewReportPanel report={reviewReport} />
          </div>
        </section>

        <footer className="border-t border-rule pt-5">
          <p className="mb-3 text-[13px] text-muted">
            Publish freezes this reviewed revision as the public Daily snapshot. It does not send a newsletter.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={!dirty || Boolean(busyAction) || stale}
              onClick={save}
            >
              {busyAction === "save" ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={dirty || Boolean(busyAction) || stale}
              onClick={() => runAction("review", {}, "Review finished.")}
              title={dirty ? "Save changes before running review." : undefined}
            >
              {busyAction === "review" ? "Reviewing…" : "Run factual review"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={
                dirty || !draft.myTake.trim() || Boolean(busyAction) || stale
              }
              onClick={() => runAction("confirm_take", {}, "My Take confirmed for this revision.")}
              title={dirty ? "Save My Take before confirming it." : undefined}
            >
              {busyAction === "confirm_take" ? "Confirming…" : "Confirm My Take"}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!publishReady || Boolean(busyAction) || stale}
              onClick={() => runAction("publish", {}, "Daily Brief published.")}
              title={
                publishReady
                  ? undefined
                  : "Save, pass review, and confirm the current My Take before publishing."
              }
            >
              {busyAction === "publish" ? "Publishing…" : "Publish Daily"}
            </button>
            <button
              type="button"
              className="btn btn-secondary text-negative sm:ml-auto"
              disabled={Boolean(busyAction)}
              onClick={() => {
                if (window.confirm("Reject this Daily Brief? This is a terminal editorial action.")) {
                  void runAction("reject", {}, "Daily Brief rejected.");
                }
              }}
            >
              Reject
            </button>
          </div>
        </footer>
      </div>
    </article>
  );
}
