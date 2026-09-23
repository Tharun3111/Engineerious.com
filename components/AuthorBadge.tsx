/**
 * Tharun's monogram inside the Proof Loop. The blue checkpoint interrupts the
 * navy ring instead of decorating a generic avatar tile: one compact mark now
 * connects the person, the publication, and the favicon without pretending a
 * headshot exists.
 */
export function AuthorBadge({ size = "sm" }: { size?: "sm" | "lg" }) {
  const px = size === "lg" ? 44 : 30;
  const font = size === "lg" ? 14 : 10;
  const checkpoint = size === "lg" ? 9 : 7;

  return (
    <span
      aria-hidden
      className="relative inline-flex shrink-0 items-center justify-center rounded-full border-2 border-fg bg-surface font-mono font-medium text-fg"
      style={{
        width: px,
        height: px,
        fontSize: font,
      }}
    >
      TC
      <span
        className="absolute -right-0.5 -top-0.5 bg-accent ring-2 ring-surface"
        style={{ width: checkpoint, height: checkpoint }}
      />
    </span>
  );
}
