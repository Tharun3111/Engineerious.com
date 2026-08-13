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
        <p className="eyebrow">Community tip</p>
        <h1 className="text-[26px] font-bold tracking-tight leading-tight">Suggest a link for review</h1>
        <p className="text-[14px] text-muted">
          Share an AI release, research paper, incident, or open-source project that
          working engineers should know about. Every link is reviewed before publication.
        </p>
      </header>

      <SubmitForm />
    </div>
  );
}
