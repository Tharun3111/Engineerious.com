"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[route-error]", error);
  }, [error]);

  return (
    <div className="max-w-xl space-y-4 py-16" role="alert">
      <p className="eyebrow">Couldn&rsquo;t load this page</p>
      <h1 className="font-display text-[25px] font-semibold leading-tight">
        The desk hit a temporary problem.
      </h1>
      <p className="text-[16px] leading-7 text-muted">
        Try the request again. If it keeps failing, the data service may be unavailable.
      </p>
      <button type="button" onClick={reset} className="btn btn-primary">
        Try again
      </button>
    </div>
  );
}
