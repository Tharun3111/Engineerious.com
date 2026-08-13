import type { Metadata } from "next";

import { SectionPage } from "@/components/SectionPage";
import { sectionFor } from "@/lib/sections";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Model updates",
  description:
    "Compare new AI models by capability, access, cost, constraints, and the tests worth running before adoption.",
  alternates: { canonical: "/models" },
};

export default function ModelsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; page?: string }>;
}) {
  return <SectionPage section={sectionFor("model")} searchParams={searchParams} />;
}
