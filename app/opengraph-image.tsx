import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "Engineerious — practical AI engineering for real systems";
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
          padding: "72px",
          background: "#0d1b24",
          color: "#f4f9fc",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 32, fontWeight: 700, letterSpacing: -0.5 }}>
          Engineerious
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", fontSize: 58, fontWeight: 700, lineHeight: 1.1, maxWidth: 980 }}>
            Practical AI engineering for real systems
          </div>
          <div style={{ display: "flex", fontSize: 26, color: "#9fb3c8" }}>
            Source-checked news, model analysis, and production guides
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 22, color: "#0a5fa5", fontWeight: 600 }}>
          engineerious.com
        </div>
      </div>
    ),
    { ...size },
  );
}
