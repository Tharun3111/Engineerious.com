import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";

import { getAllPosts, getPost, isVisible } from "@/lib/content/blog";
import { AUTHOR_NAME } from "@/lib/site";

export const runtime = "nodejs";
export const revalidate = 300;
export const alt = "Engineerious";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  // Same gate as the sibling page.tsx — getPost() resolves any slug, draft or
  // published, for /admin's benefit. Without this check an unreviewed post's
  // real title/dek would be servable as a public, indexable social-preview
  // image at a predictable URL before a human ever approved it.
  if (!post || !isVisible(post)) notFound();

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
            VERIFIED WRITING
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 22,
            borderLeft: "8px solid #0b57d0",
            paddingLeft: 34,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: post.title.length > 70 ? 44 : 54,
              fontWeight: 700,
              lineHeight: 1.15,
              maxWidth: 1000,
            }}
          >
            {post.title}
          </div>
          {post.dek && (
            <div style={{ display: "flex", fontSize: 24, color: "#4a5468", maxWidth: 940 }}>
              {post.dek}
            </div>
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 20, color: "#4a5468" }}>
          <div style={{ display: "flex" }}>AI engineering field notes</div>
          <div style={{ display: "flex", color: "#0b57d0", fontWeight: 700 }}>{AUTHOR_NAME}</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
