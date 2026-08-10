import Image from "next/image";

import engineeriousLogo from "@/Engineerious-Proof-Loop-Brand-Kit/engineerious-horizontal-dark.svg";

export function Logo({ className, priority = false }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src={engineeriousLogo}
      alt="Engineerious"
      priority={priority}
      className={className ?? "h-auto w-[168px]"}
      sizes="(max-width: 640px) 148px, 184px"
    />
  );
}
