"use client";

import { useEffect, useId, useState } from "react";

import type { DiagramSpec } from "@/db/schema";

/** Mermaid's `["label"]` node syntax breaks on these characters — strip/replace them
 *  rather than trust LLM-produced text to already be clean mermaid syntax. Newlines
 *  specifically would split one node statement across lines mid-quote and fail the
 *  whole graph to parse, not just look wrong — collapse them to spaces. */
function escapeMermaidLabel(s: string): string {
  return s
    .replace(/"/g, "'")
    .replace(/[[\]{}|]/g, "")
    .replace(/[\r\n]+/g, " ");
}

function toMermaidSyntax(spec: DiagramSpec): string {
  const nodeId = (i: number) => `n${i}`;
  const nodes = spec.steps.map((s, i) => `  ${nodeId(i)}["${escapeMermaidLabel(s.label)}"]`).join("\n");
  if (spec.type === "sequence") {
    const edges = spec.steps.slice(1).map((_, i) => `  ${nodeId(i)} --> ${nodeId(i + 1)}`).join("\n");
    return `graph LR\n${nodes}\n${edges}`;
  }
  // comparison: parallel boxes, no implied ordering between them
  return `graph LR\n${nodes}`;
}

/**
 * Structured spec in, mermaid SVG out — never raw mermaid text from the LLM (see
 * db/schema.ts's DiagramSpec / lib/write.ts's writeOutputSchema). Renders nothing
 * on missing/malformed data or a render failure — a bad diagram must not break the
 * post page it's embedded in.
 */
export function Diagram({ spec }: { spec?: DiagramSpec | null }) {
  const reactId = useId();
  const specKey = spec ? JSON.stringify(spec) : "";
  const [rendered, setRendered] = useState<{ key: string; svg: string } | null>(null);

  useEffect(() => {
    if (!spec || spec.steps.length < 2) return;
    let cancelled = false;

    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "neutral" });
        const id = `diagram-${reactId.replace(/[^a-zA-Z0-9]/g, "")}`;
        const { svg: rendered } = await mermaid.render(id, toMermaidSyntax(spec));
        if (!cancelled) setRendered({ key: specKey, svg: rendered });
      } catch (error) {
        console.error("[Diagram] render failed:", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [spec, specKey, reactId]);

  const svg = rendered?.key === specKey ? rendered.svg : null;
  if (!spec || spec.steps.length < 2 || !svg) return null;

  return (
    <div className="max-w-[68ch] border border-rule p-5">
      <p className="section-label">{spec.title}</p>
      {/* mermaid.render() with securityLevel: "strict" is the only supported way to
          get its SVG output — this is Mermaid's own sanitized output, not raw input. */}
      <div className="mt-3 overflow-x-auto" dangerouslySetInnerHTML={{ __html: svg }} />
      <ul className="mt-4 space-y-1.5 text-[13px] leading-6 text-muted">
        {spec.steps.map((s, i) => (
          <li key={i}>
            <span className="font-semibold text-fg">{s.label}:</span> {s.detail}
          </li>
        ))}
      </ul>
    </div>
  );
}
