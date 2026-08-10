import Link from "next/link";

import { getPillar } from "@/lib/pillars";

export function PillarBadge({ slug }: { slug: string }) {
  const pillar = getPillar(slug);
  if (!pillar) return null;

  return (
    <Link href={`/pillars/${pillar.slug}`} className="pill hover:border-accent hover:text-accent-strong">
      {pillar.name}
    </Link>
  );
}
