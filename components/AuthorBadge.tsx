/**
 * Tharun's presence on his own site.
 *
 * Before this redesign AUTHOR_NAME existed only in metadata, JSON-LD and the OG
 * image — never rendered on screen anywhere. No photo exists in the repo yet
 * (`public/` has no avatar/headshot file), so this renders a monogram until one
 * is added. Swap the fallback for a real <Image src="/author.jpg" .../> the day
 * a photo lands — the size/shape contract here is designed not to need any other
 * change when that happens.
 */
export function AuthorBadge({ size = "sm" }: { size?: "sm" | "lg" }) {
  const px = size === "lg" ? 44 : 30;
  const font = size === "lg" ? 15 : 11;

  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-md text-white"
      style={{
        width: px,
        height: px,
        fontSize: font,
        fontFamily: "var(--font-mono)",
        fontWeight: 500,
        background: "linear-gradient(135deg, #083E9E, #0B57D0)",
      }}
    >
      TC
    </span>
  );
}
