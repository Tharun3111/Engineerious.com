import type { Metadata } from "next";

import { SectionPage } from "@/components/SectionPage";
import { sectionFor } from "@/lib/sections";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "AI Models",
  description:
    "New and trending model releases from the Hugging Face Hub and the frontier labs.",
  alternates: { canonical: "/models" },
};

export default function ModelsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; page?: string }>;
}) {
  return <SectionPage section={sectionFor("model")} searchParams={searchParams} />;
}
