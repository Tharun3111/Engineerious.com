import type { Metadata } from "next";

import { SubmitForm } from "@/components/SubmitForm";

export const metadata: Metadata = {
  title: "Submit a link",
  description: "Suggest an AI news story, model release, or open-source project.",
  alternates: { canonical: "/submit" },
};

export default function SubmitPage() {
  return (
    <div className="max-w-lg space-y-6 py-8">
      <header className="space-y-2">
        <p className="eyebrow">Submit</p>
        <h1 className="text-[26px] font-bold tracking-tight leading-tight">Submit a link</h1>
        <p className="text-[14px] text-muted">
          Something the ingestion missed? Send it. Submissions go to a moderation queue,
          not straight to a feed — the bar is &ldquo;a working engineer would want to
          read this&rdquo;, not &ldquo;it mentions AI&rdquo;.
        </p>
      </header>

      <SubmitForm />
    </div>
  );
}
