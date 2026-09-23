export default function Loading() {
  return (
    <div className="py-10 sm:py-14" role="status" aria-live="polite">
      <p className="eyebrow">Loading</p>
      <div className="mt-4 max-w-2xl space-y-3" aria-hidden="true">
        <div className="h-8 w-4/5 rounded bg-surface-2" />
        <div className="h-4 w-full rounded bg-surface-2" />
        <div className="h-4 w-2/3 rounded bg-surface-2" />
      </div>
      <span className="sr-only">Loading page content.</span>
    </div>
  );
}
