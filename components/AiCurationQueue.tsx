"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import {
  CURATED_AI_CATEGORIES,
  CURATED_AI_TOPIC_SLUGS,
  type CuratedAiCategory,
  type CuratedTopicSlug,
} from "@/lib/curated-ai";
import type { CuratedAiAdminRecord } from "@/lib/curated-ai-queries";
import { hostname } from "@/lib/dedupe";

async function postCuration(body: unknown): Promise<void> {
  const response = await fetch("/api/admin/curated-ai", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(result.error ?? `${response.status} ${response.statusText}`);
}

function label(value: string): string {
  return value.replaceAll("_", " ");
}

function CurationCard({ item }: { item: CuratedAiAdminRecord }) {
  const router = useRouter();
  const formId = useId();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState(item.signal?.title ?? item.title);
  const [summary, setSummary] = useState(item.signal?.summary ?? item.summary ?? "");
  const [category, setCategory] = useState<CuratedAiCategory | "">(
    item.signal?.category ?? "",
  );
  const [topicSlugs, setTopicSlugs] = useState<CuratedTopicSlug[]>(
    item.signal ? [...item.signal.topicSlugs] : [],
  );
  // An ingestion aiNote is context, not a reviewed claim. It is intentionally
  // shown below but never prefilled into the publishable human field.
  const [whyItMatters, setWhyItMatters] = useState(item.signal?.whyItMatters ?? "");

  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await action();
      startTransition(() => router.refresh());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  const toggleTopic = (topic: CuratedTopicSlug) => {
    setTopicSlugs((current) =>
      current.includes(topic) ? current.filter((value) => value !== topic) : [...current, topic],
    );
  };

  return (
    <li id={`curation-${item.id}`} className="rounded-md border border-rule p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[11.5px] uppercase tracking-[0.08em] text-muted">
            {item.type} · item #{item.id} · score {item.score.toFixed(3)}
          </p>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 block break-words text-[15px] font-semibold text-accent-strong"
          >
            {item.title} ↗
          </a>
          <p className="mt-0.5 font-mono text-[11.5px] text-muted">
            {item.source} · {hostname(item.url)}
          </p>
        </div>
        <span className={item.hasCuratedState ? "pill pill-accent" : "pill"}>
          {item.hasCuratedState ? "curated snapshot" : "approved candidate"}
        </span>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-[13px] text-alarm">
          {error}
        </p>
      )}

      {item.curationError && (
        <p role="alert" className="mt-3 rounded-md border border-rule p-3 text-[13px] text-alarm">
          {item.curationError}
        </p>
      )}

      {item.hasCuratedState ? (
        <div className="mt-4 space-y-3">
          {item.signal && (
            <div className="space-y-2 rounded-md bg-surface-2 p-4 text-[13.5px]">
              <p className="eyebrow">Immutable public copy</p>
              <h3 className="text-[16px] font-semibold">{item.signal.title}</h3>
              <p>{item.signal.summary}</p>
              <p>
                <span className="font-semibold">Why it matters:</span> {item.signal.whyItMatters}
              </p>
              <p className="font-mono text-[11.5px] text-muted">
                {label(item.signal.category)} · topics: {item.signal.topicSlugs.join(", ") || "none"}
                {" · "}published by {item.signal.curatedBy}
              </p>
            </div>
          )}
          <p className="text-[12.5px] text-muted">
            This snapshot cannot be edited in place. Unpublish it before creating a reviewed revision.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (window.confirm("Remove this item from the curated AI desk?")) {
                void run(() =>
                  postCuration({
                    id: item.id,
                    action: "unpublish",
                    expectedCurationVersion: item.expectedCurationVersion,
                  }),
                );
              }
            }}
            className="btn btn-secondary btn-sm disabled:opacity-60"
          >
            {busy ? "Unpublishing…" : "Unpublish curated snapshot"}
          </button>
        </div>
      ) : (
        <form
          className="mt-4 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!category) {
              setError("Choose a category before publishing.");
              return;
            }
            void run(() =>
              postCuration({
                id: item.id,
                action: "publish",
                expectedSourceVersion: item.expectedSourceVersion,
                title,
                summary,
                category,
                topicSlugs,
                whyItMatters,
              }),
            );
          }}
        >
          <div>
            <label htmlFor={`${formId}-title`} className="mb-1 block text-[12.5px] font-semibold">
              Reviewed title
            </label>
            <input
              id={`${formId}-title`}
              className="field"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor={`${formId}-summary`} className="mb-1 block text-[12.5px] font-semibold">
              Reviewed summary
            </label>
            <textarea
              id={`${formId}-summary`}
              className="field min-h-28"
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor={`${formId}-category`} className="mb-1 block text-[12.5px] font-semibold">
              Category
            </label>
            <select
              id={`${formId}-category`}
              className="field"
              value={category}
              onChange={(event) => setCategory(event.target.value as CuratedAiCategory | "")}
              required
            >
              <option value="">Choose a category</option>
              {CURATED_AI_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {label(value)}
                </option>
              ))}
            </select>
          </div>

          <fieldset>
            <legend className="text-[12.5px] font-semibold">Topic hubs</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {CURATED_AI_TOPIC_SLUGS.map((topic) => (
                <label
                  key={topic}
                  className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-rule px-3 text-[13px]"
                >
                  <input
                    type="checkbox"
                    checked={topicSlugs.includes(topic)}
                    onChange={() => toggleTopic(topic)}
                  />
                  {topic.toUpperCase()}
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor={`${formId}-why`} className="mb-1 block text-[12.5px] font-semibold">
              Why it matters
            </label>
            <textarea
              id={`${formId}-why`}
              className="field min-h-24"
              value={whyItMatters}
              onChange={(event) => setWhyItMatters(event.target.value)}
              placeholder="Write the reviewed engineering consequence."
              required
            />
            {item.aiNote && (
              <p className="mt-1.5 text-[12px] text-muted">
                Ingestion note (context only, not copied): {item.aiNote}
              </p>
            )}
          </div>

          <p className="text-[12.5px] text-muted">
            Publishing copies the current source, URL, author, and source timestamps from the database.
            Later ingestion changes cannot rewrite the public snapshot.
          </p>
          <button type="submit" disabled={busy} className="btn btn-primary btn-sm disabled:opacity-60">
            {busy ? "Publishing…" : "Publish curated snapshot"}
          </button>
        </form>
      )}
    </li>
  );
}

export function AiCurationQueue({ items }: { items: CuratedAiAdminRecord[] }) {
  if (items.length === 0) {
    return <p className="text-[13.5px] text-muted">No approved AI items are ready for curation.</p>;
  }

  return (
    <ul className="space-y-4">
      {items.map((item) => (
        <CurationCard key={`${item.id}:${item.signal?.curatedAt ?? "candidate"}`} item={item} />
      ))}
    </ul>
  );
}
