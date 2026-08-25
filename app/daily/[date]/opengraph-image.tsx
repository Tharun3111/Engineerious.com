import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";

import { dailyDateSchema } from "@/lib/daily-brief";
import { getDailyBriefByDate } from "@/lib/daily-queries";
import { AUTHOR_NAME } from "@/lib/site";

export const runtime = "nodejs";
export const alt = "Engineerious reviewed Daily AI Brief";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!dailyDateSchema.safeParse(date).success) notFound();

  const result = await getDailyBriefByDate(date);
  if (result.error && !result.brief) {
    throw new Error("The requested Daily Brief image could not be generated safely.");
  }
  if (!result.brief) notFound();

  const { brief } = result.brief;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "68px 72px",
          background: "#f7f8fa",
          color: "#0f1729",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 26, fontWeight: 700 }}>Engineerious</div>
          <div
            style={{
              display: "flex",
              padding: "10px 14px",
              border: "1px solid #cfd5df",
              borderRadius: 6,
              color: "#083e9e",
              fontSize: 18,
              letterSpacing: "0.06em",
            }}
          >
            HUMAN APPROVED
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            borderLeft: "8px solid #0b57d0",
            paddingLeft: 34,
          }}
        >
          <div style={{ display: "flex", color: "#4a5468", fontSize: 20, letterSpacing: "0.08em" }}>
            REVIEWED DAILY BRIEF / {brief.date}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 22,
              maxWidth: 990,
              fontSize: brief.title.length > 72 ? 43 : 52,
              fontWeight: 700,
              lineHeight: 1.18,
              letterSpacing: "-0.035em",
            }}
          >
            {brief.title}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            color: "#4a5468",
            fontSize: 19,
          }}
        >
          <div style={{ display: "flex" }}>Source-linked · Reviewed snapshot · Tharun&rsquo;s Take</div>
          <div style={{ display: "flex", color: "#0b57d0", fontWeight: 700 }}>{AUTHOR_NAME}</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
