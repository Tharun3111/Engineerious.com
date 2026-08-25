import { ImageResponse } from "next/og";

import { AUTHOR_NAME, SITE_NAME } from "@/lib/site";

export const runtime = "nodejs";
export const alt = "Engineerious — the AI engineering desk of Tharun Chowdary Malepati";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 70px",
          background: "#f7f8fa",
          color: "#0f1729",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid #cfd5df",
            paddingBottom: 24,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ display: "flex", position: "relative", width: 52, height: 52 }}>
              <div
                style={{
                  display: "flex",
                  width: 48,
                  height: 48,
                  border: "6px solid #0f1729",
                  borderRadius: 999,
                  background: "#ffffff",
                }}
              />
              <div
                style={{
                  display: "flex",
                  position: "absolute",
                  right: 0,
                  top: 0,
                  width: 15,
                  height: 15,
                  border: "3px solid #f7f8fa",
                  background: "#0b57d0",
                }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontFamily: "monospace", fontSize: 25, fontWeight: 700, letterSpacing: -1 }}>
                {SITE_NAME}
              </div>
              <div style={{ display: "flex", marginTop: 4, fontFamily: "monospace", fontSize: 13, letterSpacing: 1.4, color: "#4a5468" }}>
                AI ENGINEERING DESK
              </div>
            </div>
          </div>
          <div style={{ display: "flex", fontFamily: "monospace", fontSize: 14, color: "#4a5468" }}>
            FIELD NOTES / REVIEWED SIGNAL
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", fontFamily: "monospace", fontSize: 15, letterSpacing: 1.5, color: "#0b57d0" }}>
            THARUN&rsquo;S AI ENGINEERING NOTEBOOK
          </div>
          <div style={{ display: "flex", fontFamily: "monospace", fontSize: 51, fontWeight: 700, lineHeight: 1.13, letterSpacing: -2.1, maxWidth: 1050 }}>
            {AUTHOR_NAME}
          </div>
          <div style={{ display: "flex", fontSize: 25, lineHeight: 1.45, color: "#4a5468", maxWidth: 920 }}>
            AI engineer exploring how LLMs, agents, retrieval, evaluation, and production infrastructure work in practice.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid #cfd5df",
            paddingTop: 22,
            fontFamily: "monospace",
            fontSize: 15,
          }}
        >
          <div style={{ display: "flex", color: "#0f1729" }}>BUILD / TEST / EXPLAIN</div>
          <div style={{ display: "flex", color: "#0b57d0" }}>engineerious.com</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
