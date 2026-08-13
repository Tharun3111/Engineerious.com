import type { Metadata } from "next";

import { SectionPage } from "@/components/SectionPage";
import { sectionFor } from "@/lib/sections";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "AI news",
  description:
    "Source-checked AI releases, research, policy changes, and incidents with practical engineering context.",
  alternates: { canonical: "/news" },
};

export default function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; page?: string }>;
}) {
  return <SectionPage section={sectionFor("news")} searchParams={searchParams} />;
}
