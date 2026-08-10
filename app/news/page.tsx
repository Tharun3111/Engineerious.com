import type { Metadata } from "next";

import { SectionPage } from "@/components/SectionPage";
import { sectionFor } from "@/lib/sections";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "AI News",
  description:
    "Ranked AI news from primary labs, practitioner publications, arXiv and Hacker News.",
  alternates: { canonical: "/news" },
};

export default function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; page?: string }>;
}) {
  return <SectionPage section={sectionFor("news")} searchParams={searchParams} />;
}
