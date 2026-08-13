import type { Metadata } from "next";

import { SectionPage } from "@/components/SectionPage";
import { sectionFor } from "@/lib/sections";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Open-source releases",
  description:
    "New AI repositories, tracked release notes, and launches — ranked by traction and recency.",
  alternates: { canonical: "/open-source" },
};

export default function OpenSourcePage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; page?: string }>;
}) {
  return <SectionPage section={sectionFor("oss")} searchParams={searchParams} />;
}
