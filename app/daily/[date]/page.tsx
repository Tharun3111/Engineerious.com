import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DailyBrief } from "@/components/DailyBrief";
import { dailyDateSchema } from "@/lib/daily-brief";
import { getDailyBriefByDate } from "@/lib/daily-queries";

export const revalidate = 300;

type Props = { params: Promise<{ date: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { date } = await params;
  if (!dailyDateSchema.safeParse(date).success) notFound();
  const result = await getDailyBriefByDate(date);
  if (result.error && !result.brief) {
    throw new Error("The requested Daily Brief could not be loaded safely.");
  }
  if (!result.brief) notFound();
  const { brief } = result;
  return {
    title: brief.brief.title,
    description: brief.brief.summary,
    alternates: { canonical: `/daily/${brief.date}` },
    openGraph: {
      type: "article",
      title: brief.brief.title,
      description: brief.brief.summary,
      publishedTime: brief.publishedAt.toISOString(),
      url: `/daily/${brief.date}`,
    },
  };
}

export default async function DailyDatePage({ params }: Props) {
  const { date } = await params;
  if (!dailyDateSchema.safeParse(date).success) notFound();

  const result = await getDailyBriefByDate(date);
  if (result.error && !result.brief) {
    throw new Error("The requested Daily Brief could not be loaded safely.");
  }
  if (!result.brief) notFound();

  return (
    <div className="mx-auto max-w-5xl py-10 sm:py-14">
      <nav aria-label="Breadcrumb" className="mb-7">
        <ol className="flex flex-wrap items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.09em] text-muted">
          <li>
            <Link href="/daily" className="inline-flex min-h-11 items-center text-accent hover:underline">
              Daily
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page">{result.brief.date}</li>
        </ol>
      </nav>
      <DailyBrief brief={result.brief.brief} />
    </div>
  );
}
