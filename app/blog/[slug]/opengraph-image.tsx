import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";

import { getAllPosts, getPost, isVisible } from "@/lib/content/blog";
import { AUTHOR_NAME } from "@/lib/site";

export const runtime = "nodejs";
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
          background: "#17171a",
          color: "#f5f5f3",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 28, fontWeight: 700, letterSpacing: -0.5 }}>
          Engineerious
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
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
            <div style={{ display: "flex", fontSize: 24, color: "#9fb3c8", maxWidth: 940 }}>
              {post.dek}
            </div>
          )}
        </div>
        <div style={{ display: "flex", fontSize: 20, color: "#b3261e", fontWeight: 600 }}>
          {AUTHOR_NAME} · engineerious.com
        </div>
      </div>
    ),
    { ...size },
  );
}
